'use client';
import { useEffect, useState } from 'react';
import { Ban, CheckCircle2, ChevronDown, Send, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { CLAIM_NEXT, STATUS } from '@/lib/status';
import { inr } from '@/lib/format';
import { can } from '@/lib/roles';
import { ConfirmDialog } from '@/components/Dialog';
import { Button, Field } from '@/components/ui';

const META = {
  filed: { icon: Send, tone: 'info', title: 'Mark claim as filed', confirm: 'Mark as filed', consequence: 'Records that you sent this claim to the partner. Filing itself happens outside Recon: export the evidence CSV and send it through the partner’s dispute process.' },
  recovered: { icon: CheckCircle2, tone: 'success', title: 'Record recovery', confirm: 'Record recovery', consequence: 'Closes the claim as recovered and adds the amount to recovery totals. This can’t be changed later.' },
  rejected: { icon: XCircle, tone: 'critical', title: 'Mark claim as rejected', confirm: 'Mark rejected', consequence: 'Records that the partner declined this claim. It stays visible under Rejected and can still be written off by the co-founder.' },
  written_off: { icon: Ban, tone: 'critical', title: 'Write off this claim', confirm: 'Write off', consequence: 'Closes the claim permanently without recovery. The amount leaves money-at-risk totals and the write-off is recorded in the audit log with your reason.' },
};

export function ClaimActionDialog({ claim, to, onClose, onDone }) {
  const m = META[to];
  const [note, setNote] = useState(''); const [amount, setAmount] = useState(claim ? (claim.amount / 100).toFixed(2) : '');
  useEffect(() => { setNote(''); setAmount(claim ? (claim.amount / 100).toFixed(2) : ''); }, [claim, to]);
  if (!claim || !m) return null;
  const needsReason = to === 'written_off';
  return (
    <ConfirmDialog
      open onClose={onClose} title={m.title} icon={m.icon} tone={m.tone} confirmLabel={m.confirm}
      description={<><span className="mono">{claim.orderId}</span> · {STATUS[claim.type]?.label} · {inr(claim.amount)} with {claim.partner}</>}
      consequence={m.consequence}
      disabled={needsReason && !note.trim()}
      onConfirm={async () => { await api(`/claims/${claim._id}`, { method: 'PATCH', json: { status: to, note, recovered: Number(amount) } }); onDone?.(to); }}
    >
      {to === 'recovered' && <Field label="Amount recovered (₹)" hint={`Up to ${inr(claim.amount)}`}><input className="input tnum" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>}
      <Field label={needsReason ? 'Reason for write-off (required)' : 'Note (optional)'} hint={needsReason ? 'Visible in the claim history and audit log.' : undefined}>
        <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoFocus={to !== 'recovered'} />
      </Field>
    </ConfirmDialog>
  );
}

// Primary next step as a button; the rest in a small menu.
export function ClaimActions({ claim, user, onAction, size = 'sm' }) {
  const [menu, setMenu] = useState(false);
  const options = (CLAIM_NEXT[claim.status] ?? []).filter(([to]) => to !== 'written_off' || can(user, 'writeOff'));
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    setTimeout(() => document.addEventListener('click', close, { once: true }));
    return () => document.removeEventListener('click', close);
  }, [menu]);
  if (!options.length) return <span className="faint t-meta">No actions</span>;
  const [primary, ...rest] = options;
  return (
    <div className="row" style={{ gap: 4, position: 'relative', flexWrap: 'nowrap' }}>
      <Button size={size} onClick={() => onAction(claim, primary[0])}>{primary[1]}</Button>
      {rest.length > 0 && <Button size={size} variant="ghost" icon={ChevronDown} aria-label="More actions" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((x) => !x)} />}
      {menu && (
        <div className="popover right" role="menu" style={{ minWidth: 180 }}>
          {rest.map(([to, label]) => <button key={to} role="menuitem" className={`menu-item ${to === 'written_off' || to === 'rejected' ? 'danger' : ''}`} onClick={() => { setMenu(false); onAction(claim, to); }}>{label}</button>)}
        </div>
      )}
    </div>
  );
}
