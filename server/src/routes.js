import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { ObjectId } from 'mongodb';
import { SOURCES, transformRow } from './schemas.js';
import { readPreview, fileHash } from './ingest.js';
import { suggestMapping, mappingFits } from './mapping.js';
import { startImportJob, rematch, jobById } from './jobs.js';
import { csvCell, maskName, maskPhone } from './parse.js';
import { DAY } from './engine.js';

const SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : crypto.randomBytes(32).toString('hex'));
if (!SECRET) throw new Error('JWT_SECRET is required in production');
const UPLOAD_DIR = path.resolve('uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 60 * 1024 * 1024 } });

const FINANCE = ['finance', 'cofounder'];
const ALL = ['finance', 'cofounder', 'returns'];
const RECOVERY_TARGET = 3000000 * 100; // ₹30 lakh, from the client's success measures
const BUCKETS = [['0–30 days', 0, 30], ['31–60 days', 31, 60], ['61–90 days', 61, 90], ['Over 90 days', 91, Infinity]];
const EVIDENCE = { short_paid: ['settlement', 'cod'], unpaid_past_due: ['settlement', 'cod'], freight_overcharged: ['freight'], return_not_received: ['warehouse'] };
const str = (v) => (typeof v === 'string' ? v : '');
const oid = (v) => { if (!ObjectId.isValid(str(v))) { const e = new Error('Not found'); e.status = 404; throw e; } return new ObjectId(v); };
const fail = (status, message) => Object.assign(new Error(message), { status });
const rs = (p) => (p === null || p === undefined ? '' : (p / 100).toFixed(2));
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export function buildRouter(db) {
  const r = express.Router();
  const audit = (req, action, target, detail) => db.collection('audit').insertOne({ at: new Date(), by: req.user?.email, action, target, detail });

  const auth = (roles = ALL) => (req, res, next) => {
    try {
      req.user = jwt.verify(req.cookies?.session, SECRET);
    } catch { return res.status(401).json({ error: 'Please sign in' }); }
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Your role cannot do this' });
    next();
  };

  const startSession = (res, user) => {
    const token = jwt.sign({ email: user.email, name: user.name, role: user.role }, SECRET, { expiresIn: '10h' });
    res.cookie('session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 10 * 3600 * 1000 });
    res.json({ email: user.email, name: user.name, role: user.role });
  };

  r.post('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, validate: { trustProxy: false } }), async (req, res) => {
    const user = await db.collection('users').findOne({ email: str(req.body?.email).toLowerCase() });
    if (!user || !(await bcrypt.compare(str(req.body?.password), user.passwordHash))) throw fail(401, 'Wrong email or password');
    startSession(res, user);
  });

  // Self-registration always gives the finance role, whatever the request says.
  // Write-offs and customer details stay with the co-founder.
  r.post('/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, validate: { trustProxy: false } }), async (req, res) => {
    const name = str(req.body?.name).trim();
    const email = str(req.body?.email).trim().toLowerCase();
    const password = str(req.body?.password);
    if (!name || name.length > 80) throw fail(400, 'Enter your name, up to 80 characters');
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, 'Enter a valid email address');
    if (password.length < 8 || Buffer.byteLength(password) > 72) throw fail(400, 'Use a password of 8 to 72 characters');
    const user = { email, name, role: 'finance', passwordHash: await bcrypt.hash(password, 10), createdAt: new Date() };
    try {
      await db.collection('users').insertOne(user);
    } catch (err) {
      if (err.code === 11000) throw fail(409, 'An account with this email already exists');
      throw err;
    }
    await audit({ user }, 'account.created', email);
    res.status(201);
    startSession(res, user);
  });
  r.post('/auth/logout', (req, res) => { res.clearCookie('session'); res.json({ ok: true }); });
  r.get('/me', auth(), (req, res) => res.json(req.user));

  // ---------- Uploads ----------
  r.get('/sources', auth(), async (req, res) => {
    const cards = await db.collection('cards').distinct('partner', { kind: 'channel' });
    const couriers = await db.collection('cards').distinct('partner', { kind: 'courier' });
    res.json({
      sources: Object.entries(SOURCES).map(([key, s]) => ({ key, label: s.label, fields: s.fields.map(({ key: k, label, required, personal, type }) => ({ key: k, label, required, personal, type })) })),
      partners: { orders: ['All channels'], settlement: cards, cod: couriers, freight: couriers, warehouse: ['Warehouse'] },
    });
  });

  r.post('/uploads', auth(), upload.single('file'), async (req, res) => {
    const sourceType = str(req.body?.sourceType);
    const partner = str(req.body?.partner).trim();
    const clean = () => req.file && fs.rm(req.file.path, { force: true }, () => {});
    if (!req.file) throw fail(400, 'Choose a file');
    const name = path.basename(req.file.originalname);
    const ext = path.extname(name).toLowerCase();
    try {
      if (!SOURCES[sourceType] || !partner) throw fail(400, 'Choose the report type and partner');
      if (req.user.role === 'returns' && sourceType !== 'warehouse') throw fail(403, 'Your role can only upload warehouse scans');
      if (!['.csv', '.xlsx'].includes(ext)) throw fail(400, 'Only .csv and .xlsx files are supported');
      const tempPath = req.file.path + ext;
      fs.renameSync(req.file.path, tempPath);
      req.file.path = tempPath;
      const { headers, rows } = await readPreview(tempPath);
      const hash = await fileHash(tempPath);
      const seenBefore = await db.collection('uploads').findOne({ hash, sourceType, partner, status: 'imported' });
      const saved = await db.collection('mappings').find({ sourceType, partner }).sort({ version: -1 }).limit(1).next();
      let proposal; let formatChanged = false;
      if (saved && mappingFits(saved.columns, headers)) {
        proposal = { columns: saved.columns, confidence: {}, by: 'saved', version: saved.version };
      } else {
        formatChanged = !!saved;
        proposal = await suggestMapping(sourceType, headers, rows);
      }
      const { insertedId } = await db.collection('uploads').insertOne({ fileName: name, sourceType, partner, hash, tempPath, status: 'preview', by: req.user.email, createdAt: new Date() });
      res.json({ id: insertedId, fileName: name, headers, rows, proposal, formatChanged, savedColumns: saved?.columns ?? null, seenBefore: seenBefore ? { at: seenBefore.importedAt } : null });
    } catch (e) { clean(); throw e; }
  });

  // Shows the 20-row preview exactly as it would import, before anything is saved.
  r.post('/uploads/:id/preview', auth(), async (req, res) => {
    const up = await db.collection('uploads').findOne({ _id: oid(req.params.id), status: 'preview' });
    if (!up?.tempPath) throw fail(404, 'This upload has expired');
    const columns = req.body?.columns ?? {};
    const { rows } = await readPreview(up.tempPath);
    res.json({ rows: rows.map((rec) => transformRow(up.sourceType, rec, columns)) });
  });

  r.post('/uploads/:id/commit', auth(), async (req, res) => {
    const up = await db.collection('uploads').findOneAndUpdate({ _id: oid(req.params.id), status: 'preview' }, { $set: { status: 'importing' } });
    if (!up?.tempPath) throw fail(409, 'This upload was already processed');
    const columns = {};
    for (const f of SOURCES[up.sourceType].fields) {
      const c = str(req.body?.columns?.[f.key]);
      if (c) columns[f.key] = c;
    }
    const missing = SOURCES[up.sourceType].fields.filter((f) => f.required && !columns[f.key]);
    if (missing.length) {
      await db.collection('uploads').updateOne({ _id: up._id }, { $set: { status: 'preview' } });
      throw fail(400, `Map these required fields: ${missing.map((f) => f.label).join(', ')}`);
    }
    const last = await db.collection('mappings').find({ sourceType: up.sourceType, partner: up.partner }).sort({ version: -1 }).limit(1).next();
    if (!last || JSON.stringify(last.columns) !== JSON.stringify(columns)) {
      await db.collection('mappings').insertOne({ sourceType: up.sourceType, partner: up.partner, version: (last?.version ?? 0) + 1, columns, approvedBy: req.user.email, approvedAt: new Date(), proposedBy: str(req.body?.proposedBy) || 'manual' });
    }
    await audit(req, 'upload.approve', up.fileName, { sourceType: up.sourceType, partner: up.partner });
    const jobId = await startImportJob(db, { file: up.tempPath, sourceType: up.sourceType, partner: up.partner, columns, fileName: up.fileName, uploadId: up._id });
    res.json({ jobId });
  });

  r.get('/jobs/:id', auth(), async (req, res) => { oid(req.params.id); res.json(await jobById(db, req.params.id)); });
  r.get('/uploads', auth(), async (req, res) => {
    res.json(await db.collection('uploads').find({ status: { $ne: 'preview' } }, { projection: { hash: 0, tempPath: 0, 'stats.errors': 0 } }).sort({ createdAt: -1 }).limit(25).toArray());
  });

  r.get('/mappings', auth(), async (req, res) => {
    res.json(await db.collection('mappings').find({ sourceType: str(req.query.sourceType), partner: str(req.query.partner) }).sort({ version: -1 }).limit(20).toArray());
  });
  // ---------- Dashboard ----------
  r.get('/dashboard', auth(), async (req, res) => {
    const now = Date.now();
    const open = await db.collection('claims').find({ status: { $in: ['open', 'filed'] } }, { projection: { partner: 1, type: 1, amount: 1, ageFrom: 1, status: 1 } }).toArray();
    const partners = new Map(); const types = new Map(); let total = 0;
    for (const c of open) {
      total += c.amount;
      const age = Math.max(0, Math.floor((now - new Date(c.ageFrom)) / DAY));
      const b = BUCKETS.findIndex(([, lo, hi]) => age >= lo && age <= hi);
      if (!partners.has(c.partner)) partners.set(c.partner, { partner: c.partner, buckets: [0, 0, 0, 0], total: 0, count: 0 });
      const p = partners.get(c.partner);
      p.buckets[b] += c.amount; p.total += c.amount; p.count++;
      const t = types.get(c.type) ?? { type: c.type, amount: 0, count: 0 };
      t.amount += c.amount; t.count++; types.set(c.type, t);
    }
    const [rec] = await db.collection('claims').aggregate([{ $group: { _id: null, recovered: { $sum: '$recovered' } } }]).toArray();
    const [tax] = await db.collection('lines').aggregate([{ $match: { state: { $in: ['linked', 'manual'] }, sourceType: 'settlement' } }, { $group: { _id: null, tcs: { $sum: '$tcs' }, tds: { $sum: '$tds' } } }]).toArray();
    const statuses = await db.collection('orders').aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).toArray();
    const last = await db.collection('meta').findOne({ _id: 'lastRun' });
    const review = await db.collection('lines').countDocuments({ state: 'review' });
    const uploads = await db.collection('uploads').find({ status: 'imported' }).sort({ importedAt: -1 }).limit(1).next();
    res.json({
      total, count: open.length, buckets: BUCKETS.map((b) => b[0]),
      partners: [...partners.values()].sort((a, b) => b.total - a.total),
      types: [...types.values()].sort((a, b) => b.amount - a.amount),
      recovered: rec?.recovered ?? 0, target: RECOVERY_TARGET,
      tcs: tax?.tcs ?? 0, tds: tax?.tds ?? 0,
      statuses: Object.fromEntries(statuses.map((s) => [s._id, s.count])),
      autoMatchRate: last?.autoMatchRate ?? null, eligible: last?.eligible ?? 0, review, lastRun: last?.at ?? null, lastImport: uploads?.importedAt ?? null,
    });
  });

  // ---------- Orders ----------
  const safeOrder = (o, role) => ({
    ...o,
    customerName: role === 'cofounder' ? o.customerName : maskName(o.customerName),
    customerPhone: role === 'cofounder' ? o.customerPhone : maskPhone(o.customerPhone),
  });

  // status may be one value or a comma-separated list; sort is optional and whitelisted.
  const ORDER_SORTS = { orderDate: 'orderDate', value: 'value', expected: 'expected', received: 'received', gap: 'gap', orderId: 'orderId', freightExpected: 'freightExpected', freightCharged: 'freightCharged' };
  r.get('/orders', auth(FINANCE), async (req, res) => {
    const q = {};
    const status = str(req.query.status); const channel = str(req.query.channel); const search = str(req.query.q).trim();
    if (status) { const list = status.split(',').filter(Boolean); q.status = list.length > 1 ? { $in: list } : list[0]; }
    if (channel) q.channel = channel;
    if (str(req.query.issue)) q['issues.type'] = str(req.query.issue);
    if (str(req.query.freight) === 'billed') q.freightCharged = { $gt: 0 };
    if (search) q.$or = [{ orderId: search }, { awb: search }, { orderId: { $regex: `^${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` } }];
    const days = Number(req.query.days);
    if (Number.isFinite(days) && days > 0) q.orderDate = { $gte: new Date(Date.now() - days * DAY) };
    const sortKey = ORDER_SORTS[str(req.query.sort)]; const dir = str(req.query.dir) === 'asc' ? 1 : -1;
    const sort = sortKey ? { [sortKey]: dir, orderId: 1 } : { orderDate: -1, orderId: 1 };
    const page = Math.max(1, Number(req.query.page) || 1); const size = Math.min(100, Math.max(10, Number(req.query.size) || 50));
    const [rows, total, channels] = await Promise.all([
      db.collection('orders').find(q, { projection: { issues: 0, customerName: 0, customerPhone: 0 } }).sort(sort).skip((page - 1) * size).limit(size).toArray(),
      db.collection('orders').countDocuments(q),
      db.collection('orders').distinct('channel'),
    ]);
    res.json({ rows, total, page, size, channels });
  });

  r.get('/orders/:orderId', auth(FINANCE), async (req, res) => {
    const o = await db.collection('orders').findOne({ orderId: req.params.orderId });
    if (!o) throw fail(404, 'Order not found');
    const lines = await db.collection('lines').find({ linkedOrderId: o.orderId }, { projection: { lineKey: 0, suggestions: 0 } }).sort({ date: 1 }).toArray();
    const claims = await db.collection('claims').find({ orderId: o.orderId }).toArray();
    res.json({ order: safeOrder(o, req.user.role), lines, claims });
  });

  // ---------- Claims ----------
  const claimFilter = (req) => {
    const q = {};
    const status = str(req.query.status) || 'active';
    if (status === 'active') q.status = { $in: ['open', 'filed'] };
    else if (status !== 'all') q.status = status;
    if (str(req.query.partner)) q.partner = str(req.query.partner);
    if (str(req.query.type)) q.type = str(req.query.type);
    const min = Number(req.query.min);
    if (Number.isFinite(min) && min > 0) q.amount = { $gte: Math.round(min * 100) };
    const since = new Date(str(req.query.since) + 'T00:00:00Z');
    if (str(req.query.since) && !Number.isNaN(since.getTime())) q.ageFrom = { $gte: since };
    const search = str(req.query.q).trim();
    if (search) q.orderId = { $regex: `^${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` };
    if (req.user.role === 'returns') q.type = 'return_not_received';
    return q;
  };

  // Counts and amounts per claim status, for the claims summary cards.
  r.get('/claims/summary', auth(), async (req, res) => {
    const match = req.user.role === 'returns' ? { type: 'return_not_received' } : str(req.query.type) ? { type: str(req.query.type) } : {};
    const rows = await db.collection('claims').aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' }, recovered: { $sum: '$recovered' } } }]).toArray();
    res.json(Object.fromEntries(rows.map((x) => [x._id, { count: x.count, amount: x.amount, recovered: x.recovered }])));
  });

  r.get('/claims', auth(), async (req, res) => {
    const q = claimFilter(req);
    const page = Math.max(1, Number(req.query.page) || 1); const size = 50;
    const [rows, total, sum, partners] = await Promise.all([
      db.collection('claims').find(q).sort({ amount: -1 }).skip((page - 1) * size).limit(size).toArray(),
      db.collection('claims').countDocuments(q),
      db.collection('claims').aggregate([{ $match: q }, { $group: { _id: null, amount: { $sum: '$amount' } } }]).toArray(),
      db.collection('claims').distinct('partner'),
    ]);
    res.json({ rows, total, page, size, amount: sum[0]?.amount ?? 0, partners });
  });

  // Filing with the partner stays a human step; this only records what happened.
  r.patch('/claims/:id', auth(), async (req, res) => {
    const c = await db.collection('claims').findOne({ _id: oid(req.params.id) });
    if (!c) throw fail(404, 'Claim not found');
    if (req.user.role === 'returns' && c.type !== 'return_not_received') throw fail(403, 'Your role can only update return claims');
    const to = str(req.body?.status); const note = str(req.body?.note).slice(0, 500);
    const allowed = { open: ['filed', 'written_off'], filed: ['recovered', 'rejected', 'written_off'], rejected: ['written_off'] };
    if (!allowed[c.status]?.includes(to)) throw fail(409, `A claim that is ${c.status} can't become ${to}`);
    if (to === 'written_off') {
      if (req.user.role !== 'cofounder') throw fail(403, 'Only the co-founder can write off a claim');
      if (!note) throw fail(400, 'Add a reason for the write-off');
    }
    const set = { status: to, updatedAt: new Date() };
    if (to === 'recovered') {
      const rupees = Number(req.body?.recovered);
      if (!Number.isFinite(rupees) || rupees <= 0) throw fail(400, 'Enter the amount recovered');
      const paise = Math.round(rupees * 100);
      if (paise > c.amount) throw fail(400, 'Recovered amount is more than the claim');
      set.recovered = paise;
    }
    await db.collection('claims').updateOne({ _id: c._id }, { $set: set, $push: { history: { at: new Date(), by: req.user.email, from: c.status, to, note } } });
    await audit(req, `claim.${to}`, c.key, { note, recovered: set.recovered });
    res.json({ ok: true });
  });

  // Evidence export. Customer details are left out; the partner has the order ID.
  r.get('/claims/export.csv', auth(), async (req, res) => {
    const q = claimFilter(req);
    const claims = await db.collection('claims').find(q).sort({ partner: 1, amount: -1 }).limit(50000).toArray();
    const ids = claims.map((c) => c.orderId);
    const orders = new Map((await db.collection('orders').find({ orderId: { $in: ids } }, { projection: { orderId: 1, value: 1, mode: 1, expected: 1, calc: 1, received: 1, tcs: 1, tds: 1, awb: 1, weight: 1, freightExpected: 1, freightCharged: 1, orderDate: 1 } }).toArray()).map((o) => [o.orderId, o]));
    const lines = new Map();
    for (const l of await db.collection('lines').find({ linkedOrderId: { $in: ids } }, { projection: { linkedOrderId: 1, sourceType: 1, partner: 1, amount: 1, reference: 1, date: 1, sourceFile: 1, sourceRow: 1, chargedWeight: 1 } }).toArray()) {
      if (!lines.has(l.linkedOrderId)) lines.set(l.linkedOrderId, []);
      lines.get(l.linkedOrderId).push(l);
    }
    const head = ['Partner', 'Issue', 'Order ID', 'AWB', 'Order date', 'Order value ₹', 'Payment', 'Expected ₹', 'Received incl. tax ₹', 'TCS ₹', 'TDS ₹', 'Freight expected ₹', 'Freight charged ₹', 'Declared kg', 'Claim ₹', 'Basis', 'Claim detail', 'Evidence type', 'Evidence ref', 'Evidence date', 'Evidence ₹', 'Billed kg', 'Source file', 'Source row'];
    const out = [head.join(',')];
    for (const c of claims) {
      const o = orders.get(c.orderId) ?? {};
      const base = [c.partner, c.type, c.orderId, o.awb, iso(o.orderDate), rs(o.value), o.mode, rs(o.expected), rs(o.received), rs(o.tcs), rs(o.tds), rs(o.freightExpected), rs(o.freightCharged), o.weight ? o.weight / 1000 : '', rs(c.amount), o.calc, c.detail];
      const ls = (lines.get(c.orderId) ?? []).filter((l) => EVIDENCE[c.type].includes(l.sourceType));
      if (!ls.length) out.push([...base, 'none found in uploaded files', '', '', '', '', '', ''].map(csvCell).join(','));
      for (const l of ls) out.push([...base, l.sourceType, l.reference, iso(l.date), rs(l.amount), l.chargedWeight ? l.chargedWeight / 1000 : '', l.sourceFile, l.sourceRow].map(csvCell).join(','));
    }
    await audit(req, 'claims.export', str(req.query.partner) || 'all', { count: claims.length });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="claims-evidence.csv"');
    res.send('﻿' + out.join('\n'));
  });

  // ---------- Returns ----------
  r.get('/returns', auth(), async (req, res) => {
    const view = str(req.query.view) || 'not_received';
    const q = { delivery: 'returned' };
    if (view !== 'all') q.returnStatus = view;
    const page = Math.max(1, Number(req.query.page) || 1); const size = 50;
    const projection = { orderId: 1, awb: 1, channel: 1, courier: 1, value: 1, returnedDate: 1, returnDueBy: 1, returnStatus: 1, scanDate: 1, scanCondition: 1 };
    const [rows, total, counts] = await Promise.all([
      db.collection('orders').find(q, { projection }).sort({ returnDueBy: 1 }).skip((page - 1) * size).limit(size).toArray(),
      db.collection('orders').countDocuments(q),
      db.collection('orders').aggregate([{ $match: { delivery: 'returned' } }, { $group: { _id: '$returnStatus', count: { $sum: 1 }, value: { $sum: '$value' } } }]).toArray(),
    ]);
    res.json({ rows, total, page, size, counts: Object.fromEntries(counts.map((c) => [c._id, c])) });
  });

  // ---------- Review queue: never closes anything without a person ----------
  r.get('/review', auth(FINANCE), async (req, res) => {
    const rows = await db.collection('lines').find({ state: 'review' }, { projection: { lineKey: 0 } }).sort({ date: -1 }).limit(100).toArray();
    const total = await db.collection('lines').countDocuments({ state: 'review' });
    res.json({ rows, total });
  });
  r.post('/review/:id/approve', auth(FINANCE), async (req, res) => {
    const orderId = str(req.body?.orderId).trim();
    if (!(await db.collection('orders').findOne({ orderId }))) throw fail(400, 'That order ID does not exist');
    const u = await db.collection('lines').updateOne({ _id: oid(req.params.id), state: 'review' }, { $set: { manualOrderId: orderId, reviewedBy: req.user.email, reviewedAt: new Date() } });
    if (!u.matchedCount) throw fail(409, 'This line was already reviewed');
    await audit(req, 'review.approve', req.params.id, { orderId });
    await rematch(db);
    res.json({ ok: true });
  });
  r.post('/review/:id/reject', auth(FINANCE), async (req, res) => {
    const u = await db.collection('lines').updateOne({ _id: oid(req.params.id), state: 'review' }, { $set: { state: 'rejected', reviewedBy: req.user.email, reviewedAt: new Date() } });
    if (!u.matchedCount) throw fail(409, 'This line was already reviewed');
    await audit(req, 'review.reject', req.params.id, {});
    res.json({ ok: true });
  });

  // ---------- Rate cards: versioned by the date they take effect ----------
  r.get('/cards', auth(FINANCE), async (req, res) => {
    res.json(await db.collection('cards').find().sort({ kind: 1, partner: 1, effectiveFrom: -1 }).toArray());
  });
  r.post('/cards', auth(FINANCE), async (req, res) => {
    const b = req.body ?? {};
    const kind = str(b.kind); const partner = str(b.partner).trim();
    const effectiveFrom = new Date(str(b.effectiveFrom) + 'T00:00:00Z');
    if (!['channel', 'courier'].includes(kind) || !partner || Number.isNaN(effectiveFrom.getTime())) throw fail(400, 'Partner, type and effective date are needed');
    const int = (v, name, max = 1e9) => { const n = Number(v); if (!Number.isInteger(n) || n < 0 || n > max) throw fail(400, `${name} is not valid`); return n; };
    const doc = { kind, partner, effectiveFrom, createdBy: req.user.email, createdAt: new Date() };
    if (kind === 'channel') {
      Object.assign(doc, { codBp: int(b.codBp, 'COD fee', 10000), prepaidBp: int(b.prepaidBp, 'Prepaid fee', 10000), prepaidReturnBp: int(b.prepaidReturnBp, 'Return charge', 10000), fixedPaise: int(b.fixedPaise ?? 0, 'Fixed fee'), settlementDays: int(b.settlementDays, 'Settlement days', 365), codVia: b.codVia === 'courier' ? 'courier' : 'channel', roundToRupee: b.roundToRupee !== false });
    } else {
      const zones = {};
      for (const [z, v] of Object.entries(b.zones ?? {})) zones[z.toUpperCase().slice(0, 4)] = { base: int(v?.base, 'Zone base rate'), add: int(v?.add, 'Zone extra rate') };
      if (!Object.keys(zones).length) throw fail(400, 'Add at least one zone');
      Object.assign(doc, { remittanceDays: int(b.remittanceDays, 'Remittance days', 365), returnGraceDays: int(b.returnGraceDays, 'Return grace days', 365), rtoPaise: int(b.rtoPaise ?? 0, 'RTO charge'), zones });
    }
    await db.collection('cards').updateOne({ kind, partner, effectiveFrom }, { $set: doc }, { upsert: true });
    await audit(req, 'card.save', partner, { effectiveFrom });
    await rematch(db);
    res.json({ ok: true });
  });

  // ---------- TCS and TDS, shown separately from leakage ----------
  r.get('/tax', auth(FINANCE), async (req, res) => {
    const rows = await db.collection('lines').aggregate([
      { $match: { sourceType: 'settlement', state: { $in: ['linked', 'manual'] }, date: { $type: 'date' } } },
      { $group: { _id: { partner: '$partner', month: { $dateToString: { format: '%Y-%m', date: '$date' } } }, net: { $sum: '$amount' }, tcs: { $sum: '$tcs' }, tds: { $sum: '$tds' }, lines: { $sum: 1 } } },
      { $sort: { '_id.month': -1, '_id.partner': 1 } },
    ]).toArray();
    res.json(rows.map((x) => ({ partner: x._id.partner, month: x._id.month, net: x.net, tcs: x.tcs, tds: x.tds, lines: x.lines })));
  });

  // ---------- Overview: read-only roll-up of stored results for a date range ----------
  // Reads the status, expected and received values the matcher already stored.
  // Nothing is recalculated here.
  const EXCEPTION = ['short_paid', 'unpaid_past_due', 'freight_overcharged', 'return_not_received', 'overpaid', 'missing_rate_card'];
  r.get('/overview', auth(), async (req, res) => {
    const now = Date.now();
    const asDate = (s) => { const d = new Date(str(s) + 'T00:00:00Z'); return Number.isNaN(d.getTime()) ? null : d; };
    const customFrom = asDate(req.query.from); const customTo = asDate(req.query.to);
    let days = Number(req.query.days);
    let end = new Date(now); let start = null;
    if (customFrom) {
      end = customTo ? new Date(customTo.getTime() + DAY) : new Date(now);
      if (end <= customFrom) throw fail(400, 'The end date must be after the start date');
      start = customFrom; days = Math.round((end - start) / DAY);
    } else if (Number.isFinite(days) && days > 0) start = new Date(now - days * DAY);
    const ranged = !!start;
    const channel = str(req.query.channel);
    const prevStart = ranged ? new Date(start.getTime() - (end - start)) : null;
    const q = {};
    if (ranged) q.orderDate = { $gte: prevStart, $lt: end };
    if (channel) q.channel = channel;
    const orders = await db.collection('orders').find(q, { projection: { _id: 0, orderId: 1, orderDate: 1, status: 1, channel: 1, expected: 1, received: 1, gap: 1, value: 1 } }).toArray();

    const blank = () => ({ orders: 0, eligible: 0, settled: 0, exceptions: 0, reconciled: 0, expected: 0, received: 0, gap: 0, statuses: {} });
    const cur = blank(); const prev = blank(); const byChannel = new Map(); const inRange = new Set();
    let first = null;
    for (const o of orders) {
      const t = o.orderDate ? new Date(o.orderDate).getTime() : 0;
      const isCur = !ranged || (t >= start.getTime() && t < end.getTime());
      const s = isCur ? cur : prev;
      if (isCur) { inRange.add(o.orderId); if (t && (!first || t < first)) first = t; }
      s.orders++;
      const st = s.statuses[o.status] ?? (s.statuses[o.status] = { count: 0, amount: 0 });
      st.count++;
      if (o.gap) st.amount += Math.abs(o.gap);
      if (!['pending', 'cancelled'].includes(o.status)) s.eligible++;
      if (o.status === 'settled') { s.settled++; s.reconciled += o.received ?? 0; }
      if (EXCEPTION.includes(o.status)) s.exceptions++;
      if (o.expected !== null && o.expected !== undefined) s.expected += o.expected;
      s.received += o.received ?? 0;
      if (o.gap < 0) s.gap += o.gap;
      if (isCur) {
        const c = byChannel.get(o.channel) ?? { channel: o.channel, orders: 0, eligible: 0, settled: 0, exceptions: 0, expected: 0, received: 0, shortfall: 0 };
        c.orders++;
        if (!['pending', 'cancelled'].includes(o.status)) c.eligible++;
        if (o.status === 'settled') c.settled++;
        if (EXCEPTION.includes(o.status)) c.exceptions++;
        c.expected += o.expected ?? 0; c.received += o.received ?? 0;
        if (o.gap < 0) c.shortfall += o.gap;
        byChannel.set(o.channel, c);
      }
    }

    // Trend buckets: days for a week, weeks up to a quarter, months beyond.
    const spanDays = ranged ? days : Math.max(1, Math.ceil((now - (first ?? now)) / DAY));
    const unit = spanDays <= 14 ? 'day' : spanDays <= 120 ? 'week' : 'month';
    const bucketOf = (t) => {
      const d = new Date(t);
      if (unit === 'day') return d.toISOString().slice(0, 10);
      if (unit === 'week') { const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))); return m.toISOString().slice(0, 10); }
      return d.toISOString().slice(0, 7);
    };
    const trend = new Map();
    for (const o of orders) {
      if (!o.orderDate || !inRange.has(o.orderId)) continue;
      const k = bucketOf(new Date(o.orderDate).getTime());
      const b = trend.get(k) ?? { bucket: k, total: 0 };
      b[o.status] = (b[o.status] ?? 0) + 1; b.total++;
      trend.set(k, b);
    }

    // Claims: open ones are a live snapshot; recoveries are dated by when they were recorded.
    const claimMatch = req.user.role === 'returns' ? { type: 'return_not_received' } : {};
    const active = await db.collection('claims').find({ ...claimMatch, status: { $in: ['open', 'filed'] } }, { projection: { orderId: 1, partner: 1, type: 1, amount: 1, ageFrom: 1, status: 1, detail: 1 } }).sort({ amount: -1 }).toArray();
    const recoveredIn = async (from, to) => {
      const m = { ...claimMatch, status: 'recovered' };
      if (from) m.updatedAt = { $gte: from, ...(to ? { $lt: to } : {}) };
      const [x] = await db.collection('claims').aggregate([{ $match: m }, { $group: { _id: null, amount: { $sum: '$recovered' }, count: { $sum: 1 } } }]).toArray();
      return { amount: x?.amount ?? 0, count: x?.count ?? 0 };
    };
    const recovered = await recoveredIn(start, customFrom ? end : null);
    const recoveredPrev = ranged ? await recoveredIn(prevStart, start) : null;

    const scoped = active.filter((c) => (!ranged && !channel) || inRange.has(c.orderId));
    const top = scoped.slice(0, 8);
    const topOrders = new Map((await db.collection('orders').find({ orderId: { $in: top.map((c) => c.orderId) } }, { projection: { _id: 0, orderId: 1, orderDate: 1, channel: 1, expected: 1, received: 1, gap: 1, freightExpected: 1, freightCharged: 1, value: 1 } }).toArray()).map((o) => [o.orderId, o]));
    const exceptions = top.map((c) => ({ ...c, order: topOrders.get(c.orderId) ?? null }));

    const last = await db.collection('meta').findOne({ _id: 'lastRun' });
    const review = await db.collection('lines').countDocuments({ state: 'review' });
    res.json({
      range: { days: ranged ? days : null, from: start, to: end, prevFrom: prevStart, unit, channel: channel || null },
      target: RECOVERY_TARGET,
      current: cur, previous: ranged ? prev : null,
      openClaims: { count: scoped.length, amount: scoped.reduce((t, c) => t + c.amount, 0), toFile: scoped.filter((c) => c.status === 'open').length },
      recovered, recoveredPrev,
      trend: [...trend.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)),
      byChannel: [...byChannel.values()].sort((a, b) => b.orders - a.orders),
      exceptions, review, lastRun: last?.at ?? null, autoMatchRate: last?.autoMatchRate ?? null,
    });
  });

  // ---------- Audit log: read-only view of what people did ----------
  r.get('/audit', auth(FINANCE), async (req, res) => {
    const q = {};
    const action = str(req.query.action); const by = str(req.query.by);
    if (action) q.action = { $regex: `^${action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` };
    if (by) q.by = by;
    const page = Math.max(1, Number(req.query.page) || 1); const size = Math.min(100, Math.max(5, Number(req.query.size) || 50));
    const [rows, total, users] = await Promise.all([
      db.collection('audit').find(q).sort({ at: -1 }).skip((page - 1) * size).limit(size).toArray(),
      db.collection('audit').countDocuments(q),
      db.collection('audit').distinct('by'),
    ]);
    res.json({ rows, total, page, size, users: users.filter(Boolean) });
  });

  // ---------- Badge counts for navigation and notifications ----------
  r.get('/counts', auth(), async (req, res) => {
    const finance = FINANCE.includes(req.user.role);
    const claimQ = req.user.role === 'returns' ? { type: 'return_not_received', status: 'open' } : { status: 'open' };
    const [review, toFile, failed, missingReturns, noRate] = await Promise.all([
      finance ? db.collection('lines').countDocuments({ state: 'review' }) : 0,
      db.collection('claims').countDocuments(claimQ),
      db.collection('uploads').countDocuments({ status: 'failed' }),
      db.collection('orders').countDocuments({ delivery: 'returned', returnStatus: 'not_received' }),
      finance ? db.collection('orders').countDocuments({ status: 'missing_rate_card' }) : 0,
    ]);
    const last = await db.collection('uploads').find({ status: 'imported' }).sort({ importedAt: -1 }).limit(1).next();
    res.json({ review, toFile, failedUploads: failed, missingReturns, noRateCard: noRate, lastImport: last?.importedAt ?? null });
  });

  // ---------- Team: read-only list of who can sign in ----------
  r.get('/users', auth(FINANCE), async (req, res) => {
    res.json(await db.collection('users').find({}, { projection: { passwordHash: 0 } }).sort({ role: 1, name: 1 }).toArray());
  });

  return r;
}
