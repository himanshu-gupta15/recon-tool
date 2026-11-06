// Demo data, all invented. Files go through the same import path as real uploads.
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { connect, close } from './db.js';
import { commitFile } from './ingest.js';
import { runMatch } from './match.js';
import { expectedPayment, expectedFreight, DAY, pctOf } from './engine.js';

// A hosted demo opts in with ALLOW_DEMO_SEED. This wipes the database unless a finished seed is recorded in it.
const PRODUCTION = process.env.NODE_ENV === 'production';
if (PRODUCTION && !process.env.ALLOW_DEMO_SEED) throw new Error('Demo seed is not for production');
const DIR = path.resolve('seed-files');
const PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';
let s = 42;
const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
const ago = (n) => new Date(today.getTime() - n * DAY);
const ymd = (d) => d.toISOString().slice(0, 10);
const dmy = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
const rs = (p) => (p / 100).toFixed(2);

const from = new Date('2020-01-01T00:00:00Z');
// Illustrative rates. Website and Marketplace 1 are set so the brief's sample rows come out exactly.
const ch = (partner, codBp, prepaidBp, prepaidReturnBp, settlementDays, codVia = 'channel') => ({ kind: 'channel', partner, effectiveFrom: from, codBp, prepaidBp, prepaidReturnBp, fixedPaise: 0, settlementDays, codVia, roundToRupee: true });
const zones = (b) => ({ A: { base: b, add: b - 500 }, B: { base: b + 1000, add: b + 500 }, C: { base: b + 2500, add: b + 2000 } });
const cards = [
  ch('Website', 600, 200, 400, 3, 'courier'), ch('Marketplace 1', 2500, 2500, 500, 7), ch('Marketplace 2', 2200, 2200, 500, 7),
  ch('Marketplace 3', 2000, 2000, 500, 10), ch('Quick App 1', 3000, 3000, 500, 7), ch('Quick App 2', 2800, 2800, 500, 7),
  { kind: 'courier', partner: 'Courier Aggregator A', effectiveFrom: from, remittanceDays: 7, returnGraceDays: 7, rtoPaise: 5000, zones: zones(4000) },
  { kind: 'courier', partner: 'Courier Aggregator B', effectiveFrom: from, remittanceDays: 10, returnGraceDays: 7, rtoPaise: 6000, zones: zones(4500) },
];
const card = (p) => cards.find((c) => c.partner === p);

const orders = []; const settle = new Map(); const cod = new Map(); const freight = new Map(); const scans = [];
const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
let tally = { leakCOD: 0, short: 0, weight: 0, lost: 0, badId: 0 };

const samples = [
  { id: 'ORD-W-204118', channel: 'Website', value: 149900, mode: 'COD', status: 'Delivered', delivered: ago(30), skipPay: true },
  { id: 'ORD-M-88120', channel: 'Marketplace 1', value: 119900, mode: 'Prepaid', status: 'Delivered', delivered: ago(30), received: 86200 },
  { id: 'ORD-W-204377', channel: 'Website', value: 239800, mode: 'Prepaid', status: 'Returned to warehouse', returned: ago(30), received: -14200 },
];

function build(o) {
  orders.push(o);
  const courier = o.courier; const c = card(o.channel); const delivery = o.delivered ? 'delivered' : o.returned ? 'returned' : 'in_transit';
  const norm = { ...o, delivery };
  if (delivery !== 'in_transit') {
    const exp = expectedPayment(norm, c).amount;
    const viaCourier = o.mode === 'COD' && c.codVia === 'courier';
    const base = o.delivered ?? o.returned;
    const payDate = new Date(base.getTime() + (viaCourier ? 5 : c.settlementDays - 1) * DAY);
    if (payDate <= today && !(delivery === 'returned' && exp === 0)) {
      if (o.received !== undefined) push(settle, o.channel, { id: o.id, net: o.received, tcs: 0, tds: 0, date: payDate });
      else if (!(o.skipPay)) {
        const lessShort = o.short ?? 0;
        if (viaCourier) push(cod, courier, { id: o.badId ?? o.id, awb: o.badId ? '' : o.awb, amount: exp - lessShort, date: payDate });
        else {
          const taxable = exp > 0 && o.channel !== 'Website';
          const tcs = taxable ? pctOf(o.value, 50) : 0; const tds = taxable ? pctOf(o.value, 10) : 0;
          push(settle, o.channel, { id: o.id, net: exp - lessShort - tcs - tds, tcs, tds, date: payDate });
        }
      }
    }
    if (delivery === 'returned' && !o.lost && o.returned <= ago(1)) scans.push({ awb: o.awb, id: o.id, date: new Date(o.returned.getTime() + 2 * DAY), condition: rnd() < 0.08 ? 'Damaged' : 'Good' });
    const fx = expectedFreight(norm, card(courier));
    const billed = o.overWeight ? o.weight + 1000 : o.weight;
    const charged = expectedFreight({ ...norm, weight: billed }, card(courier));
    if (fx !== null) push(freight, courier, { awb: o.awb, id: o.id, charged, billed, date: new Date(base.getTime() + 3 * DAY) });
  }
}

for (const x of samples) build({ ...x, courier: 'Courier Aggregator A', awb: 'AWB' + x.id.slice(-6), date: ago(36), weight: 450, zone: 'A', name: 'Demo Customer', phone: '9000000000' });

const CHANNELS = [['Website', 0.55], ['Marketplace 1', 0.17], ['Marketplace 2', 0.1], ['Marketplace 3', 0.06], ['Quick App 1', 0.07], ['Quick App 2', 0.05]];
const N = 3000;
for (let i = 0; i < N; i++) {
  let r = rnd(); let channel = 'Website';
  for (const [c, w] of CHANNELS) { if (r < w) { channel = c; break; } r -= w; }
  const prefix = { Website: 'W', 'Marketplace 1': 'M', 'Marketplace 2': 'N', 'Marketplace 3': 'P', 'Quick App 1': 'Q', 'Quick App 2': 'R' }[channel];
  const age = 2 + Math.floor(rnd() * 110);
  const date = ago(age);
  const mode = channel === 'Website' && rnd() < 0.55 ? 'COD' : 'Prepaid';
  const courier = pick(['Courier Aggregator A', 'Courier Aggregator B']);
  const id = `ORD-${prefix}-${300000 + i}`;
  const o = { id, channel, mode, date, courier, awb: `AWB${7000000 + i}`, value: pick([79900, 99900, 119900, 149900, 179900, 239800, 299900]), weight: pick([300, 450, 700, 950, 1400, 1900]), zone: pick(['A', 'B', 'C']), name: pick(['Demo Customer', 'Sample Buyer', 'Test Shopper']), phone: `90000${String(10000 + i).slice(-5)}` };
  const transit = 3 + Math.floor(rnd() * 3);
  if (age <= transit) { o.status = 'In transit'; }
  else if (rnd() < 0.14) {
    o.status = 'RTO delivered'; o.returned = ago(age - transit);
    if (rnd() < 0.15) { o.lost = true; tally.lost++; }
  } else {
    o.status = 'Delivered'; o.delivered = ago(age - transit);
    const dice = rnd();
    if (mode === 'COD' && dice < 0.05) { o.skipPay = true; tally.leakCOD++; }
    else if (dice < 0.09) { o.short = pick([2500, 4500, 8000, 15000]); tally.short++; }
    else if (mode === 'COD' && dice < 0.11) { o.badId = `W${300000 + i}`; tally.badId++; }
  }
  if (rnd() < 0.06) { o.overWeight = true; tally.weight++; }
  build(o);
}

const write = (name, rows) => {
  const p = path.join(DIR, name);
  fs.writeFileSync(p, rows.map((r) => r.map((v) => (/[",]/.test(String(v)) ? `"${v}"` : v)).join(',')).join('\n') + '\n');
  return p;
};

const db = await connect();
if (PRODUCTION && await db.collection('meta').findOne({ _id: 'demoSeed' })) {
  console.log('Demo data already loaded, leaving it as it is');
  await close();
  process.exit(0);
}
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
for (const c of ['orders', 'lines', 'claims', 'cards', 'users', 'mappings', 'uploads', 'jobs', 'meta', 'audit']) await db.collection(c).deleteMany({});

const hash = await bcrypt.hash(PASSWORD, 10);
await db.collection('users').insertMany([
  { email: 'finance@demo.local', name: 'Finance Executive', role: 'finance', passwordHash: hash },
  { email: 'returns@demo.local', name: 'Returns Manager', role: 'returns', passwordHash: hash },
  { email: 'founder@demo.local', name: 'Finance Co-founder', role: 'cofounder', passwordHash: hash },
]);
await db.collection('cards').insertMany(cards.map((c) => ({ ...c, createdBy: 'seed', createdAt: new Date() })));

const files = [];
const add = (sourceType, partner, name, rows, columns) => files.push({ sourceType, partner, fileName: name, file: write(name, rows), columns });

add('orders', 'All channels', 'orders.csv', [
  ['Order ID', 'Channel', 'Order Value', 'Payment', 'Delivery Status', 'Order Date', 'Delivered Date', 'Returned Date', 'Courier', 'AWB', 'Weight (kg)', 'Zone', 'Customer Name', 'Phone', 'Address'],
  ...orders.map((o) => [o.id, o.channel, rs(o.value), o.mode, o.status, ymd(o.date), o.delivered ? ymd(o.delivered) : '', o.returned ? ymd(o.returned) : '', o.courier, o.awb, o.weight / 1000, o.zone, o.name, o.phone, 'not stored by the tool']),
], { orderId: 'Order ID', channel: 'Channel', value: 'Order Value', mode: 'Payment', deliveryStatus: 'Delivery Status', orderDate: 'Order Date', deliveredDate: 'Delivered Date', returnedDate: 'Returned Date', courier: 'Courier', awb: 'AWB', weight: 'Weight (kg)', zone: 'Zone', customerName: 'Customer Name', customerPhone: 'Phone' });

// Partners name and format their columns differently, including day-first dates.
for (const [partner, rows] of settle) {
  const slug = partner.toLowerCase().replace(/\s+/g, '-');
  add('settlement', partner, `settlement-${slug}.csv`, [
    ['Order Item ID', 'Net Payable', 'GST TCS', 'TDS u/s 194-O', 'UTR', 'Settlement Date'],
    ...rows.map((x, i) => [x.id, rs(x.net), rs(x.tcs), rs(x.tds), `UTR${slug.slice(0, 3).toUpperCase()}${Math.floor(i / 200) + 1000}`, dmy(x.date)]),
  ], { orderId: 'Order Item ID', amount: 'Net Payable', tcs: 'GST TCS', tds: 'TDS u/s 194-O', reference: 'UTR', date: 'Settlement Date' });
}
for (const [partner, rows] of cod) {
  const slug = partner.slice(-1).toLowerCase();
  add('cod', partner, `cod-remittance-courier-${slug}.csv`, [
    ['Shipment Ref', 'AWB Number', 'Remitted', 'CRF ID', 'Remitted On'],
    ...rows.map((x, i) => [x.id, x.awb, rs(x.amount), `CRF${Math.floor(i / 150) + 500}`, dmy(x.date)]),
  ], { orderId: 'Shipment Ref', awb: 'AWB Number', amount: 'Remitted', reference: 'CRF ID', date: 'Remitted On' });
}
for (const [partner, rows] of freight) {
  const slug = partner.slice(-1).toLowerCase();
  add('freight', partner, `freight-invoice-courier-${slug}.csv`, [
    ['AWB', 'Billed Weight (kg)', 'Total Freight', 'Invoice No', 'Invoice Date'],
    ...rows.map((x, i) => [x.awb, x.billed / 1000, rs(x.charged), `INV-${Math.floor(i / 400) + 100}`, ymd(x.date)]),
  ], { awb: 'AWB', chargedWeight: 'Billed Weight (kg)', amount: 'Total Freight', reference: 'Invoice No', date: 'Invoice Date' });
}
add('warehouse', 'Warehouse', 'warehouse-scans.csv', [
  ['Tracking Number', 'Received On', 'QC Status'],
  ...scans.map((x) => [x.awb, ymd(x.date), x.condition]),
], { awb: 'Tracking Number', date: 'Received On', condition: 'QC Status' });

for (const f of files) {
  const { insertedId } = await db.collection('uploads').insertOne({ fileName: f.fileName, sourceType: f.sourceType, partner: f.partner, status: 'imported', by: 'seed', createdAt: new Date(), importedAt: new Date() });
  const stats = await commitFile(db, { ...f, uploadId: insertedId });
  await db.collection('uploads').updateOne({ _id: insertedId }, { $set: { stats } });
  await db.collection('mappings').insertOne({ sourceType: f.sourceType, partner: f.partner, version: 1, columns: f.columns, approvedBy: 'seed', approvedAt: new Date(), proposedBy: 'seed' });
}

// For trying the "partner changed its format" flow by hand. Not imported.
write('try-me-courier-a-new-format.csv', [
  ['Order Reference', 'Tracking Number', 'Net Remitted', 'Batch ID', 'Credited On'],
  ...(cod.get('Courier Aggregator A') ?? []).slice(0, 40).map((x, i) => [x.id, x.awb, rs(x.amount), `NEW${i}`, dmy(x.date)]),
]);

const summary = await runMatch(db);
await db.collection('meta').insertOne({ _id: 'demoSeed', at: new Date() });
console.log('Injected:', tally, '\nMatch run:', summary, '\nSign in with finance@demo.local, returns@demo.local or founder@demo.local');
await close();
