'use client';
import { Users } from 'lucide-react';
import { useApi } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/roles';
import { initials } from '@/lib/format';
import { useApp } from '@/components/shell/AppContext';
import { Card, Badge, EmptyState } from '@/components/ui';
import DataTable from '@/components/Table';

export default function Team() {
  const { user } = useApp();
  const q = useApi('/users');
  const columns = [
    { key: 'name', header: 'Member', mobile: 'primary', render: (u) => <div className="row gap-12"><span className="avatar sm">{initials(u.name)}</span><div><div className="cell-main">{u.name}{u.email === user.email && <span className="faint"> (you)</span>}</div><div className="cell-sub">{u.email}</div></div></div> },
    { key: 'role', header: 'Role', mobile: 'status', render: (u) => <Badge tone={u.role === 'cofounder' ? 'accent' : 'neutral'} plain>{ROLE_LABEL[u.role] ?? u.role}</Badge> },
  ];
  return (
    <Card flush title="Team" sub={q.data ? `${q.data.length} people can sign in` : 'People who can sign in'}>
      <DataTable columns={columns} rows={q.data} loading={q.loading} error={q.error} onRetry={q.reload} rowKey={(u) => u.email} empty={<EmptyState icon={Users} title="No team members">Add users to the database to give them access.</EmptyState>} />
      <div className="table-foot">Inviting and removing members isn’t available in the app yet. Users are managed in the database.</div>
    </Card>
  );
}
