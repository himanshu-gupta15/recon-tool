'use client';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Card, Button, StatusBadge, ClaimBadge, Money, EmptyState } from '@/components/ui';
import DataTable from '@/components/Table';
import { age } from '@/lib/format';

// For freight the comparison is rate card vs billed; for returns it's the order value at risk.
export function claimFigures(c) {
  const o = c.order ?? {};
  if (c.type === 'freight_overcharged') return { expected: o.freightExpected, actual: o.freightCharged, diff: -(c.amount), actualLabel: 'Billed' };
  if (c.type === 'return_not_received') return { expected: o.value, actual: null, diff: -c.amount, actualLabel: 'Scanned' };
  return { expected: o.expected, actual: o.received, diff: o.gap ?? -c.amount, actualLabel: 'Received' };
}

export default function ExceptionsCard({ rows, canOrders }) {
  const router = useRouter();
  const columns = [
    { key: 'orderId', header: 'Order', mobile: 'primary', render: (c) => <><div className="cell-main mono">{c.orderId}</div><div className="cell-sub truncate" style={{ maxWidth: 170 }}>{c.partner}</div></> },
    { key: 'type', header: 'Issue', render: (c) => <StatusBadge status={c.type} /> },
    { key: 'expected', header: 'Expected', align: 'num', render: (c) => <Money value={claimFigures(c).expected} /> },
    { key: 'actual', header: 'Received', align: 'num', render: (c) => { const f = claimFigures(c); return f.actual === null ? <span className="faint">{c.type === 'return_not_received' ? 'No scan' : '—'}</span> : <Money value={f.actual} />; } },
    { key: 'diff', header: 'Difference', align: 'num', render: (c) => <Money value={claimFigures(c).diff} signed /> },
    { key: 'age', header: 'Age', align: 'num', render: (c) => <span className="muted tnum">{age(c.ageFrom)}</span> },
    { key: 'status', header: 'Status', mobile: 'status', render: (c) => <ClaimBadge status={c.status} /> },
  ];
  return (
    <Card
      flush title="Exceptions requiring attention" sub="Largest open claims first"
      actions={<Button size="sm" variant="ghost" href="/claims">All claims</Button>}
    >
      <DataTable
        columns={columns} rows={rows} rowKey={(c) => c._id} chevron={canOrders}
        onRowClick={canOrders ? (c) => router.push(`/orders/${encodeURIComponent(c.orderId)}`) : undefined}
        empty={<EmptyState icon={CheckCircle2} title="No open exceptions" compact>Every order in this period is matched or still inside its settlement window.</EmptyState>}
      />
    </Card>
  );
}
