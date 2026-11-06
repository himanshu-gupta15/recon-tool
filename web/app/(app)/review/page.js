'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, CircleHelp, FileWarning, Lightbulb, Link2, Plus, UserCheck } from 'lucide-react';
import { api, useApi, qs } from '@/lib/api';
import { SOURCE_LABEL } from '@/lib/status';
import { day, inr, num } from '@/lib/format';
import { useApp } from '@/components/shell/AppContext';
import { PageHeader, Tabs, Button, Money, StatusBadge, EmptyState, ErrorState, Alert, SkeletonRows, Pagination, Meter } from '@/components/ui';
import { ConfirmDialog } from '@/components/Dialog';
import DataTable from '@/components/Table';

function LineItem({ l, onLink, onReject, busy }) {
  const [typed, setTyped] = useState('');
  const sugg = l.suggestions ?? [];
  return (
    <article className="review-item" aria-label={`Partner line from ${l.partner}`}>
      <div>
        <div className="ri-label t-label"><FileWarning aria-hidden="true" style={{ width: 13, height: 13 }} />What’s wrong</div>
        <div className="strong">{l.orderId ? <>Order ID <span className="mono">{l.orderId}</span> isn’t in your orders</> : 'No order ID or AWB in this line'}</div>
        <div className="t-meta mt-4">{SOURCE_LABEL[l.sourceType]} from {l.partner} · {day(l.date)}</div>
        <div className="row wrap mt-12" style={{ gap: 6 }}>
          {l.amount !== undefined && <span className="tag tnum strong" style={{ fontSize: 13 }}>{inr(l.amount)}</span>}
          {l.reference && <span className="tag mono">{l.reference}</span>}
          <span className="tag">{l.sourceFile} · row {l.sourceRow}</span>
        </div>
      </div>
      <div>
        <div className="ri-label t-label"><Lightbulb aria-hidden="true" style={{ width: 13, height: 13 }} />What Recon suggests</div>
        {sugg.length ? sugg.map((s) => (
          <div className="suggest" key={s.orderId}>
            <div style={{ minWidth: 0 }}>
              <div className="row gap-12"><span className="mono strong">{s.orderId}</span><span className="score"><Meter value={s.score / 100} color={s.score >= 60 ? 'var(--success)' : 'var(--warning)'} label={`${s.score}% match`} />{s.score}%</span></div>
              <div className="t-meta truncate">{s.why.join(' · ')}</div>
            </div>
            <Button size="sm" icon={Link2} variant={s.score >= 60 ? 'primary' : undefined} disabled={busy} onClick={() => onLink(l, s.orderId)}>Link</Button>
          </div>
        )) : <p className="t-meta">No likely order found. The amount and ID don’t match any unpaid order within 30 days.</p>}
      </div>
      <div>
        <div className="ri-label t-label"><UserCheck aria-hidden="true" style={{ width: 13, height: 13 }} />Your decision</div>
        <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); if (typed.trim()) onLink(l, typed.trim()); }}>
          <input className="input mono sm grow" placeholder="Enter order ID" aria-label="Order ID to link" value={typed} onChange={(e) => setTyped(e.target.value)} />
          <Button size="sm" type="submit" disabled={busy || !typed.trim()}>Link</Button>
        </form>
        <Button size="sm" variant="ghost" className="mt-8" disabled={busy} onClick={() => onReject(l)}>Not ours — reject line</Button>
      </div>
    </article>
  );
}

function OrderList({ status, intro }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const q = useApi(`/orders?${qs({ status, page, size: 25 })}`);
  const rateCols = [
    { key: 'orderId', header: 'Order', mobile: 'primary', render: (o) => <span className="cell-main mono">{o.orderId}</span> },
    { key: 'channel', header: 'Channel', render: (o) => o.channel },
    { key: 'orderDate', header: 'Order date', render: (o) => day(o.orderDate) },
    { key: 'value', header: 'Order value', align: 'num', render: (o) => <Money value={o.value} /> },
    { key: 'received', header: 'Received', align: 'num', render: (o) => <Money value={o.received} /> },
    ...(status === 'overpaid' ? [{ key: 'gap', header: 'Over by', align: 'num', render: (o) => <Money value={o.gap} signed /> }] : []),
    { key: 'status', header: 'Status', mobile: 'status', render: (o) => <StatusBadge status={o.status} /> },
  ];
  return (
    <>
      {intro}
      <div className="card mt-16">
        <DataTable
          columns={rateCols} rows={q.data?.rows} loading={q.loading} error={q.error} onRetry={q.reload} chevron
          onRowClick={(o) => router.push(`/orders/${encodeURIComponent(o.orderId)}`)}
          empty={<EmptyState icon={CheckCircle2} title="Nothing to check">No orders are in this state.</EmptyState>}
        />
        {q.data && q.data.total > 0 && <Pagination page={q.data.page} size={q.data.size} total={q.data.total} onPage={setPage} noun="orders" />}
      </div>
    </>
  );
}

function Review() {
  const sp = useSearchParams();
  const { refreshCounts, toast, counts } = useApp();
  const [tab, setTab] = useState(sp.get('tab') === 'rate' ? 'rate' : sp.get('tab') === 'overpaid' ? 'overpaid' : 'lines');
  const q = useApi('/review');
  const over = useApi('/orders?status=overpaid&size=10');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [reject, setReject] = useState(null);

  const link = async (l, orderId) => {
    setBusy(true); setError('');
    try { await api(`/review/${l._id}/approve`, { json: { orderId } }); toast(`Linked to ${orderId} and re-matched`); q.reload(); refreshCounts(); }
    catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <>
      <PageHeader title="Review queue" sub="Records Recon couldn’t match on its own. Nothing here changes a result until a person decides." />
      <Tabs label="Queue" value={tab} onChange={setTab} items={[
        { value: 'lines', label: 'Unmatched partner lines', count: q.data?.total },
        { value: 'rate', label: 'Missing rate card', count: counts?.noRateCard },
        { value: 'overpaid', label: 'Possible overpayments', count: over.data?.total },
      ]} />
      {tab === 'lines' && (
        <>
          {error && <div style={{ marginBottom: 12 }}><Alert tone="critical" title="Couldn’t link this line">{error}</Alert></div>}
          <div className="card">
            {q.error && !q.data ? <ErrorState message={q.error} onRetry={q.reload} /> : !q.data ? <SkeletonRows rows={4} cols={3} /> : q.data.rows.length ? (
              q.data.rows.map((l) => <LineItem key={l._id} l={l} busy={busy} onLink={link} onReject={setReject} />)
            ) : <EmptyState icon={CheckCircle2} title="Nothing to review">Every partner line is linked to an order. New lines without a usable ID will appear here after the next upload.</EmptyState>}
          </div>
          {q.data && q.data.total > q.data.rows.length && <p className="t-meta mt-12">Showing the newest {num(q.data.rows.length)} of {num(q.data.total)}. Resolve these to see more.</p>}
        </>
      )}
      {tab === 'rate' && (
        <OrderList status="missing_rate_card" intro={
          <Alert tone="warning" title="Expected payout can’t be calculated" actions={<Button size="sm" icon={Plus} href="/settings/rate-cards">Add rate card</Button>}>
            These orders’ channels had no rate card in force on the order date. <b>Suggested fix:</b> add a rate card version that starts on or before the earliest order date. Orders recalculate as soon as you save.
          </Alert>
        } />
      )}
      {tab === 'overpaid' && (
        <OrderList status="overpaid" intro={
          <Alert tone="info" title="Received more than expected">
            Usually a duplicate payout, a payment for a cancelled order, or an outdated rate card. <b>What to decide:</b> open each order, check the source lines, and confirm with the partner before relying on the credit.
          </Alert>
        } />
      )}
      <ConfirmDialog
        open={!!reject} onClose={() => setReject(null)} icon={AlertTriangle} title="Reject this partner line?" confirmLabel="Reject line"
        description={reject && <>{SOURCE_LABEL[reject.sourceType]} from {reject.partner}{reject.amount !== undefined ? ` · ${inr(reject.amount)}` : ''}</>}
        consequence="The line is excluded from reconciliation and won’t be suggested again. Use this only for lines that don’t belong to your orders. This can’t be undone from the app."
        onConfirm={async () => { await api(`/review/${reject._id}/reject`, { json: {} }); setReject(null); toast('Line rejected'); q.reload(); refreshCounts(); }}
      />
      <p className="t-meta mt-16 row gap-4"><CircleHelp aria-hidden="true" style={{ width: 13, height: 13 }} />Suggestions are scored by rules (similar ID digits, matching expected amount within 30 days), not AI.</p>
    </>
  );
}

export default function Page() { return <Suspense fallback={null}><Review /></Suspense>; }
