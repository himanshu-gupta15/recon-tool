'use client';
import { useRouter } from 'next/navigation';
import { Card, EmptyState, Button } from '@/components/ui';
import { Distribution, StackedColumns } from '@/components/charts';
import { HEALTH_ORDER, STATUS } from '@/lib/status';
import { dayShort, inrShort, pct } from '@/lib/format';
import { Activity, Upload } from 'lucide-react';

const TREND_KEYS = [...HEALTH_ORDER, 'pending'];

export default function HealthCard({ d, canOrders }) {
  const router = useRouter();
  const st = d.current.statuses;
  const eligible = HEALTH_ORDER.reduce((t, k) => t + (st[k]?.count ?? 0), 0);
  const items = HEALTH_ORDER.map((k) => ({ key: k, label: STATUS[k].label, color: STATUS[k].color, count: st[k]?.count ?? 0 }));
  const fmt = (b, long) => {
    if (d.range.unit === 'month') return new Date(b + '-01T00:00:00Z').toLocaleDateString('en-IN', { month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit', timeZone: 'UTC' });
    return long && d.range.unit === 'week' ? `Week of ${dayShort(b)}` : dayShort(b);
  };
  const short = d.current.gap;
  return (
    <Card
      title="Reconciliation health"
      sub={eligible ? <>{pct((st.settled?.count ?? 0) / eligible)} of orders due for payment are fully matched · {inrShort(-short)} short across exceptions</> : 'Orders due for payment, by outcome'}
      actions={canOrders && <Button size="sm" variant="ghost" href="/reconciliation">View all</Button>}
    >
      {!eligible ? (
        <EmptyState icon={Activity} title="No orders due for payment yet" compact actions={<Button href="/uploads" icon={Upload} variant="primary">Upload files</Button>}>
          Upload an orders file and partner reports. Results appear here once orders pass their settlement window.
        </EmptyState>
      ) : (
        <div className="stack gap-24">
          <Distribution items={items} total={eligible} onSelect={canOrders ? (k) => router.push(`/reconciliation?tab=${k}`) : undefined} />
          <div>
            <div className="row between wrap" style={{ marginBottom: 10 }}>
              <span className="t-card">Orders by {d.range.unit === 'day' ? 'day' : d.range.unit === 'week' ? 'week' : 'month'} placed</span>
              <div className="legend-inline">{TREND_KEYS.filter((k) => d.trend.some((t) => t[k])).map((k) => <span key={k}><i style={{ background: STATUS[k].color }} />{STATUS[k].label}</span>)}</div>
            </div>
            <StackedColumns data={d.trend} keys={TREND_KEYS} formatBucket={fmt} />
          </div>
        </div>
      )}
    </Card>
  );
}
