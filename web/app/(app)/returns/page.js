'use client';
import { useState } from 'react';
import { useApi, Loading, Pager, inr, lakh, day } from '../../lib';

const VIEWS = [['not_received', 'Not received', 'risk'], ['awaiting', 'Inside grace period', ''], ['received', 'Received', 'ok']];
const DAY = 86400000;

export default function Returns() {
  const [view, setView] = useState('not_received'); const [page, setPage] = useState(1);
  const q = useApi(`/returns?view=${view}&page=${page}`);
  const c = q.data?.counts ?? {};
  const [today] = useState(() => Date.now());
  return (
    <>
      <div className="head"><div><h1>Returns</h1><p className="sub">Returned orders checked against warehouse receipt scans.</p></div></div>
      <div className="filters">
        {VIEWS.map(([k, label]) => <button key={k} className={`btn ${view === k ? 'primary' : ''}`} aria-pressed={view === k} onClick={() => { setView(k); setPage(1); }}>{label} ({(c[k]?.count ?? 0).toLocaleString('en-IN')})</button>)}
        {c[view] && <span className="muted">{lakh(c[view].value)} order value</span>}
      </div>
      {!q.data ? <Loading q={q} /> : <>
        <div className="tablewrap"><table>
          <thead><tr><th>Order ID</th><th>AWB</th><th>Channel</th><th>Courier</th><th className="num">Value</th><th>Returned</th><th>{view === 'received' ? 'Scanned' : 'Due by'}</th><th>{view === 'received' ? 'Condition' : 'Days late'}</th></tr></thead>
          <tbody>
            {q.data.rows.map((o) => (
              <tr key={o._id}>
                <td className="mono">{o.orderId}</td><td className="mono">{o.awb ?? '—'}</td><td>{o.channel}</td><td>{o.courier ?? '—'}</td><td className="num">{inr(o.value)}</td><td>{day(o.returnedDate)}</td>
                <td>{view === 'received' ? day(o.scanDate) : day(o.returnDueBy)}</td>
                <td>{view === 'received' ? (o.scanCondition ?? '—') : view === 'not_received' ? <span className="neg">{Math.floor((today - new Date(o.returnDueBy)) / DAY)}</span> : '—'}</td>
              </tr>
            ))}
            {!q.data.rows.length && <tr><td colSpan={8} className="empty">Nothing here</td></tr>}
          </tbody>
        </table></div>
        <Pager {...q.data} onPage={setPage} />
      </>}
    </>
  );
}
