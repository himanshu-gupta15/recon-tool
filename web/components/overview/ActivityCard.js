'use client';
import Link from 'next/link';
import { History } from 'lucide-react';
import { useApi } from '@/lib/api';
import { describeAudit, describeUpload, actorName } from '@/lib/activity';
import { relative } from '@/lib/format';
import { can } from '@/lib/roles';
import { Card, Button, EmptyState, Skeleton } from '@/components/ui';

export default function ActivityCard({ user }) {
  const canAudit = can(user, 'audit');
  const audit = useApi(canAudit ? '/audit?size=8' : null);
  const uploads = useApi('/uploads');
  const loading = (canAudit && !audit.data && !audit.error) || (!uploads.data && !uploads.error);
  const items = [
    ...(audit.data?.rows ?? []).map((a) => ({ id: a._id, at: a.at, by: a.by, ...describeAudit(a) })),
    ...(uploads.data ?? []).filter((u) => u.status !== 'importing').map((u) => ({ id: u._id, at: u.importedAt ?? u.createdAt, by: u.by, ...describeUpload(u) })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 7);
  return (
    <Card flush title="Recent activity" actions={canAudit && <Button size="sm" variant="ghost" href="/audit">Audit log</Button>}>
      {loading ? (
        <div style={{ padding: 18 }} className="stack gap-16">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="row gap-12"><Skeleton w={30} h={30} r={15} /><div className="grow stack gap-4"><Skeleton w="80%" h={12} /><Skeleton w="40%" h={10} /></div></div>)}</div>
      ) : items.length ? (
        <ul className="activity">
          {items.map((it) => (
            <li key={it.id}>
              <span className="act-icon" style={it.tone !== 'neutral' ? { background: `var(--${it.tone}-bg)`, color: `var(--${it.tone})`, borderColor: `var(--${it.tone}-line)` } : undefined}><it.icon aria-hidden="true" /></span>
              <div style={{ minWidth: 0 }}>
                <div className="act-text"><span className="strong">{actorName(it.by, user)}</span> {it.text}</div>
                <div className="act-meta">{it.href ? <Link href={it.href} className="link" style={{ fontSize: 12 }}>{it.object}</Link> : it.object} · {relative(it.at)}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={History} title="No activity yet" compact>Uploads, approvals and claim updates will show up here.</EmptyState>
      )}
    </Card>
  );
}
