'use client';
import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { useApi, qs } from '@/lib/api';
import { can } from '@/lib/roles';
import { relative } from '@/lib/format';
import { useApp } from '@/components/shell/AppContext';
import { PageHeader, Button, ErrorState, Skeleton, Alert } from '@/components/ui';
import RangePicker, { rangeQuery } from '@/components/RangePicker';
import KpiStrip, { KpiSkeleton } from '@/components/overview/KpiStrip';
import HealthCard from '@/components/overview/HealthCard';
import ExceptionsCard from '@/components/overview/ExceptionsCard';
import ActivityCard from '@/components/overview/ActivityCard';
import AttentionCard from '@/components/overview/AttentionCard';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

export default function Overview() {
  const { user, counts } = useApp();
  const [range, setRange] = useState({ days: '30' });
  const [hello, setHello] = useState('Welcome');
  useEffect(() => setHello(greeting()), []);
  const q = useApi(`/overview?${qs(rangeQuery(range))}`);
  const d = q.data;
  const canOrders = can(user, 'orders');
  const first = user.name.split(' ')[0];
  const noData = d && !d.current.orders && !d.previous?.orders && range.days === 'all';

  return (
    <>
      <PageHeader
        title={`${hello}, ${first}`}
        sub={<>Here’s your reconciliation overview.{d?.lastRun && <span className="faint"> Last matched {relative(d.lastRun)}.</span>}</>}
        actions={<><RangePicker value={range} onChange={setRange} /><Button href="/uploads" icon={Upload} variant="primary">Upload</Button></>}
      />
      {q.error && !d ? <div className="card"><ErrorState message={q.error} onRetry={q.reload} /></div> : (
        <div className="stack gap-24" style={{ opacity: q.loading && d ? 0.6 : 1, transition: 'opacity .15s' }}>
          {noData && <Alert tone="info" title="No orders yet" actions={<Button size="sm" href="/uploads">Upload orders</Button>}>Upload your orders file first, then partner settlement, COD, freight and warehouse reports.</Alert>}
          {d ? <KpiStrip d={d} canOrders={canOrders} /> : <KpiSkeleton />}
          <div className="grid-main">
            {d ? <HealthCard d={d} canOrders={canOrders} /> : <div className="card"><div className="card-body"><Skeleton w={180} h={14} /><Skeleton h={10} style={{ marginTop: 24 }} /><Skeleton h={220} style={{ marginTop: 28 }} /></div></div>}
            <AttentionCard counts={counts} user={user} />
          </div>
          <div className="grid-main">
            {d ? <ExceptionsCard rows={d.exceptions} canOrders={canOrders} /> : <div className="card"><div className="card-body"><Skeleton h={300} /></div></div>}
            <ActivityCard user={user} />
          </div>
        </div>
      )}
    </>
  );
}
