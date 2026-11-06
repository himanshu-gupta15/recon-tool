'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Ban, Banknote, CalendarClock, FileSearch, FileText, Lock, PackageCheck, PackageX, ShoppingCart, Truck, Warehouse } from 'lucide-react';
import { useApi } from '@/lib/api';
import { STATUS, SOURCE_LABEL, CLAIM_STATUS, claimRef } from '@/lib/status';
import { day, inr } from '@/lib/format';
import { can } from '@/lib/roles';
import { useApp } from '@/components/shell/AppContext';
import { Card, StatusBadge, ClaimBadge, Money, Alert, EmptyState, ErrorState, Skeleton, Button, Badge } from '@/components/ui';
import DataTable from '@/components/Table';
import { ClaimActionDialog, ClaimActions } from '@/components/claims/ClaimAction';

const LINE_ICON = { settlement: Banknote, cod: Banknote, freight: Truck, warehouse: Warehouse };

function buildTimeline(o, lines, claims) {
  const ev = [];
  const now = Date.now();
  ev.push({ at: o.orderDate, icon: ShoppingCart, title: `Order placed on ${o.channel}`, meta: `${o.mode} · ${inr(o.value)}`, src: o.sourceFile && `${o.sourceFile}, row ${o.sourceRow}` });
  if (o.deliveredDate) ev.push({ at: o.deliveredDate, icon: PackageCheck, title: 'Delivered to customer', meta: [o.courier, o.awb].filter(Boolean).join(' · ') });
  if (o.returnedDate) ev.push({ at: o.returnedDate, icon: PackageX, title: 'Returned by courier', meta: [o.courier, o.awb].filter(Boolean).join(' · '), tone: 'warning' });
  for (const l of lines) {
    const t = { settlement: 'Settlement received', cod: 'COD remitted by courier', freight: 'Freight billed', warehouse: 'Return scanned at warehouse' }[l.sourceType];
    const meta = l.sourceType === 'warehouse' ? (l.condition ?? 'Scanned') : `${inr(l.amount)}${l.tcs || l.tds ? ` + ${inr((l.tcs ?? 0) + (l.tds ?? 0))} tax` : ''}${l.reference ? ` · ${l.reference}` : ''}${l.chargedWeight ? ` · billed ${l.chargedWeight / 1000} kg` : ''}`;
    ev.push({ at: l.date, icon: LINE_ICON[l.sourceType], title: `${t}${l.state === 'manual' ? ' (linked by reviewer)' : ''}`, meta: `${l.partner} · ${meta}`, src: `${l.sourceFile}, row ${l.sourceRow}`, tone: 'info' });
  }
  if (o.dueDate && !lines.some((l) => ['settlement', 'cod'].includes(l.sourceType))) ev.push({ at: o.dueDate, icon: CalendarClock, title: new Date(o.dueDate) < now ? 'Payment was due' : 'Payment due', meta: 'Settlement window from the rate card', tone: new Date(o.dueDate) < now ? 'critical' : undefined, future: new Date(o.dueDate) > now });
  if (o.returnDueBy && o.returnStatus !== 'received') ev.push({ at: o.returnDueBy, icon: CalendarClock, title: o.returnStatus === 'not_received' ? 'Return was due at warehouse' : 'Return due at warehouse', meta: 'Courier grace period', tone: o.returnStatus === 'not_received' ? 'critical' : undefined, future: new Date(o.returnDueBy) > now });
  for (const c of claims) {
    ev.push({ at: c.createdAt, icon: FileText, title: `Claim raised: ${STATUS[c.type]?.label}`, meta: `${inr(c.amount)} against ${c.partner}`, tone: 'warning' });
    for (const h of c.history ?? []) ev.push({ at: h.at, icon: h.to === 'written_off' ? Ban : FileText, title: `Claim ${CLAIM_STATUS[h.to]?.label.toLowerCase() ?? h.to}`, meta: `${h.by === 'system' ? 'System' : h.by}${h.note ? ` · “${h.note}”` : ''}`, tone: CLAIM_STATUS[h.to]?.tone });
  }
  return ev.filter((e) => e.at).sort((a, b) => new Date(a.at) - new Date(b.at));
}

function Explanation({ o }) {
  const s = STATUS[o.status];
  const feeLess = o.expected !== null && o.expected !== undefined && o.delivery !== 'returned' ? o.expected - o.value : null;
  return (
    <Card title="How this was reconciled" sub={o.calc ?? 'Expected payout comes from the channel rate card in force on the order date.'}>
      <div className="stack gap-16">
        <div className="callout" style={{ background: `var(--${s?.tone ?? 'neutral'}-bg)`, borderColor: `var(--${s?.tone ?? 'neutral'}-line)` }}>
          <FileSearch aria-hidden="true" style={{ color: `var(--${s?.tone ?? 'neutral'})` }} />
          <div><div className="strong">Reason: {s?.label ?? o.status}</div><div className="t-meta" style={{ color: 'var(--ink-2)' }}>{s?.reason}</div></div>
        </div>
        {o.expected === null || o.expected === undefined ? (
          <Alert tone={o.status === 'missing_rate_card' ? 'warning' : 'info'} title={o.status === 'missing_rate_card' ? 'Expected payout not calculated' : 'Nothing to compare yet'}>
            {o.status === 'missing_rate_card' ? <>Add a rate card for {o.channel} that covers {day(o.orderDate)} and orders recalculate automatically. <Link className="link" href="/settings/rate-cards">Rate cards</Link></> : o.status === 'cancelled' ? 'Cancelled orders expect no payment.' : 'The order is in transit or inside its settlement window.'}
          </Alert>
        ) : (
          <div className="calc">
            <div className="calc-row"><div className="calc-label">Order value</div><div className="calc-val">{inr(o.value)}</div></div>
            {feeLess !== null && <div className="calc-row indent"><div><div className="calc-label">Less channel fees</div><div className="calc-sub">{o.calc}</div></div><div className="calc-val">{inr(feeLess)}</div></div>}
            {o.delivery === 'returned' && <div className="calc-row indent"><div><div className="calc-label">Return adjustment</div><div className="calc-sub">{o.calc}</div></div><div className="calc-val">{inr(o.expected - o.value)}</div></div>}
            <div className="calc-row total"><div className="calc-label">Expected payout</div><div className="calc-val">{inr(o.expected)}</div></div>
            <div className="calc-row indent"><div className="calc-label">Net paid by partner</div><div className="calc-val">{inr(o.net)}</div></div>
            <div className="calc-row indent"><div><div className="calc-label">GST TCS deducted</div><div className="calc-sub">Tax credit, counted as received</div></div><div className="calc-val">{inr(o.tcs)}</div></div>
            <div className="calc-row indent"><div><div className="calc-label">Income tax TDS deducted</div><div className="calc-sub">Tax credit, counted as received</div></div><div className="calc-val">{inr(o.tds)}</div></div>
            <div className="calc-row total"><div className="calc-label">Partner payout received</div><div className="calc-val">{inr(o.received)}</div></div>
            <div className="calc-row result"><div><div className="calc-label strong">Difference</div><div className="calc-sub">Gaps of ₹10 or less are not flagged</div></div><div className="calc-val"><Money value={o.gap} signed /></div></div>
          </div>
        )}
        {(o.freightExpected !== null && o.freightExpected !== undefined) || o.freightCharged > 0 ? (
          <div className="calc">
            <div className="calc-row"><div><div className="calc-label">Freight per rate card</div><div className="calc-sub">{o.weight ? `${o.weight / 1000} kg declared` : 'No declared weight'} · zone {o.zone ?? '—'}</div></div><div className="calc-val">{inr(o.freightExpected)}</div></div>
            <div className="calc-row"><div className="calc-label">Freight billed by {o.courier}</div><div className="calc-val">{inr(o.freightCharged)}</div></div>
            <div className="calc-row result"><div className="calc-label strong">Freight difference</div><div className="calc-val"><Money value={o.freightExpected === null || o.freightExpected === undefined ? null : o.freightExpected - o.freightCharged} signed /></div></div>
          </div>
        ) : null}
        {o.flags?.map((f) => <Alert key={f} tone="warning">{f}</Alert>)}
      </div>
    </Card>
  );
}

function Timeline({ events }) {
  return (
    <Card title="Evidence timeline" sub="Every record that shaped this result">
      <ol className="timeline">
        {events.map((e, i) => (
          <li key={i} style={e.future ? { opacity: 0.6 } : undefined}>
            <span className={`tl-dot ${e.tone ?? ''}`}><e.icon aria-hidden="true" /></span>
            <div style={{ minWidth: 0 }}>
              <div className="tl-title">{e.title}</div>
              <div className="tl-meta">{day(e.at)}{e.future ? ' · upcoming' : ''} · {e.meta}</div>
              {e.src && <div className="tl-src"><span className="tag mono" style={{ fontSize: 11.5 }}>{e.src}</span></div>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default function OrderPage({ params }) {
  const { orderId: raw } = use(params);
  const orderId = decodeURIComponent(raw);
  const { user, refreshCounts, toast } = useApp();
  const q = useApi(can(user, 'orders') ? `/orders/${encodeURIComponent(orderId)}` : null);
  const [action, setAction] = useState(null);

  if (!can(user, 'orders')) return <Card><EmptyState icon={Lock} title="Order details aren’t available for your role">Returns managers can see return claims and warehouse scans. Ask a finance teammate for payment details.</EmptyState></Card>;
  if (q.error && !q.data) return <Card>{q.error === 'Order not found' ? <EmptyState icon={FileSearch} title="Order not found" actions={<Button href="/reconciliation" icon={ArrowLeft}>Back to reconciliation</Button>}>No order with ID <b className="mono">{orderId}</b> has been imported. Check the ID or upload the orders file that contains it.</EmptyState> : <ErrorState message={q.error} onRetry={q.reload} />}</Card>;
  if (!q.data) return (
    <div className="stack gap-24"><Skeleton w={260} h={26} /><Skeleton h={88} r={10} /><div className="grid-main"><Skeleton h={420} r={10} /><Skeleton h={420} r={10} /></div></div>
  );

  const { order: o, lines, claims } = q.data;
  const events = buildTimeline(o, lines, claims);
  const lineCols = [
    { key: 'type', header: 'Source', mobile: 'primary', render: (l) => <><div className="cell-main">{SOURCE_LABEL[l.sourceType]}</div><div className="cell-sub">{l.partner}{l.state === 'manual' ? ' · linked by reviewer' : ''}</div></> },
    { key: 'reference', header: 'Reference', render: (l) => <span className="mono">{l.reference ?? '—'}</span> },
    { key: 'date', header: 'Date', render: (l) => <span className="nowrap">{day(l.date)}</span> },
    { key: 'amount', header: 'Amount', align: 'num', render: (l) => (l.amount === undefined ? <span className="faint">—</span> : <Money value={l.amount} />) },
    { key: 'tax', header: 'TCS + TDS', align: 'num', render: (l) => (l.tcs || l.tds ? <Money value={(l.tcs ?? 0) + (l.tds ?? 0)} /> : <span className="faint">—</span>) },
    { key: 'src', header: 'File', render: (l) => <span className="t-meta">{l.sourceFile} · row {l.sourceRow}</span> },
  ];
  const tone = STATUS[o.status]?.tone;

  return (
    <>
      <div className="page-head" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <Link href="/reconciliation" className="t-meta row gap-4" style={{ marginBottom: 8, display: 'inline-flex' }}><ArrowLeft aria-hidden="true" style={{ width: 14, height: 14 }} />Reconciliation</Link>
          <div className="row wrap gap-12"><h1 className="t-page mono" style={{ fontSize: 22, letterSpacing: '-0.02em' }}>{o.orderId}</h1><StatusBadge status={o.status} />{o.manual && <Badge tone="accent" plain>Reviewed</Badge>}</div>
          <p className="sub row wrap" style={{ gap: '4px 14px' }}>
            <span>{o.channel}</span><span>{o.mode}</span><span>Placed {day(o.orderDate)}</span>{o.courier && <span>{o.courier}</span>}{o.awb && <span className="mono">{o.awb}</span>}
          </p>
        </div>
        {claims.length > 0 && <div className="page-actions"><Button href={`/claims?q=${encodeURIComponent(o.orderId)}&status=all`} icon={FileText}>View in claims</Button></div>}
      </div>

      <section className="card figures" aria-label="Amounts">
        <div className="figure"><span className="fig-label">Expected payout</span><span className="fig-value">{inr(o.expected)}</span><span className="t-meta">{o.expected === null || o.expected === undefined ? 'Not calculated' : 'From rate card'}</span></div>
        <div className="figure"><span className="fig-label">Received</span><span className="fig-value">{inr(o.received)}</span><span className="t-meta">{inr(o.net)} paid + {inr((o.tcs ?? 0) + (o.tds ?? 0))} tax</span></div>
        <div className="figure" style={tone && o.gap ? { background: `var(--${tone}-bg)` } : undefined}><span className="fig-label">Difference</span><span className="fig-value"><Money value={o.gap} signed /></span><span className="t-meta">{STATUS[o.status]?.label}</span></div>
      </section>

      <div className="grid-main mt-24">
        <div className="stack gap-24">
          <Explanation o={o} />
          {claims.length > 0 && (
            <Card flush title="Claims" sub="Recovery actions for this order">
              {claims.map((c) => (
                <div key={c._id} className="row between wrap" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-2)', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="row wrap gap-12"><span className="mono strong">{claimRef(c)}</span><StatusBadge status={c.type} /><ClaimBadge status={c.status} /></div>
                    <div className="t-meta mt-4">{c.detail}</div>
                  </div>
                  <div className="row gap-16"><span className="tnum strong">{inr(c.amount)}</span><ClaimActions claim={c} user={user} onAction={(claim, to) => setAction({ claim, to })} /></div>
                </div>
              ))}
            </Card>
          )}
          <Card flush title="Source records" sub={`${lines.length} ${lines.length === 1 ? 'line' : 'lines'} from uploaded partner files`}>
            <DataTable columns={lineCols} rows={lines} compact empty={<EmptyState icon={AlertTriangle} title="No partner records found" compact>No settlement, remittance, freight or warehouse line references this order or its AWB.</EmptyState>} />
          </Card>
        </div>
        <div className="stack gap-24">
          <Timeline events={events} />
          <Card title="Customer" sub={can(user, 'customerDetails') ? 'Visible to the co-founder only' : 'Masked for your role'}>
            <dl className="kv">
              <dt>Name</dt><dd>{o.customerName ?? <span className="faint">Not in orders file</span>}</dd>
              <dt>Phone</dt><dd className="tnum">{o.customerPhone ?? <span className="faint">Not in orders file</span>}</dd>
            </dl>
            {!can(user, 'customerDetails') && <p className="t-meta mt-12 row gap-4"><Lock aria-hidden="true" style={{ width: 12, height: 12 }} />Customer details are left out of evidence exports.</p>}
          </Card>
        </div>
      </div>
      {action && <ClaimActionDialog {...action} onClose={() => setAction(null)} onDone={(to) => { setAction(null); q.reload(); refreshCounts(); toast(`Claim ${CLAIM_STATUS[to]?.label.toLowerCase()}`); }} />}
    </>
  );
}
