import { day } from '@/lib/format';

export const STEPS = ['Upload file', 'Detect type', 'Map columns', 'Preview', 'Approve', 'Import', 'Results'];
export const MAX_BYTES = 60 * 1024 * 1024;

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');

// Header keywords that point to a report type. Order matters: the most specific first.
const SIGNALS = [
  ['cod', /remit|crf|cod amount|collected/],
  ['freight', /freight|billed weight|charged weight|chargeable|invoice no/],
  ['settlement', /net payable|settlement|payout|tcs|tds|194/],
  ['warehouse', /qc|scan|grn|received on|condition/],
  ['orders', /delivery status|order value|payment mode|order date|customer/],
];

// Reads the header row of a CSV so the type can be detected from its columns.
export async function readCsvHeader(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) return null;
  const text = await file.slice(0, 4096).text();
  return text.replace(/^\ufeff/, '').split(/\r?\n/)[0] ?? null;
}

// A hint from the header row, then the file name. The user always confirms.
export function guessSource(fileName, partnersBySource, header) {
  const n = fileName.toLowerCase();
  let type = ''; let from = '';
  const h = (header ?? '').toLowerCase();
  if (h) { const hit = SIGNALS.find(([, re]) => re.test(h)); if (hit) { type = hit[0]; from = 'columns'; } }
  if (!type) {
    if (/settle|payout/.test(n)) type = 'settlement';
    else if (/cod|remit/.test(n)) type = 'cod';
    else if (/freight|invoice|shipping/.test(n)) type = 'freight';
    else if (/warehouse|scan|grn|receipt/.test(n)) type = 'warehouse';
    else if (/order/.test(n)) type = 'orders';
    if (type) from = 'file name';
  }
  const flat = norm(fileName);
  let partner = '';
  const list = type ? partnersBySource[type] ?? [] : [];
  if (list.length === 1) partner = list[0];
  else {
    for (const p of list) {
      const words = p.toLowerCase().split(/\s+/);
      if (flat.includes(norm(p)) || flat.includes(norm(words[0] + words.at(-1)))) { partner = p; break; }
    }
  }
  return { type, partner, from };
}

export function validateFile(f) {
  if (!f) return 'Choose a file';
  const ext = f.name.toLowerCase().split('.').pop();
  if (!['csv', 'xlsx'].includes(ext)) return `“${f.name}” is a .${ext} file. Upload a .csv or .xlsx export from the partner portal.`;
  if (f.size > MAX_BYTES) return 'This file is over the 60 MB limit. Split it by date range and upload each part.';
  if (f.size === 0) return 'This file is empty.';
  return '';
}

export function confidenceLevel(v) {
  if (v === undefined || v === null) return null;
  return v >= 0.85 ? 'high' : v >= 0.55 ? 'medium' : 'low';
}

export function formatCell(v, type) {
  if (v === undefined || v === null) return '—';
  if (type === 'money') return (v / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  if (type === 'date') return day(v);
  if (type === 'weight') return `${v / 1000} kg`;
  return String(v);
}

export const sampleText = (v) => {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  return String(v);
};
