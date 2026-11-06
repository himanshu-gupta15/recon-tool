'use client';
import { Building2 } from 'lucide-react';
import { useApi } from '@/lib/api';
import { day } from '@/lib/format';
import { Card, Badge, Button, EmptyState } from '@/components/ui';
import DataTable from '@/components/Table';

export default function Partners() {
  const q = useApi('/cards');
  const latest = new Map();
  for (const c of q.data ?? []) {
    const k = `${c.kind}|${c.partner}`;
    const cur = latest.get(k);
    if (!cur) latest.set(k, { ...c, versions: 1 }); else cur.versions++;
  }
  const rows = [...latest.values()];
  const columns = [
    { key: 'partner', header: 'Partner', mobile: 'primary', render: (c) => <div className="cell-main">{c.partner}</div> },
    { key: 'kind', header: 'Type', mobile: 'status', render: (c) => <Badge tone={c.kind === 'channel' ? 'accent' : 'neutral'} plain>{c.kind === 'channel' ? 'Sales channel' : 'Courier'}</Badge> },
    { key: 'reports', header: 'Reports', render: (c) => <span className="muted">{c.kind === 'channel' ? 'Settlement' : 'COD remittance, freight invoice'}</span> },
    { key: 'cycle', header: 'Payment cycle', render: (c) => (c.kind === 'channel' ? `${c.settlementDays} days${c.codVia === 'courier' ? ' · COD via courier' : ''}` : `${c.remittanceDays} days remittance`) },
    { key: 'card', header: 'Rate card', render: (c) => <span>{c.versions} {c.versions === 1 ? 'version' : 'versions'} · from {day(c.effectiveFrom)}</span> },
  ];
  return (
    <Card flush title="Partners" sub="Channels and couriers with a rate card. Each keeps its own saved column mappings." actions={<Button size="sm" href="/settings/rate-cards">Manage rate cards</Button>}>
      <DataTable columns={columns} rows={q.data ? rows : undefined} loading={q.loading} error={q.error} onRetry={q.reload} rowKey={(c) => c.kind + c.partner}
        empty={<EmptyState icon={Building2} title="No partners yet" actions={<Button href="/settings/rate-cards" variant="primary">Add a rate card</Button>}>A partner appears once it has a rate card.</EmptyState>} />
    </Card>
  );
}
