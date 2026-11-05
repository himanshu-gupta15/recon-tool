import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from 'csv-parse';
import ExcelJS from 'exceljs';
import { SOURCES, transformRow } from './schemas.js';
import { normalizeDelivery } from './parse.js';

const dedupeHeaders = (raw) => {
  const seen = new Map();
  return raw.map((h, i) => {
    const base = String(h ?? '').trim() || `Column ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
};

const cellValue = (v) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result);
    if ('text' in v) return v.text;
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    return '';
  }
  return v;
};

// Yields { row, record }, where row is the line number in the partner's file.
export async function* readRows(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.csv') {
    let headers = null;
    const parser = fs.createReadStream(file).pipe(parse({ bom: true, trim: true, skip_empty_lines: true, relax_column_count: true, info: true }));
    for await (const { record, info } of parser) {
      if (!headers) { headers = dedupeHeaders(record); yield { headers }; continue; }
      const obj = {};
      for (let i = 0; i < headers.length; i++) obj[headers[i]] = record[i] ?? '';
      yield { row: info.lines, record: obj };
    }
    return;
  }
  if (ext === '.xlsx') {
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, { sharedStrings: 'cache', hyperlinks: 'ignore', worksheets: 'emit', styles: 'cache' });
    for await (const sheet of reader) {
      let headers = null;
      for await (const r of sheet) {
        const values = (r.values || []).slice(1).map(cellValue);
        if (!values.some((v) => v !== '')) continue;
        if (!headers) { headers = dedupeHeaders(values); yield { headers }; continue; }
        const obj = {};
        for (let i = 0; i < headers.length; i++) obj[headers[i]] = values[i] ?? '';
        yield { row: r.number, record: obj };
      }
      return; // first sheet only
    }
    return;
  }
  throw new Error('Only .csv and .xlsx files are supported');
}

export async function readPreview(file, limit = 20) {
  let headers = null; const rows = [];
  for await (const item of readRows(file)) {
    if (item.headers) { headers = item.headers; continue; }
    rows.push(item.record);
    if (rows.length >= limit) break;
  }
  if (!headers) throw new Error('The file is empty');
  return { headers, rows };
}

export const fileHash = (file) => new Promise((res, rej) => {
  const h = crypto.createHash('sha256');
  fs.createReadStream(file).on('data', (d) => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej);
});

// The same statement line uploaded twice must not count as two payments, so the
// key is built from what the line says, not from which file it arrived in.
export const lineKey = (sourceType, partner, d) => crypto.createHash('sha1')
  .update([sourceType, partner, d.reference, d.orderId, d.awb, d.amount, d.date?.toISOString?.()].join('|')).digest('base64');

const BATCH = 5000;
const MAX_REJECT_SHARE = 0.5;

export async function commitFile(db, { file, sourceType, partner, columns, fileName, uploadId }) {
  const stats = { rows: 0, stored: 0, duplicates: 0, rejected: 0, errors: [] };
  const col = db.collection(sourceType === 'orders' ? 'orders' : 'lines');
  const now = new Date();
  const seenInFile = new Set();
  let ops = [];

  // A first pass over the file means a wrong mapping writes nothing.
  for await (const item of readRows(file)) {
    if (item.headers) continue;
    stats.rows++;
    if (transformRow(sourceType, item.record, columns).errors.length) stats.rejected++;
  }
  if (!stats.rows) throw new Error('The file has no data rows');
  if (stats.rejected / stats.rows > MAX_REJECT_SHARE) {
    throw new Error(`${stats.rejected} of ${stats.rows} rows could not be read, so nothing was imported. Check the column mapping.`);
  }
  stats.rejected = 0;

  const flush = async () => {
    if (!ops.length) return;
    const r = await col.bulkWrite(ops, { ordered: false });
    stats.stored += r.upsertedCount + r.modifiedCount;
    ops = [];
  };

  for await (const item of readRows(file)) {
    if (item.headers) continue;
    const { doc, errors } = transformRow(sourceType, item.record, columns);
    if (errors.length) {
      stats.rejected++;
      if (stats.errors.length < 200) stats.errors.push({ row: item.row, errors });
      continue;
    }
    if (sourceType === 'orders') {
      if (seenInFile.has(doc.orderId)) { stats.duplicates++; }
      seenInFile.add(doc.orderId);
      doc.delivery = normalizeDelivery(doc.deliveryStatus);
      ops.push({ updateOne: { filter: { orderId: doc.orderId }, update: { $set: { ...doc, sourceFile: fileName, sourceRow: item.row, updatedAt: now }, $setOnInsert: { createdAt: now, status: 'pending' } }, upsert: true } });
    } else {
      const k = lineKey(sourceType, partner, doc);
      if (seenInFile.has(k)) { stats.duplicates++; continue; }
      seenInFile.add(k);
      ops.push({ updateOne: { filter: { lineKey: k }, update: { $set: { sourceFile: fileName, sourceRow: item.row, uploadId }, $setOnInsert: { ...doc, lineKey: k, sourceType, partner, state: 'new', createdAt: now } }, upsert: true } });
    }
    if (ops.length >= BATCH) await flush();
  }
  await flush();
  return stats;
}

export { SOURCES };
