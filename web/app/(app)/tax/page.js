'use client';
import { useApi, Loading, inr } from '../../lib';

export default function Tax() {
  const q = useApi('/tax');
  if (!q.data) return <Loading q={q} />;
  const sum = (k) => q.data.reduce((t, r) => t + r[k], 0);
  return (
    <>
      <div className="head"><div><h1>TCS and TDS</h1><p className="sub">Deducted by partners from settlements. These are tax credits to check against your books, not leakage.</p></div></div>
      <div className="tablewrap"><table>
        <thead><tr><th>Month</th><th>Partner</th><th className="num">Lines</th><th className="num">Net paid</th><th className="num">GST TCS</th><th className="num">Income tax TDS</th></tr></thead>
        <tbody>
          {q.data.map((r) => <tr key={r.month + r.partner}><td>{r.month}</td><td>{r.partner}</td><td className="num">{r.lines.toLocaleString('en-IN')}</td><td className="num">{inr(r.net)}</td><td className="num">{inr(r.tcs)}</td><td className="num">{inr(r.tds)}</td></tr>)}
          {q.data.length > 0 && <tr><td className="total">Total</td><td></td><td className="num total">{sum('lines').toLocaleString('en-IN')}</td><td className="num total">{inr(sum('net'))}</td><td className="num total">{inr(sum('tcs'))}</td><td className="num total">{inr(sum('tds'))}</td></tr>}
          {!q.data.length && <tr><td colSpan={6} className="empty">Upload settlement files to see deductions</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
