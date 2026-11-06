'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, Download } from 'lucide-react';
import { useApi, qs } from '@/lib/api';
import { STATUS, HEALTH_ORDER, CLAIM_STATUS } from '@/lib/status';
import { dayShort, inr, inrShort, num, pct } from '@/lib/format';
import { PageHeader, Card, Button, Money, Meter, Skeleton, EmptyState, ErrorState } from '@/components/ui';
import { BarList, StackedColumns } from '@/components/charts';
import RangePicker, { rangeQuery, rangeLabel } from '@/components/RangePicker';

const csv = (rows) => rows.map((r) => r.map((v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
const download = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv' })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
const rs = (p) => (p / 100).toFixed(2);

function Loading({ h = 220 }) { return <Skeleton h={h} r={8} />; }

export default function Reports() {
  const [range, setRange] = useState({ days: '90' });
  const [channel, setChannel] = useState('');
  const ov = useApi(`/overview?${qs({ ...rangeQuery(range), channel })}`);
  const dash = useApi('/dashboard');
  const claims = useApi('/claims/summary');
  const returns = useApi('/returns?view=all');
  const tax = useApi('/tax');
  const meta = useApi('/sources');
  const d = ov.data;
  const channels = meta.data?.partners.settlement ?? [];

  const exportCsv = () => {
    if (!d) return;
    const rows = [['Channel', 'Orders', 'Due for payment', 'Matched', 'Settlement rate', 'Expected ₹', 'Received ₹', 'Shortfall ₹', 'Exceptions'],
      ...d.byChannel.map((c) => [c.channel, c.orders, c.eligible, c.settled, c.eligible ? (c.settled / c.eligible * 100).toFixed(1) + '%' : '', rs(c.expected), rs(c.received), rs(-c.shortfall), c.exceptions])];
    download(`settlement-summary-${range.days ?? `${range.from}_${range.to}`}.csv`, csv(rows));
  };

  const fmtBucket = (b, long) => (d?.range.unit === 'month' ? new Date(b + '-01T00:00:00Z').toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : (long && d?.range.unit === 'week' ? `Week of ${dayShort(b)}` : dayShort(b)));
  const cl = claims.data ?? {};
  const claimTotal = Object.values(cl).reduce((t, x) => t + x.amount, 0);
  const rc = returns.data?.counts ?? {};
  const rTotal = ['received', 'awaiting', 'not_received'].reduce((t, k) => t + (rc[k]?.count ?? 0), 0);
  const taxTot = (tax.data ?? []).reduce((t, r) => ({ tcs: t.tcs + r.tcs, tds: t.tds + r.tds, net: t.net + r.net }), { tcs: 0, tds: 0, net: 0 });

  return (
    <>
      <PageHeader
        title="Reports"
        sub={`Settlement, partner and recovery performance for ${rangeLabel(range)}${channel ? ` on ${channel}` : ''}.`}
        actions={<>
          <RangePicker value={range} onChange={setRange} />
          <select className="select" aria-label="Channel" value={channel} onChange={(e) => setChannel(e.target.value)}><option value="">All channels</option>{channels.map((c) => <option key={c}>{c}</option>)}</select>
          <Button icon={Download} onClick={exportCsv} disabled={!d}>Export CSV</Button>
        </>}
      />
      {ov.error && !d ? <div className="card"><ErrorState message={ov.error} onRetry={ov.reload} /></div> : (
        <div className="stack gap-24" style={{ opacity: ov.loading && d ? 0.6 : 1, transition: 'opacity .15s' }}>
          <Card flush title="Settlement summary" sub="By sales channel, for orders placed in the period">
            {!d ? <div style={{ padding: 18 }}><Loading h={180} /></div> : d.byChannel.length ? (
              <div className="table-wrap">
                <table className="table responsive">
                  <thead><tr><th>Channel</th><th className="num">Orders</th><th className="num">Matched</th><th style={{ width: 180 }}>Settlement rate</th><th className="num">Expected</th><th className="num">Received</th><th className="num">Shortfall</th><th className="num">Exceptions</th></tr></thead>
                  <tbody>
                    {d.byChannel.map((c) => {
                      const rate = c.eligible ? c.settled / c.eligible : null;
                      return (
                        <tr key={c.channel}>
                          <td className="m-primary cell-main">{c.channel}</td>
                          <td className="num" data-label="Orders">{num(c.orders)}</td>
                          <td className="num" data-label="Matched">{num(c.settled)} <span className="faint">/ {num(c.eligible)}</span></td>
                          <td data-label="Settlement rate"><div className="row gap-12"><div className="grow"><Meter value={rate} color={rate !== null && rate < 0.8 ? 'var(--c-short)' : undefined} label={pct(rate)} /></div><span className="tnum strong" style={{ width: 48, textAlign: 'right' }}>{pct(rate)}</span></div></td>
                          <td className="num" data-label="Expected"><Money value={c.expected} /></td>
                          <td className="num" data-label="Received"><Money value={c.received} /></td>
                          <td className="num" data-label="Shortfall"><Money value={c.shortfall || null} signed /></td>
                          <td className="num" data-label="Exceptions">{num(c.exceptions)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr><td>Total</td><td className="num">{num(d.current.orders)}</td><td className="num">{num(d.current.settled)} <span className="faint">/ {num(d.current.eligible)}</span></td><td className="tnum">{pct(d.current.eligible ? d.current.settled / d.current.eligible : null)}</td><td className="num"><Money value={d.current.expected} /></td><td className="num"><Money value={d.current.received} /></td><td className="num"><Money value={d.current.gap || null} signed /></td><td className="num">{num(d.current.exceptions)}</td></tr></tfoot>
                </table>
              </div>
            ) : <EmptyState icon={BarChart3} title="No orders in this period" compact>Try a wider date range.</EmptyState>}
          </Card>

          <div className="grid-main">
            <Card title="Reconciliation trend" sub="Orders by outcome, by date placed">
              {!d ? <Loading /> : d.trend.length ? <>
                <StackedColumns data={d.trend} keys={[...HEALTH_ORDER, 'pending']} formatBucket={fmtBucket} />
                <div className="legend-inline mt-12">{[...HEALTH_ORDER, 'pending'].filter((k) => d.trend.some((t) => t[k])).map((k) => <span key={k}><i style={{ background: STATUS[k].color }} />{STATUS[k].label}</span>)}</div>
              </> : <EmptyState icon={BarChart3} title="No data for this period" compact />}
            </Card>
            <Card title="Exception analysis" sub="Orders by exception type">
              {!d ? <Loading /> : (() => {
                const items = ['short_paid', 'unpaid_past_due', 'freight_overcharged', 'return_not_received', 'overpaid', 'missing_rate_card'].map((k) => ({ key: k, label: STATUS[k].label, value: d.current.statuses[k]?.count ?? 0, color: STATUS[k].color, sub: d.current.statuses[k]?.amount ? inrShort(d.current.statuses[k].amount) : undefined })).filter((i) => i.value).sort((a, b) => b.value - a.value);
                return items.length ? <BarList items={items} /> : <EmptyState icon={BarChart3} title="No exceptions" compact>Everything due in this period matched.</EmptyState>;
              })()}
            </Card>
          </div>

          <div className="grid-main">
            <Card flush title="Partner performance" sub="Open claim value by partner and age · current snapshot">
              {!dash.data ? <div style={{ padding: 18 }}><Loading h={200} /></div> : dash.data.partners.length ? (() => {
                const max = Math.max(1, ...dash.data.partners.flatMap((p) => p.buckets));
                return (
                  <div className="table-wrap">
                    <table className="table responsive">
                      <thead><tr><th>Partner</th>{dash.data.buckets.map((b) => <th key={b} className="num">{b}</th>)}<th className="num">Total</th></tr></thead>
                      <tbody>
                        {dash.data.partners.map((p) => (
                          <tr key={p.partner}>
                            <td className="m-primary"><Link className="cell-main" href={`/claims?partner=${encodeURIComponent(p.partner)}`}>{p.partner}</Link><div className="cell-sub">{num(p.count)} open claims</div></td>
                            {p.buckets.map((v, i) => (
                              <td key={i} className="num" data-label={dash.data.buckets[i]} title={inr(v)} style={v ? { background: `color-mix(in srgb, var(--c-short) ${Math.round(6 + 34 * (v / max))}%, transparent)` } : undefined}>
                                {v ? inrShort(v) : <span className="faint">—</span>}
                              </td>
                            ))}
                            <td className="num strong" data-label="Total">{inrShort(p.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })() : <EmptyState icon={BarChart3} title="No open claims" compact />}
            </Card>
            <Card title="Claims recovery" sub="All claims to date" actions={<Button size="sm" variant="ghost" href="/claims" iconRight={ArrowRight}>Claims</Button>}>
              {!claims.data || !dash.data ? <Loading h={200} /> : (
                <div className="stack gap-16">
                  <div>
                    <div className="row between"><span className="t-card">Recovered vs target</span><span className="tnum strong">{inrShort(dash.data.recovered)} <span className="faint">/ {inrShort(dash.data.target)}</span></span></div>
                    <div className="mt-8"><Meter value={dash.data.recovered / dash.data.target} color="var(--success)" label="Recovery progress" /></div>
                  </div>
                  <BarList items={['open', 'filed', 'recovered', 'rejected', 'written_off', 'resolved'].filter((k) => cl[k]).map((k) => ({ key: k, label: CLAIM_STATUS[k].label, value: cl[k].amount, sub: `${num(cl[k].count)}`, color: `var(--${CLAIM_STATUS[k].tone === 'neutral' ? 'c-norate' : CLAIM_STATUS[k].tone})` }))} format={inrShort} />
                  <p className="t-meta">Recovery rate: <span className="strong">{pct(claimTotal ? (cl.recovered?.recovered ?? 0) / claimTotal : null)}</span> of all claim value.</p>
                </div>
              )}
            </Card>
          </div>

          <div className="grid-2">
            <Card title="Returns performance" sub="All returned orders" actions={<Button size="sm" variant="ghost" href="/returns" iconRight={ArrowRight}>Returns</Button>}>
              {!returns.data ? <Loading h={140} /> : (
                <div className="stack gap-16">
                  <div className="dist" style={{ height: 12 }}>
                    {[['received', 'var(--success)'], ['awaiting', 'var(--c-short)'], ['not_received', 'var(--c-unpaid)']].map(([k, c]) => rc[k]?.count ? <i key={k} style={{ width: `${(rc[k].count / rTotal) * 100}%`, background: c }} /> : null)}
                  </div>
                  <div className="stat-tiles">
                    <div className="stat-tile"><div className="st-label">Received</div><div className="st-value">{num(rc.received?.count ?? 0)}</div><div className="t-meta">{pct(rTotal ? (rc.received?.count ?? 0) / rTotal : null)}</div></div>
                    <div className="stat-tile"><div className="st-label">In grace period</div><div className="st-value">{num(rc.awaiting?.count ?? 0)}</div></div>
                    <div className="stat-tile"><div className="st-label">Missing</div><div className="st-value neg">{num(rc.not_received?.count ?? 0)}</div><div className="t-meta">{inrShort(rc.not_received?.value ?? 0)}</div></div>
                  </div>
                </div>
              )}
            </Card>
            <Card title="Tax deducted by partners" sub="GST TCS and income tax TDS. Tax credits, not leakage." actions={<Button size="sm" variant="ghost" href="/reports/tax" iconRight={ArrowRight}>By month</Button>}>
              {tax.error && !tax.data ? <ErrorState compact title="Couldn’t load tax deductions" message={tax.error} onRetry={tax.reload} /> : !tax.data ? <Loading h={140} /> : (
                <div className="stat-tiles">
                  <div className="stat-tile"><div className="st-label">Net settled</div><div className="st-value">{inrShort(taxTot.net)}</div></div>
                  <div className="stat-tile"><div className="st-label">GST TCS</div><div className="st-value">{inrShort(taxTot.tcs)}</div></div>
                  <div className="stat-tile"><div className="st-label">Income tax TDS</div><div className="st-value">{inrShort(taxTot.tds)}</div></div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
