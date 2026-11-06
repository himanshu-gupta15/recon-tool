'use client';
import { Fragment, useState } from 'react';
import Link from 'next/link';
import { ScrollText, SearchX } from 'lucide-react';
import { useApi, qs } from '@/lib/api';
import { describeAudit, actorName } from '@/lib/activity';
import { dayLabel, time, initials } from '@/lib/format';
import { useApp } from '@/components/shell/AppContext';
import { PageHeader, Segmented, Pagination, EmptyState, ErrorState, SkeletonRows, Button } from '@/components/ui';

const KINDS = [['', 'All'], ['upload', 'Uploads'], ['claim.', 'Claims'], ['review', 'Review'], ['card', 'Rate cards'], ['claims.export', 'Exports']];

export default function Audit() {
  const { user } = useApp();
  const [action, setAction] = useState(''); const [by, setBy] = useState(''); const [page, setPage] = useState(1);
  const q = useApi(`/audit?${qs({ action, by, page, size: 40 })}`);
  const rows = q.data?.rows ?? [];
  const groups = [];
  for (const r of rows) {
    const label = dayLabel(r.at);
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] });
    groups.at(-1).items.push(r);
  }
  return (
    <>
      <PageHeader title="Audit log" sub="Every approval, claim update, review decision, export and rate change, with who did it and when. Read-only." />
      <div className="card">
        <div className="table-toolbar">
          <Segmented label="Action type" value={action} onChange={(v) => { setAction(v); setPage(1); }} options={KINDS} />
          <select className="select sm" aria-label="User" value={by} onChange={(e) => { setBy(e.target.value); setPage(1); }}>
            <option value="">All people</option>
            {q.data?.users.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        {q.error && !q.data ? <ErrorState message={q.error} onRetry={q.reload} /> : !q.data ? <SkeletonRows cols={4} /> : !rows.length ? (
          action || by
            ? <EmptyState icon={SearchX} title="No matching events" actions={<Button onClick={() => { setAction(''); setBy(''); }}>Clear filters</Button>}>Try another action type or person.</EmptyState>
            : <EmptyState icon={ScrollText} title="No activity recorded yet">Approving a column mapping, updating a claim, resolving the review queue or editing a rate card will be recorded here.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table responsive">
              <thead><tr><th style={{ width: 90 }}>Time</th><th>Event</th><th>Object</th><th>Details</th></tr></thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.label}>
                    <tr><td colSpan={4} className="m-primary" style={{ background: 'var(--surface-2)', height: 32, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{g.label}</td></tr>
                    {g.items.map((a) => {
                      const d = describeAudit(a);
                      return (
                        <tr key={a._id}>
                          <td className="tnum muted m-status" style={{ fontSize: 12.5 }}>{time(a.at)}</td>
                          <td className="m-primary">
                            <div className="row gap-12" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', padding: '10px 0' }}>
                              <span className="avatar sm" style={{ background: `var(--${d.tone === 'neutral' ? 'sunken' : d.tone + '-bg'})`, color: `var(--${d.tone === 'neutral' ? 'muted' : d.tone})` }} title={a.by}>{initials(actorName(a.by, user) === 'You' ? user.name : a.by)}</span>
                              <span style={{ lineHeight: '19px', paddingTop: 3 }}><span className="strong">{actorName(a.by, user)}</span> {d.text}</span>
                            </div>
                          </td>
                          <td data-label="Object">{d.href ? <Link href={d.href} className="link mono">{d.object}</Link> : <span className="tag">{d.object}</span>}</td>
                          <td data-label="Details" className="muted" style={{ fontSize: 12.5, maxWidth: 320 }}>{d.note ? `“${d.note}”` : <span className="faint">—</span>}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {q.data && q.data.total > 0 && <Pagination page={q.data.page} size={q.data.size} total={q.data.total} onPage={setPage} noun="events" />}
      </div>
    </>
  );
}
