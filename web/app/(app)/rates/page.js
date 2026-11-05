'use client';
import { useState } from 'react';
import { api, useApi, Loading, inr, day } from '../../lib';

const today = () => new Date().toISOString().slice(0, 10);
const pct = (bp) => `${(bp ?? 0) / 100}%`;

function NewChannel({ card, onDone }) {
  const [f, setF] = useState({ partner: card?.partner ?? '', effectiveFrom: today(), cod: (card?.codBp ?? 0) / 100, prepaid: (card?.prepaidBp ?? 0) / 100, ret: (card?.prepaidReturnBp ?? 0) / 100, fixed: (card?.fixedPaise ?? 0) / 100, days: card?.settlementDays ?? 7, codVia: card?.codVia ?? 'channel' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError('');
    try {
      await api('/cards', { json: { kind: 'channel', partner: f.partner, effectiveFrom: f.effectiveFrom, codBp: Math.round(f.cod * 100), prepaidBp: Math.round(f.prepaid * 100), prepaidReturnBp: Math.round(f.ret * 100), fixedPaise: Math.round(f.fixed * 100), settlementDays: Number(f.days), codVia: f.codVia } });
      onDone();
    } catch (err) { setError(err.message); }
  };
  return (
    <form onSubmit={submit} className="section">
      <h2>New channel rate</h2>
      {error && <div className="notice err" role="alert">{error}</div>}
      <div className="form">
        <label className="f">Channel<input required value={f.partner} onChange={set('partner')} /></label>
        <label className="f">Applies to orders from<input type="date" required value={f.effectiveFrom} onChange={set('effectiveFrom')} /></label>
        <label className="f">COD fee %<input type="number" step="0.01" min="0" value={f.cod} onChange={set('cod')} /></label>
        <label className="f">Prepaid fee %<input type="number" step="0.01" min="0" value={f.prepaid} onChange={set('prepaid')} /></label>
        <label className="f">Prepaid return charge %<input type="number" step="0.01" min="0" value={f.ret} onChange={set('ret')} /></label>
        <label className="f">Fixed fee per order ₹<input type="number" step="0.01" min="0" value={f.fixed} onChange={set('fixed')} /></label>
        <label className="f">Settles within (days)<input type="number" min="0" value={f.days} onChange={set('days')} /></label>
        <label className="f">COD cash comes from<select value={f.codVia} onChange={set('codVia')}><option value="channel">The channel</option><option value="courier">The courier</option></select></label>
      </div>
      <div className="row" style={{ marginTop: 12 }}><button className="btn primary">Save and recalculate</button><span className="small muted">Older orders keep the rate in force on their order date.</span></div>
    </form>
  );
}

export default function Rates() {
  const q = useApi('/cards');
  const [seed, setSeed] = useState(null); const [saved, setSaved] = useState(false);
  if (!q.data) return <Loading q={q} />;
  const channels = q.data.filter((c) => c.kind === 'channel'); const couriers = q.data.filter((c) => c.kind === 'courier');
  return (
    <>
      <div className="head"><div><h1>Rate cards</h1><p className="sub">These set every expected amount. The demo rates are illustrative, so replace them with signed partner rates.</p></div></div>
      {saved && <div className="notice good" role="status">Saved, and orders were recalculated.</div>}
      <h2>Channels</h2>
      <div className="tablewrap"><table>
        <thead><tr><th>Channel</th><th>From</th><th className="num">COD fee</th><th className="num">Prepaid fee</th><th className="num">Prepaid return</th><th className="num">Fixed fee</th><th className="num">Settles in</th><th></th></tr></thead>
        <tbody>{channels.map((c) => <tr key={c._id}><td>{c.partner}</td><td>{day(c.effectiveFrom)}</td><td className="num">{pct(c.codBp)}</td><td className="num">{pct(c.prepaidBp)}</td><td className="num">{pct(c.prepaidReturnBp)}</td><td className="num">{inr(c.fixedPaise ?? 0)}</td><td className="num">{c.settlementDays} days</td><td><button className="btn small" onClick={() => { setSeed(c); setSaved(false); }}>New version</button></td></tr>)}</tbody>
      </table></div>
      <h2 className="section">Couriers</h2>
      <div className="tablewrap"><table>
        <thead><tr><th>Courier</th><th>From</th><th className="num">Remits in</th><th className="num">Return grace</th><th className="num">RTO charge</th><th>First 500 g, then each extra 500 g</th></tr></thead>
        <tbody>{couriers.map((c) => <tr key={c._id}><td>{c.partner}</td><td>{day(c.effectiveFrom)}</td><td className="num">{c.remittanceDays} days</td><td className="num">{c.returnGraceDays} days</td><td className="num">{inr(c.rtoPaise ?? 0)}</td><td className="small">{Object.entries(c.zones).map(([z, v]) => `${z}: ${inr(v.base)} + ${inr(v.add)}`).join('  ·  ')}</td></tr>)}</tbody>
      </table></div>
      <NewChannel key={seed?._id ?? 'new'} card={seed} onDone={() => { setSeed(null); setSaved(true); q.reload(); }} />
    </>
  );
}
