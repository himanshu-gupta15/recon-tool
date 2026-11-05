import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { readPreview, readRows, lineKey } from '../src/ingest.js';
import { transformRow } from '../src/schemas.js';
import { suggestMapping } from '../src/mapping.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('xlsx: reads headers, dates, numbers and formula results', async () => {
  const file = path.join(dir, 'a.xlsx');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');
  ws.addRow(['Order ID', 'Net Payable', 'Settlement Date']);
  ws.addRow(['ORD-1', 899, new Date(Date.UTC(2026, 8, 5))]);
  ws.addRow(['ORD-2', { formula: '800+99', result: 899 }, new Date(Date.UTC(2026, 8, 6))]);
  await wb.xlsx.writeFile(file);

  const { headers, rows } = await readPreview(file);
  assert.deepEqual(headers, ['Order ID', 'Net Payable', 'Settlement Date']);
  assert.equal(rows.length, 2);
  const columns = { orderId: 'Order ID', amount: 'Net Payable', date: 'Settlement Date' };
  const a = transformRow('settlement', rows[0], columns);
  assert.deepEqual(a.errors, []);
  assert.equal(a.doc.amount, 89900);
  assert.equal(a.doc.date.toISOString().slice(0, 10), '2026-09-05');
  assert.equal(transformRow('settlement', rows[1], columns).doc.amount, 89900);
});

test('csv: handles a byte order mark, duplicate headers, short rows and quoted commas', async () => {
  const file = path.join(dir, 'b.csv');
  fs.writeFileSync(file, '﻿Order ID,Amount,Amount\nORD-1,"1,499.00",5\nORD-2\n');
  const seen = [];
  for await (const item of readRows(file)) seen.push(item);
  assert.deepEqual(seen[0].headers, ['Order ID', 'Amount', 'Amount (2)']);
  assert.equal(seen[1].record.Amount, '1,499.00');
  assert.equal(seen[1].row, 2);
  assert.equal(seen[2].record.Amount, '');
});

test('preview stops early on a large file', async () => {
  const file = path.join(dir, 'c.csv');
  fs.writeFileSync(file, 'a\n' + '1\n'.repeat(5000));
  assert.equal((await readPreview(file)).rows.length, 20);
});

test('a bad row reports its problem instead of importing a wrong value', () => {
  const { errors } = transformRow('settlement', { O: 'X', A: 'abc', D: '31/02/2026' }, { orderId: 'O', amount: 'A', date: 'D' });
  assert.equal(errors.length, 2);
});

test('the same statement line has the same key in any file', () => {
  const d = { reference: 'U1', orderId: 'O1', amount: 100, date: new Date('2026-01-01') };
  assert.equal(lineKey('settlement', 'P', d), lineKey('settlement', 'P', { ...d }));
  assert.notEqual(lineKey('settlement', 'P', d), lineKey('settlement', 'P', { ...d, reference: 'U2' }));
});

test('column mapping falls back to rules when the AI call fails', async () => {
  const saved = { key: process.env.ANTHROPIC_API_KEY, url: process.env.ANTHROPIC_BASE_URL };
  process.env.ANTHROPIC_API_KEY = 'invalid';
  process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:9'; // nothing listens here, so no data leaves the machine
  try {
    const r = await suggestMapping('cod', ['AWB Number', 'Remitted', 'Remitted On'], [{ 'AWB Number': 'A1', Remitted: '10', 'Remitted On': '01/01/2026' }]);
    assert.equal(r.by, 'rules');
    assert.equal(r.columns.amount, 'Remitted');
  } finally {
    if (saved.key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved.key;
    if (saved.url === undefined) delete process.env.ANTHROPIC_BASE_URL; else process.env.ANTHROPIC_BASE_URL = saved.url;
  }
});
