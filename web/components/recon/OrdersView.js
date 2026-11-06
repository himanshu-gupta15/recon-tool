'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, SearchX, Upload } from 'lucide-react';
import { useApi, qs } from '@/lib/api';
import { STATUS } from '@/lib/status';
import { day, inrShort, num, pct } from '@/lib/format';
import { PageHeader, Tabs, Pagination, SearchInput, StatusBadge, Money, EmptyState, Button, Skeleton } from '@/components/ui';
import DataTable from '@/components/Table';

const EXCEPTIONS = ['short_paid', 'unpaid_past_due', 'freight_overcharged', 'return_not_received', 'overpaid', 'missing_rate_card'];

// Each view is a preset over GET /orders; tabs map to its filters.
export const VIEWS = {
  all: {
    defaultTab: 'exceptions', title: 'Reconciliation', sub: 'Every order’s expected payout against what partners actually paid.',
    tabs: [
      { value: 'all', label: 'All', filter: {} },
      { value: 'exceptions', label: 'Exceptions', filter: { status: EXCEPTIONS.join(',') }, count: EXCEPTIONS },
      { value: 'settled', label: 'Matched', filter: { status: 'settled' }, count: ['settled'] },
      { value: 'short_paid', label: 'Short paid', filter: { status: 'short_paid' }, count: ['short_paid'] },
      { value: 'unpaid_past_due', label: 'Unpaid', filter: { status: 'unpaid_past_due' }, count: ['unpaid_past_due'] },
      { value: 'overpaid', label: 'Overpaid', filter: { status: 'overpaid' }, count: ['overpaid'] },
      { value: 'freight_overcharged', label: 'Freight', filter: { status: 'freight_overcharged' }, count: ['freight_overcharged'] },
      { value: 'return_not_received', label: 'Returns', filter: { status: 'return_not_received' }, count: ['return_not_received'] },
      { value: 'missing_rate_card', label: 'Needs review', filter: { status: 'missing_rate_card' }, count: ['missing_rate_card'] },
      { value: 'pending', label: 'Not yet due', filter: { status: 'pending' }, count: ['pending'] },
    ],
  },
  settlements: {
    title: 'Settlements', sub: 'Channel settlements and courier COD remittances matched to orders. Tax deducted at source counts as received.',
    tabs: [
      { value: 'all', label: 'All due', filter: { status: 'settled,short_paid,unpaid_past_due,overpaid,missing_rate_card' }, count: ['settled', 'short_paid', 'unpaid_past_due', 'overpaid', 'missing_rate_card'] },
      { value: 'settled', label: 'Matched', filter: { status: 'settled' }, count: ['settled'] },
      { value: 'short_paid', label: 'Short paid', filter: { status: 'short_paid' }, count: ['short_paid'] },
      { value: 'unpaid_past_due', label: 'Unpaid', filter: { status: 'unpaid_past_due' }, count: ['unpaid_past_due'] },
      { value: 'overpaid', label: 'Overpaid', filter: { status: 'overpaid' }, count: ['overpaid'] },
      { value: 'missing_rate_card', label: 'No rate card', filter: { status: 'missing_rate_card' }, count: ['missing_rate_card'] },
      { value: 'pending', label: 'Not yet due', filter: { status: 'pending' }, count: ['pending'] },
    ],
  },
  freight: {
    title: 'Freight', sub: 'Courier freight invoices checked against the rate card for declared weight and zone.', freight: true,
    tabs: [
      { value: 'over', label: 'Overcharged', filter: { issue: 'freight_overcharged' } },
      { value: 'billed', label: 'All billed', filter: { freight: 'billed' } },
    ],
  },
};

const DAYS = [['', 'All dates'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days']];

function SummaryStrip({ ov, view }) {
  if (!ov) return <div className="stat-tiles" style={{ marginBottom: 20 }}>{Array.from({ length: 5 }).map((_, i) => <div className="stat-tile" key={i}><Skeleton w={90} h={11} /><Skeleton w={70} h={20} style={{ marginTop: 8 }} /></div>)}</div>;
  const c = ov.current; const s = c.statuses;
  const tiles = view === 'freight' ? null : [
    ['Orders processed', num(c.orders)],
    ['Matched', <>{num(c.settled)} <span className="t-meta">{pct(c.eligible ? c.settled / c.eligible : null)}</span></>],
    ['Exceptions', num(c.exceptions)],
    ['Needs review', num((s.missing_rate_card?.count ?? 0) + (ov.review ?? 0))],
    ['Reconciled', inrShort(c.reconciled)],
  ];
  if (!tiles) return null;
  return <div className="stat-tiles" style={{ marginBottom: 20 }}>{tiles.map(([l, v]) => <div className="stat-tile" key={l}><div className="st-label">{l}</div><div className="st-value">{v}</div></div>)}</div>;
}

function OrdersInner({ view = 'all' }) {
  const cfg = VIEWS[view];
  const sp = useSearchParams(); const router = useRouter();
  const [tab, setTab] = useState(() => (cfg.tabs.some((t) => t.value === sp.get('tab')) ? sp.get('tab') : (cfg.defaultTab ?? cfg.tabs[0].value)));
  const [text, setText] = useState(sp.get('q') ?? ''); const [search, setSearch] = useState(sp.get('q') ?? '');
  const [channel, setChannel] = useState(''); const [days, setDays] = useState('');
  const [sort, setSort] = useState(null); const [page, setPage] = useState(1);
  useEffect(() => { const v = sp.get('q') ?? ''; setText(v); setSearch(v); setPage(1); }, [sp]);
  const current = cfg.tabs.find((t) => t.value === tab) ?? cfg.tabs[0];
  const query = qs({ ...current.filter, channel, q: search, days, page, sort: sort?.key, dir: sort?.dir, size: 25 });
  const q = useApi(`/orders?${query}`);
  const ov = useApi(`/overview?${qs({ days, channel })}`);
  const counts = useMemo(() => {
    const st = ov.data?.current.statuses ?? {};
    return Object.fromEntries(cfg.tabs.map((t) => [t.value, t.count ? t.count.reduce((n, k) => n + (st[k]?.count ?? 0), 0) : t.value === 'all' && view === 'all' ? ov.data?.current.orders : undefined]));
  }, [ov.data, cfg, view]);
  const change = (fn) => (v) => { fn(v); setPage(1); };
  const filtered = !!(search || channel || days);
  const isFreight = !!cfg.freight;

  const columns = isFreight ? [
    { key: 'orderId', header: 'Order', sortable: true, mobile: 'primary', render: (o) => <><div className="cell-main mono">{o.orderId}</div><div className="cell-sub">{o.courier ?? '—'} · {o.awb ?? 'No AWB'}</div></> },
    { key: 'orderDate', header: 'Order date', sortable: true, render: (o) => day(o.orderDate) },
    { key: 'shipment', header: 'Weight · zone', mobile: 'hide', render: (o) => <span className="muted tnum">{o.weight ? `${o.weight / 1000} kg` : '—'} · {o.zone ?? '—'}</span> },
    { key: 'freightExpected', header: 'Rate card', align: 'num', sortable: true, render: (o) => <Money value={o.freightExpected} /> },
    { key: 'freightCharged', header: 'Billed', align: 'num', sortable: true, render: (o) => <Money value={o.freightCharged} /> },
    { key: 'fdiff', header: 'Difference', align: 'num', render: (o) => <Money value={o.freightExpected === null || o.freightExpected === undefined ? null : o.freightExpected - o.freightCharged} signed /> },
    { key: 'status', header: 'Status', mobile: 'status', render: (o) => <StatusBadge status={o.status} /> },
  ] : [
    { key: 'orderId', header: 'Order', sortable: true, mobile: 'primary', render: (o) => <><div className="cell-main mono">{o.orderId}</div><div className="cell-sub">{o.mode}{o.awb ? ` · ${o.awb}` : ''}</div></> },
    { key: 'orderDate', header: 'Order date', sortable: true, render: (o) => day(o.orderDate) },
    { key: 'channel', header: 'Partner', render: (o) => o.channel },
    { key: 'expected', header: 'Expected', align: 'num', sortable: true, render: (o) => <Money value={o.expected} /> },
    { key: 'received', header: 'Received', align: 'num', sortable: true, render: (o) => <Money value={o.received} /> },
    { key: 'gap', header: 'Difference', align: 'num', sortable: true, render: (o) => <Money value={o.gap} signed /> },
    { key: 'status', header: 'Status', mobile: 'status', render: (o) => <StatusBadge status={o.status} /> },
  ];

  return (
    <>
      <PageHeader title={cfg.title} sub={cfg.sub} actions={<Button href="/uploads" icon={Upload}>Upload report</Button>} />
      <SummaryStrip ov={ov.data} view={view} />
      <div className="card">
        <div style={{ padding: '0 14px' }}><Tabs label="Status" value={tab} onChange={change(setTab)} items={cfg.tabs.map((t) => ({ value: t.value, label: t.label, count: counts[t.value] }))} /></div>
        <div className="table-toolbar">
          <SearchInput icon={Search} value={text} onChange={setText} onSubmit={() => { setSearch(text.trim()); setPage(1); }} placeholder="Order ID or AWB, then Enter" />
          <select className="select" aria-label="Partner" value={channel} onChange={(e) => change(setChannel)(e.target.value)}>
            <option value="">All partners</option>
            {q.data?.channels.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="select" aria-label="Order date" value={days} onChange={(e) => change(setDays)(e.target.value)}>
            {DAYS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {filtered && <Button variant="ghost" size="sm" onClick={() => { setText(''); setSearch(''); setChannel(''); setDays(''); setPage(1); if (sp.get('q')) router.replace(location.pathname); }}>Clear filters</Button>}
          <span className="t-meta" style={{ marginLeft: 'auto' }}>{STATUS[tab]?.reason ?? ''}</span>
        </div>
        <DataTable
          columns={columns} rows={q.data?.rows} loading={q.loading} error={q.error} onRetry={q.reload}
          sort={sort} onSort={(s) => { setSort(s); setPage(1); }} chevron
          onRowClick={(o) => router.push(`/orders/${encodeURIComponent(o.orderId)}`)}
          empty={filtered ? (
            <EmptyState icon={SearchX} title="No orders match these filters" actions={<Button onClick={() => { setText(''); setSearch(''); setChannel(''); setDays(''); }}>Clear filters</Button>}>
              {search ? <>Nothing found for <b>{search}</b>. Search matches an exact AWB or the start of an order ID.</> : 'Try a wider date range or a different partner.'}
            </EmptyState>
          ) : (
            <EmptyState icon={Upload} title={tab === 'all' ? 'No reconciled orders yet' : `No ${current.label.toLowerCase()} orders`} actions={tab === 'all' && <Button href="/uploads" variant="primary" icon={Upload}>Upload file</Button>}>
              {tab === 'all' ? 'Upload your orders file and a settlement report to start reconciling payments.' : 'Nothing in this list right now.'}
            </EmptyState>
          )}
        />
        {q.data && q.data.total > 0 && <Pagination page={q.data.page} size={q.data.size} total={q.data.total} onPage={setPage} noun="orders" />}
      </div>
    </>
  );
}

export default function OrdersView(props) {
  return <Suspense fallback={null}><OrdersInner {...props} /></Suspense>;
}
