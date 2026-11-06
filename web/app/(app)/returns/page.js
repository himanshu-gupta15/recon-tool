'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, PackageCheck, PackageSearch, PackageX, Timer, Undo2, Upload } from 'lucide-react';
import { useApi, qs } from '@/lib/api';
import { day, inrShort, num, daysSince } from '@/lib/format';
import { can } from '@/lib/roles';
import { useApp } from '@/components/shell/AppContext';
import { PageHeader, Tabs, Badge, Money, Pagination, EmptyState, Button, Skeleton } from '@/components/ui';
import DataTable from '@/components/Table';

const VIEW = {
  not_received: { label: 'Missing', badge: ['critical', 'Missing'] },
  awaiting: { label: 'In grace period', badge: ['warning', 'Awaiting scan'] },
  received: { label: 'Received', badge: ['success', 'Received'] },
  all: { label: 'All returns' },
};

function Kpi({ icon: Icon, label, value, foot, tone }) {
  return (
    <div className="kpi">
      <span className="kpi-label"><Icon aria-hidden="true" style={tone ? { color: `var(--${tone})` } : undefined} />{label}</span>
      <span className="kpi-value">{value ?? <Skeleton w={60} h={24} />}</span>
      <span className="kpi-foot">{foot}</span>
    </div>
  );
}

export default function Returns() {
  const { user } = useApp();
  const [view, setView] = useState('not_received'); const [page, setPage] = useState(1);
  const q = useApi(`/returns?${qs({ view, page })}`);
  const claims = useApi('/claims/summary?type=return_not_received');
  const [counts, setCounts] = useState(null);
  if (q.data?.counts && q.data.counts !== counts) setCounts(q.data.counts);
  const c = counts ?? {};
  const total = ['not_received', 'awaiting', 'received'].reduce((t, k) => t + (c[k]?.count ?? 0), 0);
  const cl = claims.data ?? {};
  const claimCount = (cl.open?.count ?? 0) + (cl.filed?.count ?? 0);
  const canOrders = can(user, 'orders');

  const columns = [
    { key: 'orderId', header: 'Order', mobile: 'primary', render: (o) => <><div className="cell-main mono">{canOrders ? <Link href={`/orders/${encodeURIComponent(o.orderId)}`} className="link mono" style={{ color: 'var(--ink)' }}>{o.orderId}</Link> : o.orderId}</div><div className="cell-sub mono">{o.awb ?? 'No AWB'}</div></> },
    { key: 'channel', header: 'Channel', render: (o) => o.channel },
    { key: 'courier', header: 'Courier', render: (o) => o.courier ?? '—' },
    { key: 'value', header: 'Order value', align: 'num', render: (o) => <Money value={o.value} /> },
    { key: 'returnedDate', header: 'Returned', render: (o) => day(o.returnedDate) },
    { key: 'due', header: dueLabel(view), render: (o) => (o.returnStatus === 'received' ? <>{day(o.scanDate)}{o.scanCondition && <span className={`cell-sub ${o.scanCondition === 'Damaged' ? 'neg' : ''}`} style={{ display: 'block' }}>{o.scanCondition}</span>}</> : day(o.returnDueBy)) },
    { key: 'late', header: 'Overdue', align: 'num', render: (o) => (o.returnStatus === 'not_received' ? <span className="neg tnum strong">{daysSince(o.returnDueBy)} days</span> : <span className="faint">—</span>) },
    { key: 'status', header: 'Status', mobile: 'status', render: (o) => { const b = VIEW[o.returnStatus]?.badge; return b ? <Badge tone={b[0]}>{b[1]}</Badge> : null; } },
  ];

  return (
    <>
      <PageHeader title="Returns" sub="Returned parcels checked against warehouse receipt scans. A return with no scan after the courier’s grace period becomes a claim." actions={<Button href="/uploads" icon={Upload}>Upload warehouse scans</Button>} />
      <section className="kpis cols-5" aria-label="Returns summary" style={{ marginBottom: 20 }}>
        <Kpi icon={Undo2} label="Returns" value={counts && num(total)} foot={counts && <span>{inrShort(['not_received', 'awaiting', 'received'].reduce((t, k) => t + (c[k]?.value ?? 0), 0))} order value</span>} />
        <Kpi icon={PackageCheck} tone="success" label="Received" value={counts && num(c.received?.count ?? 0)} foot={counts && total ? `${Math.round(((c.received?.count ?? 0) / total) * 100)}% scanned in` : ''} />
        <Kpi icon={Timer} tone="warning" label="Pending" value={counts && num(c.awaiting?.count ?? 0)} foot="Inside grace period" />
        <Kpi icon={PackageX} tone="critical" label="Missing" value={counts && num(c.not_received?.count ?? 0)} foot={counts && `${inrShort(c.not_received?.value ?? 0)} at order value`} />
        <Kpi icon={PackageSearch} label="Return claims" value={claims.data && num(claimCount)} foot={claims.data && <span><span className="pos strong">{inrShort(cl.recovered?.recovered ?? 0)}</span> recovered</span>} />
      </section>
      <div className="card">
        <div style={{ padding: '0 14px' }}>
          <Tabs label="Return status" value={view} onChange={(v) => { setView(v); setPage(1); }} items={[
            { value: 'not_received', label: 'Missing', count: c.not_received?.count },
            { value: 'awaiting', label: 'In grace period', count: c.awaiting?.count },
            { value: 'received', label: 'Received', count: c.received?.count },
            { value: 'all', label: 'All', count: counts ? total : undefined },
          ]} />
        </div>
        <DataTable
          columns={columns} rows={q.data?.rows} loading={q.loading} error={q.error} onRetry={q.reload}
          empty={view === 'not_received'
            ? <EmptyState icon={CheckCircle2} title="No missing returns">Every return past its grace period has a warehouse scan.</EmptyState>
            : <EmptyState icon={Undo2} title="No returns here" actions={<Button href="/uploads" icon={Upload}>Upload warehouse scans</Button>}>Returned orders show up once the orders file marks them as returned.</EmptyState>}
        />
        {q.data && q.data.total > 0 && <Pagination page={q.data.page} size={q.data.size} total={q.data.total} onPage={setPage} noun="returns" />}
      </div>
      <p className="t-meta mt-12">Missing returns are valued at order value because product cost isn’t in the uploaded files.</p>
    </>
  );
}

function dueLabel(view) { return view === 'received' ? 'Scanned' : view === 'all' ? 'Due / scanned' : 'Due by'; }
