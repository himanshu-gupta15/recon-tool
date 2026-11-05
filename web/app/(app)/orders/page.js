'use client';
import { useState } from 'react';
import { useApi, Loading, Badge, Pager, inr, day, STATUS } from '../../lib';
import OrderDialog from '../OrderDialog';

export default function Orders() {
  const [status, setStatus] = useState(''); const [channel, setChannel] = useState(''); const [text, setText] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const [open, setOpen] = useState(null);
  const qs = new URLSearchParams({ status, channel, q: search, page });
  const q = useApi(`/orders?${qs}`);
  const reset = (fn) => (e) => { fn(e.target.value); setPage(1); };
  return (
    <>
      <div className="head"><div><h1>Orders</h1><p className="sub">Each order's expected amount against what partners paid.</p></div></div>
      <div className="filters">
        <select aria-label="Status" value={status} onChange={reset(setStatus)}><option value="">All statuses</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select>
        <select aria-label="Channel" value={channel} onChange={reset(setChannel)}><option value="">All channels</option>{q.data?.channels.map((c) => <option key={c}>{c}</option>)}</select>
        <form onSubmit={(e) => { e.preventDefault(); setSearch(text.trim()); setPage(1); }} className="row"><input aria-label="Order ID or AWB" placeholder="Exact order ID or AWB" value={text} onChange={(e) => setText(e.target.value)} /><button className="btn">Find</button></form>
      </div>
      {!q.data ? <Loading q={q} /> : <>
        <div className="tablewrap"><table>
          <thead><tr><th>Order ID</th><th>Channel</th><th>Date</th><th>Payment</th><th className="num">Value</th><th className="num">Expected</th><th className="num">Received</th><th className="num">Difference</th><th>Status</th></tr></thead>
          <tbody>
            {q.data.rows.map((o) => (
              <tr key={o._id} className="click" tabIndex={0} onClick={() => setOpen(o.orderId)} onKeyDown={(e) => e.key === 'Enter' && setOpen(o.orderId)}>
                <td className="mono">{o.orderId}</td><td>{o.channel}</td><td>{day(o.orderDate)}</td><td>{o.mode}</td><td className="num">{inr(o.value)}</td><td className="num">{inr(o.expected)}</td><td className="num">{inr(o.received)}</td><td className={`num ${o.gap < 0 ? 'neg' : ''}`}>{inr(o.gap)}</td><td><Badge value={o.status} /></td>
              </tr>
            ))}
            {!q.data.rows.length && <tr><td colSpan={9} className="empty">No orders match these filters</td></tr>}
          </tbody>
        </table></div>
        <Pager {...q.data} onPage={setPage} />
      </>}
      {open && <OrderDialog orderId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
