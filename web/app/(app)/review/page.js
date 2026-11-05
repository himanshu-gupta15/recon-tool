'use client';
import { useState } from 'react';
import { api, useApi, Loading, inr, day } from '../../lib';

export default function Review() {
  const q = useApi('/review');
  const [typed, setTyped] = useState({}); const [error, setError] = useState(''); const [busy, setBusy] = useState(null);
  const act = async (id, path, json) => {
    setError(''); setBusy(id);
    try { await api(`/review/${id}/${path}`, { json }); q.reload(); } catch (e) { setError(e.message); }
    setBusy(null);
  };
  if (!q.data) return <Loading q={q} />;
  return (
    <>
      <div className="head"><div><h1>Review queue</h1><p className="sub">Partner lines with no usable order ID. Suggestions only count once you approve them.</p></div><span className="muted">{q.data.total} waiting</span></div>
      {error && <div className="notice err" role="alert">{error}</div>}
      <div className="tablewrap"><table>
        <thead><tr><th>Line from partner</th><th className="num">Amount</th><th>Suggested orders</th><th>Or enter an order ID</th><th></th></tr></thead>
        <tbody>
          {q.data.rows.map((l) => (
            <tr key={l._id}>
              <td><div>{l.partner}</div><div className="small muted">{l.orderId ?? 'No order ID'}, {day(l.date)}</div><div className="small muted">{l.sourceFile}, row {l.sourceRow}</div></td>
              <td className="num">{l.amount === undefined ? '—' : inr(l.amount)}</td>
              <td>
                {l.suggestions?.map((s) => (
                  <div className="row" key={s.orderId} style={{ marginBottom: 4 }}>
                    <button className="btn small" disabled={busy === l._id} onClick={() => act(l._id, 'approve', { orderId: s.orderId })}>Link {s.orderId}</button>
                    <span className="small muted">{s.why[0]}</span>
                  </div>
                ))}
                {!l.suggestions?.length && <span className="muted">No likely order</span>}
              </td>
              <td><form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); act(l._id, 'approve', { orderId: typed[l._id] ?? '' }); }}><input aria-label="Order ID" style={{ width: 140 }} value={typed[l._id] ?? ''} onChange={(e) => setTyped({ ...typed, [l._id]: e.target.value })} /><button className="btn small">Link</button></form></td>
              <td><button className="btn small" disabled={busy === l._id} onClick={() => act(l._id, 'reject', {})}>Not ours</button></td>
            </tr>
          ))}
          {!q.data.rows.length && <tr><td colSpan={5} className="empty">Nothing to review</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
