'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Download, FileText, Search, SearchX, SlidersHorizontal } from 'lucide-react';
import { useApi, qs } from '@/lib/api';
import { CLAIM_STATUS, ISSUE_TYPES, STATUS, claimRef } from '@/lib/status';
import { age, day, inrShort, num } from '@/lib/format';
import { can } from '@/lib/roles';
import { useApp } from '@/components/shell/AppContext';
import { PageHeader, Button, StatusBadge, ClaimBadge, Money, Pagination, SearchInput, EmptyState, Skeleton } from '@/components/ui';
import DataTable from '@/components/Table';
import { ClaimActionDialog, ClaimActions } from '@/components/claims/ClaimAction';

const CARDS = [['open', 'To file'], ['filed', 'Filed · awaiting partner'], ['recovered', 'Recovered'], ['rejected', 'Rejected'], ['written_off', 'Written off']];

function Claims() {
  const sp = useSearchParams();
  const { user, refreshCounts, toast } = useApp();
  const [partner, setPartner] = useState(sp.get('partner') ?? '');
  const [type, setType] = useState(sp.get('type') ?? '');
  const [status, setStatus] = useState(sp.get('status') ?? 'active');
  const [text, setText] = useState(sp.get('q') ?? ''); const [search, setSearch] = useState(sp.get('q') ?? '');
  const [since, setSince] = useState(''); const [min, setMin] = useState('');
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState(null);
  const filters = { partner, type, status, q: search, since, min };
  const q = useApi(`/claims?${qs({ ...filters, page })}`);
  const sum = useApi('/claims/summary');
  const set = (fn) => (v) => { fn(v); setPage(1); };
  const canOrders = can(user, 'orders');
  const filtered = partner || type || search || since || min || (status !== 'active');
  const clear = () => { setPartner(''); setType(''); setStatus('active'); setText(''); setSearch(''); setSince(''); setMin(''); setPage(1); };

  const columns = [
    { key: 'ref', header: 'Claim', mobile: 'primary', render: (c) => <><div className="cell-main mono">{claimRef(c)}</div><div className="cell-sub">Raised {day(c.createdAt)}</div></> },
    { key: 'order', header: 'Order', render: (c) => (canOrders ? <Link href={`/orders/${encodeURIComponent(c.orderId)}`} className="link mono" style={{ fontWeight: 500 }}>{c.orderId}</Link> : <span className="mono">{c.orderId}</span>) },
    { key: 'partner', header: 'Partner', render: (c) => <span className="truncate" style={{ display: 'block', maxWidth: 190 }}>{c.partner}</span> },
    { key: 'type', header: 'Issue', render: (c) => <span title={c.detail}><StatusBadge status={c.type} /></span> },
    { key: 'amount', header: 'Claim amount', align: 'num', render: (c) => <><Money value={c.amount} strong />{c.recovered > 0 && <div className="cell-sub pos">{inrShort(c.recovered)} back</div>}</> },
    { key: 'age', header: 'Age', align: 'num', render: (c) => <span className="muted tnum">{age(c.ageFrom)}</span> },
    { key: 'status', header: 'Status', mobile: 'status', render: (c) => <ClaimBadge status={c.status} /> },
    { key: 'actions', header: <span className="sr-only">Actions</span>, mobile: 'actions', render: (c) => <ClaimActions claim={c} user={user} onAction={(claim, to) => setAction({ claim, to })} /> },
  ];

  return (
    <>
      <PageHeader
        title="Claims"
        sub={user.role === 'returns' ? 'Return claims raised when a returned parcel never reached the warehouse.' : 'Claims are raised automatically when reconciliation finds money a partner owes you. File them with the partner, then record the outcome here.'}
        actions={<Button variant="primary" icon={Download} href={`/api/claims/export.csv?${qs(filters)}`} external>Export evidence</Button>}
      />
      <section className="kpis cols-5" aria-label="Claims by status" style={{ marginBottom: 20 }}>
        {CARDS.map(([k, label]) => {
          const s = sum.data?.[k];
          return (
            <button key={k} type="button" className="kpi" aria-pressed={status === k} onClick={() => set(setStatus)(status === k ? 'active' : k)}>
              <span className="kpi-label"><span className={`badge ${CLAIM_STATUS[k].tone}`} style={{ height: 8, width: 8, padding: 0, border: 0 }} aria-hidden="true" />{label}</span>
              {sum.data ? <span className="kpi-value">{num(s?.count ?? 0)}</span> : <Skeleton w={60} h={24} />}
              <span className="kpi-foot">{sum.data ? (k === 'recovered' ? `${inrShort(s?.recovered ?? 0)} recovered` : `${inrShort(s?.amount ?? 0)} total`) : <Skeleton w={80} h={10} />}</span>
            </button>
          );
        })}
      </section>

      <div className="card">
        <div className="table-toolbar">
          <SearchInput icon={Search} value={text} onChange={setText} onSubmit={() => { setSearch(text.trim()); setPage(1); }} placeholder="Search order ID" />
          <select className="select" aria-label="Partner" value={partner} onChange={(e) => set(setPartner)(e.target.value)}>
            <option value="">All partners</option>{q.data?.partners.map((p) => <option key={p}>{p}</option>)}
          </select>
          {user.role !== 'returns' && (
            <select className="select" aria-label="Issue type" value={type} onChange={(e) => set(setType)(e.target.value)}>
              <option value="">All issues</option>{ISSUE_TYPES.map((t) => <option key={t} value={t}>{STATUS[t].label}</option>)}
            </select>
          )}
          <select className="select" aria-label="Status" value={status} onChange={(e) => set(setStatus)(e.target.value)}>
            <option value="active">Open (to file + filed)</option>
            {Object.entries(CLAIM_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            <option value="all">All statuses</option>
          </select>
          <Button variant={more ? undefined : 'ghost'} size="sm" icon={SlidersHorizontal} aria-expanded={more} onClick={() => setMore((m) => !m)}>More filters</Button>
          {filtered && <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>}
          {q.data && <span className="t-meta" style={{ marginLeft: 'auto' }}><span className="strong tnum" style={{ color: 'var(--ink)' }}>{inrShort(q.data.amount)}</span> across {num(q.data.total)} claims</span>}
        </div>
        {more && (
          <div className="table-toolbar" style={{ background: 'var(--surface-2)' }}>
            <label className="row t-meta">Issue since<input className="input sm" type="date" value={since} onChange={(e) => set(setSince)(e.target.value)} /></label>
            <label className="row t-meta">Min amount ₹<input className="input sm tnum" type="number" min="0" step="100" style={{ width: 120 }} value={min} onChange={(e) => set(setMin)(e.target.value)} /></label>
          </div>
        )}
        <DataTable
          columns={columns} rows={q.data?.rows} loading={q.loading} error={q.error} onRetry={q.reload}
          empty={filtered ? (
            <EmptyState icon={SearchX} title="No claims match these filters" actions={<Button onClick={clear}>Clear filters</Button>}>Try another status or partner.</EmptyState>
          ) : (
            <EmptyState icon={CheckCircle2} title="No open claims" actions={<Button href="/uploads">Upload partner reports</Button>}>When reconciliation finds a short payment, unpaid order, freight overcharge or missing return, a claim appears here with its evidence.</EmptyState>
          )}
        />
        {q.data && q.data.total > 0 && <Pagination page={q.data.page} size={q.data.size} total={q.data.total} onPage={setPage} noun="claims" />}
      </div>
      <p className="t-meta mt-12 row gap-4"><FileText aria-hidden="true" style={{ width: 13, height: 13 }} />Claims can’t be created by hand: each one comes from a reconciliation rule so the evidence always matches. Evidence exports leave out customer details.</p>
      {action && <ClaimActionDialog {...action} onClose={() => setAction(null)} onDone={(to) => { setAction(null); q.reload(); sum.reload(); refreshCounts(); toast(`Claim ${CLAIM_STATUS[to]?.label.toLowerCase()}`); }} />}
    </>
  );
}

export default function Page() { return <Suspense fallback={null}><Claims /></Suspense>; }
