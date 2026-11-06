'use client';
import { useState } from 'react';
import { Calculator, Plus, RefreshCw } from 'lucide-react';
import { api, useApi } from '@/lib/api';
import { day, inr } from '@/lib/format';
import { useApp } from '@/components/shell/AppContext';
import { can } from '@/lib/roles';
import { Card, Button, Field, Alert, EmptyState, Badge } from '@/components/ui';
import { Modal } from '@/components/Dialog';
import DataTable from '@/components/Table';

const today = () => new Date().toISOString().slice(0, 10);
const pct = (bp) => `${((bp ?? 0) / 100).toFixed(2).replace(/\.?0+$/, '')}%`;

function ChannelForm({ card, onClose, onSaved }) {
  const [f, setF] = useState({ partner: card?.partner ?? '', effectiveFrom: today(), cod: (card?.codBp ?? 0) / 100, prepaid: (card?.prepaidBp ?? 0) / 100, ret: (card?.prepaidReturnBp ?? 0) / 100, fixed: (card?.fixedPaise ?? 0) / 100, days: card?.settlementDays ?? 7, codVia: card?.codVia ?? 'channel' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      await api('/cards', { json: { kind: 'channel', partner: f.partner, effectiveFrom: f.effectiveFrom, codBp: Math.round(f.cod * 100), prepaidBp: Math.round(f.prepaid * 100), prepaidReturnBp: Math.round(f.ret * 100), fixedPaise: Math.round(f.fixed * 100), settlementDays: Number(f.days), codVia: f.codVia } });
      onSaved();
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <Modal open wide onClose={onClose} icon={Calculator} title={card ? `New rate card version for ${card.partner}` : 'Add a channel rate card'} description="Orders placed on or after the effective date use these rates. Older orders keep the rate that was in force on their order date.">
      <form id="rate-form" onSubmit={submit} className="stack gap-16">
        <div className="form-grid">
          <Field label="Channel"><input className="input" required value={f.partner} onChange={set('partner')} readOnly={!!card} /></Field>
          <Field label="Applies to orders from"><input className="input" type="date" required value={f.effectiveFrom} onChange={set('effectiveFrom')} /></Field>
          <Field label="Settles within (days)"><input className="input tnum" type="number" min="0" required value={f.days} onChange={set('days')} /></Field>
          <Field label="COD fee %"><input className="input tnum" type="number" step="0.01" min="0" value={f.cod} onChange={set('cod')} /></Field>
          <Field label="Prepaid fee %"><input className="input tnum" type="number" step="0.01" min="0" value={f.prepaid} onChange={set('prepaid')} /></Field>
          <Field label="Prepaid return charge %"><input className="input tnum" type="number" step="0.01" min="0" value={f.ret} onChange={set('ret')} /></Field>
          <Field label="Fixed fee per order ₹"><input className="input tnum" type="number" step="0.01" min="0" value={f.fixed} onChange={set('fixed')} /></Field>
          <Field label="COD cash comes from"><select className="select" value={f.codVia} onChange={set('codVia')}><option value="channel">The channel</option><option value="courier">The courier</option></select></Field>
        </div>
        {error && <Alert tone="critical" title="Couldn’t save this rate card">{error}</Alert>}
      </form>
      <div className="modal-foot" style={{ margin: '0 -20px -14px' }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" icon={RefreshCw} type="submit" form="rate-form" loading={busy}>Save and recalculate</Button>
      </div>
    </Modal>
  );
}

export default function RateCards() {
  const { user, toast, refreshCounts } = useApp();
  const q = useApi('/cards');
  const [form, setForm] = useState(null);
  const editable = can(user, 'rates');
  const channels = q.data?.filter((c) => c.kind === 'channel');
  const couriers = q.data?.filter((c) => c.kind === 'courier');
  const chCols = [
    { key: 'partner', header: 'Channel', mobile: 'primary', render: (c) => <><div className="cell-main">{c.partner}</div><div className="cell-sub">From {day(c.effectiveFrom)}</div></> },
    { key: 'cod', header: 'COD fee', align: 'num', render: (c) => pct(c.codBp) },
    { key: 'prepaid', header: 'Prepaid fee', align: 'num', render: (c) => pct(c.prepaidBp) },
    { key: 'ret', header: 'Prepaid return', align: 'num', render: (c) => pct(c.prepaidReturnBp) },
    { key: 'fixed', header: 'Fixed fee', align: 'num', render: (c) => inr(c.fixedPaise ?? 0) },
    { key: 'days', header: 'Settles in', align: 'num', render: (c) => `${c.settlementDays} days` },
    { key: 'via', header: 'COD paid by', render: (c) => <Badge tone="neutral" plain>{c.codVia === 'courier' ? 'Courier' : 'Channel'}</Badge> },
    ...(editable ? [{ key: 'act', header: <span className="sr-only">Actions</span>, mobile: 'actions', render: (c) => <Button size="sm" onClick={() => setForm({ card: c })}>New version</Button> }] : []),
  ];
  const coCols = [
    { key: 'partner', header: 'Courier', mobile: 'primary', render: (c) => <><div className="cell-main">{c.partner}</div><div className="cell-sub">From {day(c.effectiveFrom)}</div></> },
    { key: 'rem', header: 'Remits in', align: 'num', render: (c) => `${c.remittanceDays} days` },
    { key: 'grace', header: 'Return grace', align: 'num', render: (c) => `${c.returnGraceDays} days` },
    { key: 'rto', header: 'RTO charge', align: 'num', render: (c) => inr(c.rtoPaise ?? 0) },
    { key: 'zones', header: 'First 500 g + each extra 500 g', render: (c) => <div className="row wrap" style={{ gap: 4 }}>{Object.entries(c.zones).map(([z, v]) => <span key={z} className="tag tnum"><b>{z}</b> {inr(v.base)} + {inr(v.add)}</span>)}</div> },
  ];
  return (
    <>
      <Alert tone="info" title="Rate cards set every expected amount">The demo rates are illustrative. Replace them with your signed partner rates. Saving a version re-matches all orders.</Alert>
      <Card flush title="Channels" sub="Fees deducted from each order before payout" actions={editable && <Button size="sm" variant="primary" icon={Plus} onClick={() => setForm({ card: null })}>Add channel</Button>}>
        <DataTable columns={chCols} rows={channels} loading={q.loading} error={q.error} onRetry={q.reload} empty={<EmptyState icon={Calculator} title="No channel rate cards" compact>Add one so Recon can calculate expected payouts.</EmptyState>} />
      </Card>
      <Card flush title="Couriers" sub="Freight slabs by zone, remittance and return windows">
        <DataTable columns={coCols} rows={couriers} loading={q.loading} error={q.error} onRetry={q.reload} empty={<EmptyState icon={Calculator} title="No courier rate cards" compact />} />
      </Card>
      {form && <ChannelForm card={form.card} onClose={() => setForm(null)} onSaved={() => { setForm(null); q.reload(); refreshCounts(); toast('Rate card saved. Orders recalculated.'); }} />}
    </>
  );
}
