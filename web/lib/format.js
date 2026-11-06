// All amounts from the API are integer paise.
const full = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const MINUS = '−';

export const inr = (p, { sign = false } = {}) => {
  if (p === null || p === undefined) return '—';
  const s = p < 0 ? MINUS : sign && p > 0 ? '+' : '';
  return `${s}₹${full.format(Math.abs(p) / 100)}`;
};

export const inrWhole = (p, { sign = false } = {}) => {
  if (p === null || p === undefined) return '—';
  const s = p < 0 ? MINUS : sign && p > 0 ? '+' : '';
  return `${s}₹${whole.format(Math.round(Math.abs(p) / 100))}`;
};

// Compact Indian notation: ₹48.2L, ₹1.3Cr, ₹12.4K
export const inrShort = (p) => {
  if (p === null || p === undefined) return '—';
  const rs = Math.abs(p) / 100; const s = p < 0 ? MINUS : '';
  if (rs >= 1e7) return `${s}₹${(rs / 1e7).toFixed(2)}Cr`;
  if (rs >= 1e5) return `${s}₹${(rs / 1e5).toFixed(rs >= 1e6 ? 1 : 2)}L`;
  if (rs >= 1e3) return `${s}₹${(rs / 1e3).toFixed(1)}K`;
  return `${s}₹${whole.format(rs)}`;
};

export const num = (n) => (n === null || n === undefined ? '—' : whole.format(n));
export const pct = (x, digits = 1) => (x === null || x === undefined || Number.isNaN(x) ? '—' : `${(x * 100).toFixed(digits)}%`);

export const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
export const dayShort = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—');
export const time = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '');

export const daysSince = (d, now = Date.now()) => (d ? Math.max(0, Math.floor((now - new Date(d).getTime()) / 86400000)) : null);
export const age = (d) => {
  const n = daysSince(d);
  if (n === null) return '—';
  if (n === 0) return 'Today';
  if (n === 1) return '1 day';
  return `${n} days`;
};

export const relative = (d) => {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const dd = Math.round(h / 24);
  if (dd === 1) return 'Yesterday';
  if (dd < 7) return `${dd} days ago`;
  return day(d);
};

export const dayLabel = (d) => {
  const t = new Date(d); const now = new Date();
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(t, now)) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(t, y)) return 'Yesterday';
  return t.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const fileSize = (b) => {
  if (!b && b !== 0) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

export const initials = (s = '') => s.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

export const change = (cur, prev) => {
  if (prev === null || prev === undefined) return null;
  if (!prev) return cur ? null : 0;
  return (cur - prev) / Math.abs(prev);
};
