// Parsing of messy partner values. Money is always integer paise; never floats.
export function parseMoney(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) throw new Error('not a number');
    return Math.round(raw * 100);
  }
  let s = String(raw).trim();
  if (!s || /^(-|–|—|na|n\/a|nil|null)$/i.test(s)) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/\s*(dr)$/i.test(s)) { neg = true; s = s.replace(/\s*dr$/i, ''); }
  s = s.replace(/\s*cr$/i, '').replace(/₹|rs\.?|inr/gi, '').replace(/[,\s]/g, '');
  if (s.endsWith('-')) { neg = !neg; s = s.slice(0, -1); }
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); } else if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d*(\.\d*)?$/.test(s) || s === '' || s === '.') throw new Error(`"${raw}" is not an amount`);
  const [whole = '0', frac = ''] = s.split('.');
  let paise = Number(whole || 0) * 100 + Number((frac + '00').slice(0, 2));
  if (frac.length > 2 && Number(frac[2]) >= 5) paise += 1;
  return neg ? -paise : paise;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function utc(y, m, d) {
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) throw new Error('impossible date');
  return dt;
}

// Indian partners write dates day first. Month-first is accepted only when the
// value cannot be day-first (for example 10/25/2026).
export function parseDate(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) throw new Error('invalid date');
    return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
  }
  if (typeof raw === 'number' || /^\d{5}(\.\d+)?$/.test(String(raw).trim())) {
    const serial = Number(raw); // Excel serial date
    if (serial < 30000 || serial > 80000) throw new Error(`"${raw}" is not a date`);
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  }
  const s = String(raw).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return utc(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) {
    const a = +m[1], b = +m[2];
    return b > 12 && a <= 12 ? utc(+m[3], a, b) : utc(+m[3], b, a);
  }
  if ((m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s,-]+(\d{2,4})/)) && MONTHS[m[2].toLowerCase()]) {
    return utc(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  }
  throw new Error(`"${raw}" is not a date`);
}

export function parseWeightGrams(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return Math.round(raw * 1000);
  const m = String(raw).trim().toLowerCase().match(/^([\d.,]+)\s*(kg|kgs|g|gm|gms|grams?)?$/);
  if (!m) throw new Error(`"${raw}" is not a weight`);
  const n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) throw new Error(`"${raw}" is not a weight`);
  return Math.round(m[2] && m[2].startsWith('g') ? n : n * 1000);
}

export function normalizeMode(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (/cod|cash/.test(s)) return 'COD';
  if (/prepaid|online|paid|upi|card|netbanking/.test(s)) return 'Prepaid';
  throw new Error(`"${raw}" is not a payment type`);
}

export function normalizeDelivery(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (/cancel/.test(s)) return 'cancelled';
  if (/rto|return/.test(s)) return 'returned';
  if (/deliver/.test(s) && !/out for|undeliver/.test(s)) return 'delivered';
  return 'in_transit';
}

export function maskName(v) {
  if (!v) return null;
  return String(v).split(/\s+/).map((p) => p[0] + '•••').join(' ');
}
export function maskPhone(v) {
  if (!v) return null;
  const d = String(v).replace(/\D/g, '');
  return d.length >= 4 ? '••••••' + d.slice(-4) : '••••';
}

// Stops a text cell from running as a formula when an export opens in Excel.
export function csvCell(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
