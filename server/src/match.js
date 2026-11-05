import { reconcileOrder, cardFor, expectedPayment } from './engine.js';

const OPEN = new Set(['open', 'filed']);
const resultFields = ['status', 'expected', 'calc', 'net', 'tcs', 'tds', 'received', 'gap', 'freightExpected', 'freightCharged', 'returnStatus', 'returnDueBy', 'scanDate', 'scanCondition', 'issues', 'flags', 'dueDate', 'payPartner', 'manual'];
const snap = (o) => JSON.stringify(resultFields.map((f) => o[f] ?? null));
const compact = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function bulk(col, ops, size = 5000) {
  for (let i = 0; i < ops.length; i += size) await col.bulkWrite(ops.slice(i, i + size), { ordered: false });
}

// Scores possible orders for a line with no usable ID. These are only proposals:
// they go to the review queue and a person must approve each one.
export function suggestCandidates(line, ctx) {
  const scored = new Map();
  const add = (o, s, why) => {
    const cur = scored.get(o.orderId) ?? { orderId: o.orderId, score: 0, why: [] };
    cur.score += s; cur.why.push(why);
    scored.set(o.orderId, cur);
  };
  const id = compact(line.orderId);
  if (id.length >= 5) {
    for (const o of ctx.byDigits.get(id.replace(/\D/g, '').slice(-6)) ?? []) add(o, 60, `ID looks like ${o.orderId}`);
  }
  if (line.amount && line.sourceType !== 'freight') {
    for (const o of ctx.byExpected.get(line.amount) ?? []) {
      if (ctx.hasPayment.has(o.orderId)) continue;
      const days = line.date ? Math.abs(line.date - (o.deliveredDate ?? o.orderDate)) / 86400000 : 99;
      if (days > 30) continue;
      add(o, 30 + (days <= 10 ? 10 : 0), 'Amount matches the expected payment');
    }
  }
  return [...scored.values()].sort((a, b) => b.score - a.score).slice(0, 3).map((c) => ({ ...c, score: Math.min(c.score, 95) }));
}

export async function runMatch(db, asOf = new Date()) {
  const started = Date.now();
  const cards = await db.collection('cards').find().toArray();
  const orders = await db.collection('orders').find().toArray();
  const lines = await db.collection('lines').find({}, { projection: { createdAt: 0, uploadId: 0 } }).toArray();

  const byId = new Map(orders.map((o) => [o.orderId, o]));
  const byAwb = new Map();
  for (const o of orders) if (o.awb) byAwb.set(o.awb, o);

  const linesByOrder = new Map();
  const lineOps = []; const unmatched = [];
  const hasPayment = new Set();
  for (const l of lines) {
    if (l.state === 'rejected') continue;
    let order = null; let manual = false;
    if (l.manualOrderId) { order = byId.get(l.manualOrderId); manual = !!order; }
    if (!order && l.orderId) order = byId.get(l.orderId);
    if (!order && l.awb) order = byAwb.get(l.awb);
    if (!order) { unmatched.push(l); continue; }
    const state = manual ? 'manual' : 'linked';
    if (l.state !== state || l.linkedOrderId !== order.orderId) {
      lineOps.push({ updateOne: { filter: { _id: l._id }, update: { $set: { state, linkedOrderId: order.orderId }, $unset: { suggestions: '' } } } });
    }
    if (!linesByOrder.has(order.orderId)) linesByOrder.set(order.orderId, []);
    linesByOrder.get(order.orderId).push(l);
    if (l.sourceType === 'settlement' || l.sourceType === 'cod') hasPayment.add(order.orderId);
  }

  const orderOps = []; const issues = new Map();
  let auto = 0; let eligible = 0;
  for (const o of orders) {
    const ls = linesByOrder.get(o.orderId) ?? [];
    const r = reconcileOrder(o, ls, cards, asOf);
    r.manual = ls.some((l) => l.manualOrderId === o.orderId);
    if (!['pending', 'cancelled'].includes(r.status)) {
      eligible++;
      if (!r.manual && r.status !== 'missing_rate_card') auto++;
    }
    for (const i of r.issues) issues.set(`${o.orderId}|${i.type}`, { ...i, orderId: o.orderId, channel: o.channel });
    if (snap(o) !== snap(r)) orderOps.push({ updateOne: { filter: { _id: o._id }, update: { $set: Object.fromEntries(resultFields.map((f) => [f, r[f] ?? null])) } } });
    o._r = r;
  }

  // Suggestions for lines that could not be tied to an order.
  const byDigits = new Map(); const byExpected = new Map();
  if (unmatched.length) {
    for (const o of orders) {
      const d = compact(o.orderId).replace(/\D/g, '').slice(-6);
      if (d) { if (!byDigits.has(d)) byDigits.set(d, []); byDigits.get(d).push(o); }
      const card = cardFor(cards, 'channel', o.channel, o.orderDate);
      if (card && o.delivery === 'delivered') {
        const e = expectedPayment(o, card).amount;
        if (!byExpected.has(e)) byExpected.set(e, []);
        byExpected.get(e).push(o);
      }
    }
    const ctx = { byDigits, byExpected, hasPayment };
    for (const l of unmatched) {
      lineOps.push({ updateOne: { filter: { _id: l._id }, update: { $set: { state: 'review', linkedOrderId: null, suggestions: suggestCandidates(l, ctx) } } } });
    }
  }

  // Claims keep what people did to them. A claim someone closed is never changed,
  // and one whose gap disappeared is resolved rather than deleted.
  const claims = await db.collection('claims').find({}, { projection: { key: 1, status: 1, amount: 1, ageFrom: 1 } }).toArray();
  const existing = new Map(claims.map((c) => [c.key, c]));
  const now = new Date(); const claimOps = [];
  for (const [key, i] of issues) {
    const c = existing.get(key);
    if (!c) {
      claimOps.push({ insertOne: { document: { key, orderId: i.orderId, type: i.type, partner: i.partner, channel: i.channel, amount: i.amount, ageFrom: i.ageFrom, detail: i.detail, status: 'open', recovered: 0, createdAt: now, updatedAt: now, history: [] } } });
    } else if (OPEN.has(c.status) || c.status === 'resolved') {
      const reopened = c.status === 'resolved';
      if (reopened || c.amount !== i.amount) {
        claimOps.push({ updateOne: { filter: { _id: c._id }, update: { $set: { amount: i.amount, ageFrom: i.ageFrom, detail: i.detail, partner: i.partner, updatedAt: now, ...(reopened ? { status: 'open' } : {}) }, ...(reopened ? { $push: { history: { at: now, by: 'system', to: 'open', note: 'The gap came back after new files' } } } : {}) } } });
      }
    }
  }
  for (const c of claims) {
    if (!issues.has(c.key) && OPEN.has(c.status)) {
      claimOps.push({ updateOne: { filter: { _id: c._id }, update: { $set: { status: 'resolved', updatedAt: now }, $push: { history: { at: now, by: 'system', to: 'resolved', note: 'New files closed this gap' } } } } });
    }
  }

  await bulk(db.collection('lines'), lineOps);
  await bulk(db.collection('orders'), orderOps);
  await bulk(db.collection('claims'), claimOps);

  const summary = {
    at: now, orders: orders.length, lines: lines.length, eligible, auto, review: unmatched.length,
    // A line waiting for review may belong to an eligible order, so it counts against the rate.
    autoMatchRate: eligible ? Math.max(0, auto - unmatched.length) / eligible : null,
    ms: Date.now() - started,
  };
  await db.collection('meta').updateOne({ _id: 'lastRun' }, { $set: summary }, { upsert: true });
  return summary;
}
