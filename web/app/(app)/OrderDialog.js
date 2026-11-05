'use client';
import { useEffect, useRef } from 'react';
import { useApi, Badge, inr, day, CLAIM_STATUS } from '../lib';

const TYPE = { settlement: 'Settlement', cod: 'COD remittance', freight: 'Freight', warehouse: 'Warehouse scan' };

export default function OrderDialog({ orderId, onClose }) {
  const ref = useRef(null);
  const q = useApi(`/orders/${encodeURIComponent(orderId)}`);
  useEffect(() => { ref.current?.showModal(); }, []);
  const d = q.data;
  return (
    <dialog ref={ref} onClose={onClose} aria-label={`Order ${orderId}`}>
      <div className="row spread" style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 17 }}>{orderId}</h1>
        <button className="btn small" onClick={() => ref.current.close()}>Close</button>
      </div>
      {q.error && <div className="notice err">{q.error}</div>}
      {d && <>
        <dl className="kv">
          <dt>Status</dt><dd><Badge value={d.order.status} /></dd>
          <dt>Order</dt><dd>{d.order.channel}, {d.order.mode}, {inr(d.order.value)}, placed {day(d.order.orderDate)}</dd>
          <dt>Delivery</dt><dd>{d.order.deliveryStatus}{d.order.courier ? `, ${d.order.courier}` : ''}{d.order.awb ? `, ${d.order.awb}` : ''}</dd>
          {d.order.customerName && <><dt>Customer</dt><dd>{d.order.customerName}{d.order.customerPhone ? `, ${d.order.customerPhone}` : ''}</dd></>}
          <dt>Expected</dt><dd>{inr(d.order.expected)} <span className="muted small">{d.order.calc}</span></dd>
          <dt>Received</dt><dd>{inr(d.order.net)} paid + {inr(d.order.tcs)} TCS + {inr(d.order.tds)} TDS = {inr(d.order.received)}</dd>
          <dt>Difference</dt><dd className={d.order.gap < 0 ? 'neg' : ''}>{inr(d.order.gap)}</dd>
          {d.order.freightExpected !== null && <><dt>Freight</dt><dd>Expected {inr(d.order.freightExpected)}, charged {inr(d.order.freightCharged)}</dd></>}
          {d.order.returnStatus && <><dt>Return</dt><dd>{d.order.returnStatus === 'received' ? `Scanned ${day(d.order.scanDate)}${d.order.scanCondition ? `, ${d.order.scanCondition}` : ''}` : `No scan yet. Due by ${day(d.order.returnDueBy)}`}</dd></>}
        </dl>
        {d.order.flags?.map((f) => <div className="notice" style={{ marginTop: 12, marginBottom: 0 }} key={f}>{f}</div>)}
        <h2 className="section">Lines from partner files</h2>
        <div className="tablewrap"><table>
          <thead><tr><th>Type</th><th>Partner</th><th>Reference</th><th>Date</th><th className="num">Amount</th><th>Source</th></tr></thead>
          <tbody>
            {d.lines.map((l) => <tr key={l._id}><td>{TYPE[l.sourceType]}{l.state === 'manual' ? ' (reviewed)' : ''}</td><td>{l.partner}</td><td>{l.reference ?? '—'}</td><td>{day(l.date)}</td><td className="num">{l.amount === undefined ? '—' : inr(l.amount)}</td><td className="small muted">{l.sourceFile}, row {l.sourceRow}</td></tr>)}
            {!d.lines.length && <tr><td colSpan={6} className="empty">Nothing found in uploaded files</td></tr>}
          </tbody>
        </table></div>
        {d.claims.length > 0 && <><h2 className="section">Claims</h2>{d.claims.map((c) => <div className="row spread" key={c._id} style={{ marginBottom: 6 }}><span><Badge value={c.type} /> {c.detail}</span><span className="row"><span className="num">{inr(c.amount)}</span><Badge map={CLAIM_STATUS} value={c.status} /></span></div>)}</>}
      </>}
    </dialog>
  );
}
