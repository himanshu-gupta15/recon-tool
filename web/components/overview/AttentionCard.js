'use client';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, Inbox, PackageX, Upload } from 'lucide-react';
import { Card } from '@/components/ui';
import { num } from '@/lib/format';
import { can } from '@/lib/roles';

// A short work list built from live counts, so the next action is always obvious.
export default function AttentionCard({ counts, user }) {
  if (!counts) return null;
  const finance = can(user, 'review');
  const rows = [
    finance && { icon: Inbox, tone: 'info', n: counts.review, label: 'Partner lines to match', sub: 'No usable order ID', href: '/review' },
    { icon: FileText, tone: 'warning', n: counts.toFile, label: 'Claims ready to file', sub: 'Export evidence and send', href: '/claims?status=open' },
    { icon: PackageX, tone: 'critical', n: counts.missingReturns, label: 'Returns not received', sub: 'Past courier grace period', href: '/returns' },
    finance && { icon: AlertTriangle, tone: 'neutral', n: counts.noRateCard, label: 'Orders without a rate card', sub: 'Expected payout unknown', href: '/review?tab=rate' },
    counts.failedUploads > 0 && { icon: Upload, tone: 'critical', n: counts.failedUploads, label: 'Failed uploads', sub: 'Fix the mapping and retry', href: '/uploads' },
  ].filter(Boolean);
  const open = rows.filter((r) => r.n > 0);
  return (
    <Card flush title="Your queue" sub={open.length ? `${open.length} ${open.length === 1 ? 'list needs' : 'lists need'} attention` : 'Nothing waiting'}>
      <ul className="activity">
        {rows.map((r) => (
          <li key={r.label} style={{ gridTemplateColumns: '30px minmax(0,1fr) auto', alignItems: 'center' }}>
            <span className="act-icon" style={r.n ? { background: `var(--${r.tone}-bg)`, color: `var(--${r.tone})`, borderColor: `var(--${r.tone}-line)` } : undefined}>{r.n ? <r.icon aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}</span>
            <Link href={r.href} style={{ minWidth: 0 }}>
              <div className="act-text strong">{r.label}</div>
              <div className="act-meta">{r.sub}</div>
            </Link>
            <Link href={r.href} className="row gap-4" aria-label={`${r.label}: ${r.n}`}>
              <span className="tnum strong" style={{ fontSize: 15, color: r.n ? 'var(--ink)' : 'var(--faint)' }}>{num(r.n)}</span>
              <ArrowRight aria-hidden="true" style={{ width: 14, height: 14, color: 'var(--faint)' }} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
