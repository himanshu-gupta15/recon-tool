'use client';
import { useCallback, useEffect, useState } from 'react';

export async function api(path, opts = {}) {
  const init = { ...opts };
  if (opts.json !== undefined) {
    init.method = opts.method || 'POST';
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(opts.json);
  }
  const res = await fetch('/api' + path, init);
  if (res.status === 401 && path !== '/auth/login') { window.location.href = '/login'; throw new Error('Please sign in'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const load = useCallback(() => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    api(path).then((data) => setState({ data, error: null, loading: false })).catch((e) => setState({ data: null, error: e.message, loading: false }));
  }, [path]);
  useEffect(load, [load]);
  return { ...state, reload: load };
}

const fmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const inr = (p) => (p === null || p === undefined ? '—' : `${p < 0 ? '−' : ''}₹${fmt.format(Math.abs(p) / 100)}`);
export const lakh = (p) => {
  if (p === null || p === undefined) return '—';
  const rs = Math.abs(p) / 100;
  if (rs >= 100000) return `₹${(rs / 100000).toFixed(2)} lakh`;
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(rs)}`;
};
export const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');

export const STATUS = {
  settled: ['Settled', 'ok'], short_paid: ['Short-paid', 'risk'], unpaid_past_due: ['Unpaid past due', 'risk'],
  freight_overcharged: ['Freight overcharged', 'risk'], return_not_received: ['Return not received', 'risk'],
  overpaid: ['Overpaid, check', 'warn'], pending: ['Not yet due', ''], cancelled: ['Cancelled', ''], missing_rate_card: ['No rate card', 'warn'],
};
export const CLAIM_STATUS = { open: ['To file', 'risk'], filed: ['Filed', 'warn'], recovered: ['Recovered', 'ok'], rejected: ['Rejected', ''], written_off: ['Written off', ''], resolved: ['Closed by new files', 'ok'] };

export const Badge = ({ map = STATUS, value }) => {
  const [label, tone] = map[value] ?? [value, ''];
  return <span className={`badge ${tone}`}>{label}</span>;
};

export const Pager = ({ page, size, total, onPage }) => (
  <div className="pager">
    <span>{total.toLocaleString('en-IN')} {total === 1 ? 'row' : 'rows'}</span>
    {total > size && (
      <span className="row">
        <button className="btn small" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span>Page {page} of {Math.ceil(total / size)}</span>
        <button className="btn small" disabled={page * size >= total} onClick={() => onPage(page + 1)}>Next</button>
      </span>
    )}
  </div>
);

export const Loading = ({ q }) => (q.error ? <div className="notice err">{q.error}</div> : <div className="empty">Loading…</div>);
