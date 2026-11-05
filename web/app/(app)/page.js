'use client';
import Link from 'next/link';
import { useApi, Loading, inr, lakh, day, STATUS } from '../lib';

const TARGET_RATE = 0.98;

export default function Dashboard() {
  const q = useApi('/dashboard');
  if (!q.data) return <Loading q={q} />;
  const d = q.data;
  const maxCell = Math.max(1, ...d.partners.flatMap((p) => p.buckets));
  const maxType = Math.max(1, ...d.types.map((t) => t.amount));
  const hasData = Object.keys(d.statuses).length > 0;
  return (
    <>
      <div className="head">
        <div><h1>Money at risk</h1><p className="sub">{d.lastImport ? `Files last imported ${day(d.lastImport)}` : 'No files imported yet'}</p></div>
        <div className="row"><Link className="btn" href="/upload">Upload files</Link><Link className="btn primary" href="/claims">Open claims</Link></div>
      </div>
      {!hasData && <div className="notice">Upload an orders file first, then partner reports, to see results here.</div>}
      <section className="hero" aria-label="Summary">
        <div className="stat"><div className="label">Short, late, overcharged or missing</div><div className="big">{lakh(d.total)}</div><div className="note">{d.count.toLocaleString('en-IN')} open claims. TCS and TDS are not included.</div></div>
        <div className="stat"><div className="label">Recovered this year</div><div className="value">{lakh(d.recovered)}</div><div className="meter" role="img" aria-label={`${Math.round(d.recovered / d.target * 100)}% of target`}><i style={{ width: `${Math.min(100, d.recovered / d.target * 100)}%` }} /></div><div className="note">Target {lakh(d.target)}</div></div>
        <div className="stat"><div className="label">Orders matched automatically</div><div className="value">{d.autoMatchRate === null ? '—' : `${(d.autoMatchRate * 100).toFixed(1)}%`}</div><div className="note">Target {TARGET_RATE * 100}%. {d.review ? <Link href="/review">{d.review} lines need review</Link> : 'Nothing waiting for review'}</div></div>
        <div className="stat"><div className="label">Tax deducted by partners</div><div className="value">{lakh(d.tcs + d.tds)}</div><div className="note"><Link href="/tax">TCS {lakh(d.tcs)}, TDS {lakh(d.tds)}</Link></div></div>
      </section>
      <div className="grid2">
        <section>
          <h2>By partner and age</h2>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Partner</th>{d.buckets.map((b) => <th key={b} className="num">{b}</th>)}<th className="num">Total</th></tr></thead>
              <tbody>
                {d.partners.map((p) => (
                  <tr key={p.partner}>
                    <td>{p.partner}</td>
                    {p.buckets.map((v, i) => (
                      <td key={i} className="num heat" style={v ? { background: `rgba(var(--risk-rgb), ${0.05 + 0.3 * (v / maxCell)})` } : undefined} title={`${p.partner}, ${d.buckets[i]}: ${inr(v)}`}>
                        {v ? <Link href={`/claims?partner=${encodeURIComponent(p.partner)}`}>{lakh(v)}</Link> : <span className="muted">—</span>}
                      </td>
                    ))}
                    <td className="num total">{lakh(p.total)}</td>
                  </tr>
                ))}
                {!d.partners.length && <tr><td colSpan={6} className="empty">No open claims</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2>By issue</h2>
          {d.types.map((t) => (
            <div className="bar" key={t.type} title={inr(t.amount)}>
              <Link href={`/claims?type=${t.type}`}>{STATUS[t.type]?.[0] ?? t.type}</Link>
              <span className="num">{lakh(t.amount)}</span>
              <div className="track"><i style={{ width: `${(t.amount / maxType) * 100}%` }} /></div>
            </div>
          ))}
          {d.types.some((t) => t.type === 'return_not_received') && <p className="small muted">Returns count at order value because product cost isn't in the files.</p>}
        </section>
      </div>
    </>
  );
}
