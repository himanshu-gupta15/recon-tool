'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, useApi, Loading, Badge, Pager, inr, lakh, day, STATUS, CLAIM_STATUS } from '../../lib';
import OrderDialog from '../OrderDialog';

const TYPES = ['short_paid', 'unpaid_past_due', 'freight_overcharged', 'return_not_received'];
const NEXT = { open: [['filed', 'Mark filed'], ['written_off', 'Write off']], filed: [['recovered', 'Recovered'], ['rejected', 'Rejected'], ['written_off', 'Write off']], rejected: [['written_off', 'Write off']] };

function ActionDialog({ claim, to, label, onDone, onClose }) {
  const ref = useRef(null);
  const [note, setNote] = useState(''); const [amount, setAmount] = useState((claim.amount / 100).toFixed(2)); const [error, setError] = useState('');
  useEffect(() => { ref.current?.showModal(); }, []);
  const submit = async (e) => {
    e.preventDefault(); setError('');
    try { await api(`/claims/${claim._id}`, { method: 'PATCH', json: { status: to, note, recovered: Number(amount) } }); onDone(); } catch (err) { setError(err.message); }
  };
  return (
    <dialog ref={ref} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ fontSize: 17 }}>{label}: {claim.orderId}</h1>
        <p className="muted">{inr(claim.amount)} with {claim.partner}. {claim.detail}</p>
        {error && <div className="notice err" role="alert" style={{ margin: 0 }}>{error}</div>}
        {to === 'recovered' && <label className="f">Amount recovered (₹)<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>}
        <label className="f">{to === 'written_off' ? 'Reason (required)' : 'Note'}<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <div className="row"><button className="btn primary">Save</button><button type="button" className="btn" onClick={() => ref.current.close()}>Cancel</button></div>
      </form>
    </dialog>
  );
}

function Claims() {
  const sp = useSearchParams();
  const [partner, setPartner] = useState(sp.get('partner') ?? ''); const [type, setType] = useState(sp.get('type') ?? ''); const [status, setStatus] = useState('active'); const [page, setPage] = useState(1);
  const [action, setAction] = useState(null); const [order, setOrder] = useState(null);
  const qs = new URLSearchParams({ partner, type, status, page });
  const q = useApi(`/claims?${qs}`); const me = useApi('/me');
  const reset = (fn) => (e) => { fn(e.target.value); setPage(1); };
  const canOpenOrders = me.data && me.data.role !== 'returns';
  return (
    <>
      <div className="head">
        <div><h1>Claims</h1><p className="sub">File these with each partner yourself. Export gives you the evidence.</p></div>
        <a className="btn" href={`/api/claims/export.csv?${qs}`}>Export evidence (CSV)</a>
      </div>
      <div className="filters">
        <select aria-label="Partner" value={partner} onChange={reset(setPartner)}><option value="">All partners</option>{q.data?.partners.map((p) => <option key={p}>{p}</option>)}</select>
        <select aria-label="Issue" value={type} onChange={reset(setType)}><option value="">All issues</option>{TYPES.map((t) => <option key={t} value={t}>{STATUS[t][0]}</option>)}</select>
        <select aria-label="Claim status" value={status} onChange={reset(setStatus)}><option value="active">To file and filed</option>{Object.entries(CLAIM_STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}<option value="all">All</option></select>
        {q.data && <span className="muted">{lakh(q.data.amount)} in this view</span>}
      </div>
      {!q.data ? <Loading q={q} /> : <>
        <div className="tablewrap"><table>
          <thead><tr><th>Order ID</th><th>Partner</th><th>Issue</th><th className="num">Amount</th><th>Since</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {q.data.rows.map((c) => (
              <tr key={c._id}>
                <td className="mono">{canOpenOrders ? <button className="linkish" onClick={() => setOrder(c.orderId)}>{c.orderId}</button> : c.orderId}</td>
                <td>{c.partner}</td><td title={c.detail}><Badge value={c.type} /></td><td className="num">{inr(c.amount)}</td><td>{day(c.ageFrom)}</td><td><Badge map={CLAIM_STATUS} value={c.status} /></td>
                <td><div className="row" style={{ flexWrap: 'nowrap' }}>{(NEXT[c.status] ?? []).filter(([to]) => to !== 'written_off' || me.data?.role === 'cofounder').map(([to, label]) => <button key={to} className="btn small" onClick={() => setAction({ claim: c, to, label })}>{label}</button>)}</div></td>
              </tr>
            ))}
            {!q.data.rows.length && <tr><td colSpan={7} className="empty">No claims match these filters</td></tr>}
          </tbody>
        </table></div>
        <Pager {...q.data} onPage={setPage} />
      </>}
      {action && <ActionDialog {...action} onClose={() => setAction(null)} onDone={() => { setAction(null); q.reload(); }} />}
      {order && <OrderDialog orderId={order} onClose={() => setOrder(null)} />}
    </>
  );
}

export default function Page() { return <Suspense fallback={<div className="empty">Loading…</div>}><Claims /></Suspense>; }
