'use client';
import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Segmented, Button } from './ui';

export const RANGES = [['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['all', 'All time'], ['custom', 'Custom']];

// value: { days: '30' } or { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
export function rangeQuery(r) {
  if (r.from) return { from: r.from, to: r.to };
  return r.days === 'all' ? {} : { days: r.days };
}

export function rangeLabel(r) {
  if (r.from) return `${r.from} to ${r.to || 'today'}`;
  return r.days === 'all' ? 'all time' : `the last ${r.days} days`;
}

export default function RangePicker({ value, onChange }) {
  const [custom, setCustom] = useState(!!value.from);
  const [from, setFrom] = useState(value.from ?? ''); const [to, setTo] = useState(value.to ?? '');
  const current = value.from ? 'custom' : value.days;
  return (
    <div className="row wrap" style={{ gap: 8 }}>
      <Segmented label="Date range" value={custom ? 'custom' : current} options={RANGES} onChange={(v) => { if (v === 'custom') setCustom(true); else { setCustom(false); onChange({ days: v }); } }} />
      {custom && (
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (from) onChange({ from, to }); }}>
          <CalendarDays aria-hidden="true" style={{ width: 15, height: 15, color: 'var(--faint)' }} />
          <input className="input sm" type="date" aria-label="From" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} required />
          <span className="faint">–</span>
          <input className="input sm" type="date" aria-label="To" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          <Button size="sm" variant="primary" type="submit" disabled={!from}>Apply</Button>
        </form>
      )}
    </div>
  );
}
