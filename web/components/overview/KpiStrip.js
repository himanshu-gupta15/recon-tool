'use client';
import Link from 'next/link';
import { AlertTriangle, BadgeIndianRupee, FileText, Package, Percent, Undo2 } from 'lucide-react';
import { Delta, Meter, Skeleton } from '@/components/ui';
import { Sparkline } from '@/components/charts';
import { change, inrShort, num, pct } from '@/lib/format';

function Kpi({ icon: Icon, label, value, foot, hero, spark, href, title }) {
  const body = <>
    <div className="kpi-label"><Icon aria-hidden="true" />{label}</div>
    <div className="kpi-value" title={title}>{value}</div>
    <div className="kpi-foot">{foot}</div>
    {spark}
  </>;
  return href ? <Link href={href} className={`kpi ${hero ? 'hero' : ''}`}>{body}</Link> : <div className={`kpi ${hero ? 'hero' : ''}`}>{body}</div>;
}

export function KpiSkeleton({ n = 6 }) {
  return (
    <div className="kpis" aria-busy="true">
      {Array.from({ length: n }).map((_, i) => <div className={`kpi ${i === 0 ? 'hero' : ''}`} key={i}><Skeleton w={90} h={11} /><Skeleton w={i === 0 ? 140 : 80} h={i === 0 ? 28 : 22} style={{ margin: '6px 0' }} /><Skeleton w={110} h={11} /></div>)}
    </div>
  );
}

export default function KpiStrip({ d, canOrders }) {
  const c = d.current; const p = d.previous;
  const rate = c.eligible ? c.settled / c.eligible : null;
  const prevRate = p?.eligible ? p.settled / p.eligible : null;
  const vs = <span>vs previous period</span>;
  const trendSettled = d.trend.map((t) => t.settled ?? 0);
  return (
    <section className="kpis" aria-label="Key metrics">
      <Kpi
        hero icon={BadgeIndianRupee} label="Amount reconciled" value={inrShort(c.reconciled)} title={`Received on ${num(c.settled)} matched orders`}
        foot={<><Delta value={p ? change(c.reconciled, p.reconciled) : null} label="All time" />{p && vs}</>}
        spark={<Sparkline values={trendSettled} width={60} height={24} />}
      />
      <Kpi
        icon={Percent} label="Settlement rate" value={rate === null ? '—' : pct(rate)}
        foot={<>{prevRate !== null && rate !== null ? <Delta value={(rate - prevRate) * 100} unit=" pts" /> : <span>{num(c.settled)} of {num(c.eligible)} due</span>}{prevRate !== null && rate !== null && vs}</>}
      />
      <Kpi
        icon={Package} label="Total orders" value={num(c.orders)} href={canOrders ? '/reconciliation' : undefined}
        foot={<><Delta neutral value={p ? change(c.orders, p.orders) : null} label={`${num(c.eligible)} due for payment`} />{p && vs}</>}
      />
      <Kpi
        icon={AlertTriangle} label="Exceptions" value={num(c.exceptions)} href={canOrders ? '/reconciliation?tab=exceptions' : undefined}
        foot={<><Delta value={p ? change(c.exceptions, p.exceptions) : null} invert label={`${pct(c.orders ? c.exceptions / c.orders : null)} of orders`} />{p && vs}</>}
      />
      <Kpi
        icon={FileText} label="Open claims" value={num(d.openClaims.count)} href="/claims"
        foot={<span><span className="strong" style={{ color: 'var(--ink-2)' }}>{inrShort(d.openClaims.amount)}</span> at stake · {num(d.openClaims.toFile)} to file</span>}
      />
      <Kpi
        icon={Undo2} label="Recovered" value={inrShort(d.recovered.amount)} href="/claims?status=recovered"
        foot={p ? <><Delta value={change(d.recovered.amount, d.recoveredPrev?.amount)} label="No recoveries before" />{d.recoveredPrev?.amount ? vs : null}</> : <div style={{ width: '100%' }}><Meter value={d.recovered.amount / d.target} label="Progress to recovery target" /><span style={{ display: 'block', marginTop: 4 }}>{pct(d.recovered.amount / d.target, 0)} of {inrShort(d.target)} target</span></div>}
      />
    </section>
  );
}
