// Times a real 1 lakh row settlement file through import and matching on a separate database.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DB_NAME = 'recon_perf';
const { connect, close } = await import('../src/db.js');
const { commitFile } = await import('../src/ingest.js');
const { runMatch } = await import('../src/match.js');

const db = await connect();
for (const c of ['orders', 'lines', 'claims', 'cards', 'meta']) await db.collection(c).deleteMany({});
await db.collection('cards').insertOne({ kind: 'channel', partner: 'M', effectiveFrom: new Date('2020-01-01'), codBp: 2500, prepaidBp: 2500, prepaidReturnBp: 500, settlementDays: 7, roundToRupee: true });
const N = 100000; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-'));
const o = fs.createWriteStream(path.join(dir, 'o.csv')); const l = fs.createWriteStream(path.join(dir, 'l.csv'));
o.write('id,ch,v,m,s,d\n'); l.write('id,net,utr,d\n');
for (let i = 0; i < N; i++) {
  o.write(`ORD-${i},M,1199.00,Prepaid,Delivered,2026-08-01\n`);
  l.write(`ORD-${i},${i % 50 === 0 ? '862.00' : '899.00'},U${i % 500},05/09/2026\n`);
}
await Promise.all([new Promise((r) => o.end(r)), new Promise((r) => l.end(r))]);
const ti = Date.now();
await commitFile(db, { file: path.join(dir, 'o.csv'), sourceType: 'orders', partner: 'All', fileName: 'o.csv', columns: { orderId: 'id', channel: 'ch', value: 'v', mode: 'm', deliveryStatus: 's', orderDate: 'd' } });
console.log('Setup: orders imported in', (Date.now() - ti) / 1000, 's');
const t0 = Date.now();
const st = await commitFile(db, { file: path.join(dir, 'l.csv'), sourceType: 'settlement', partner: 'M', fileName: 'l.csv', columns: { orderId: 'id', amount: 'net', reference: 'utr', date: 'd' } });
const t1 = Date.now();
const m = await runMatch(db);
const t2 = Date.now();
console.log({ rows: st.rows, stored: st.stored, importSec: (t1 - t0) / 1000, matchSec: (t2 - t1) / 1000, totalSec: (t2 - t0) / 1000, claims: await db.collection('claims').countDocuments() });
await db.dropDatabase(); fs.rmSync(dir, { recursive: true, force: true });
await close();
