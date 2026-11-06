import { Ban, CheckCircle2, Download, FileCheck2, FileUp, FileX2, Link2, PenLine, Send, XCircle } from 'lucide-react';
import { inr } from './format';
import { SOURCE_LABEL, STATUS } from './status';

const orderOf = (key) => String(key ?? '').split('|')[0];
const issueOf = (key) => STATUS[String(key ?? '').split('|')[1]]?.label?.toLowerCase();

// Turns an audit record into a readable sentence. Unknown actions fall back to the raw name.
export function describeAudit(a) {
  const d = a.detail ?? {};
  switch (a.action) {
    case 'upload.approve': return { icon: FileCheck2, tone: 'info', text: <>approved the column mapping for <b>{a.target}</b></>, object: `${SOURCE_LABEL[d.sourceType] ?? d.sourceType} · ${d.partner}`, kind: 'upload' };
    case 'claim.filed': return { icon: Send, tone: 'info', text: <>filed the {issueOf(a.target)} claim on <b className="mono">{orderOf(a.target)}</b></>, object: orderOf(a.target), note: d.note, kind: 'claim', href: `/orders/${encodeURIComponent(orderOf(a.target))}` };
    case 'claim.recovered': return { icon: CheckCircle2, tone: 'success', text: <>recorded <b>{inr(d.recovered)}</b> recovered on <b className="mono">{orderOf(a.target)}</b></>, object: orderOf(a.target), note: d.note, kind: 'claim', href: `/orders/${encodeURIComponent(orderOf(a.target))}` };
    case 'claim.rejected': return { icon: XCircle, tone: 'critical', text: <>marked the claim on <b className="mono">{orderOf(a.target)}</b> as rejected</>, object: orderOf(a.target), note: d.note, kind: 'claim', href: `/orders/${encodeURIComponent(orderOf(a.target))}` };
    case 'claim.written_off': return { icon: Ban, tone: 'warning', text: <>wrote off the claim on <b className="mono">{orderOf(a.target)}</b></>, object: orderOf(a.target), note: d.note, kind: 'claim', href: `/orders/${encodeURIComponent(orderOf(a.target))}` };
    case 'claims.export': return { icon: Download, tone: 'neutral', text: <>exported evidence for <b>{d.count ?? 0}</b> claims</>, object: a.target === 'all' ? 'All partners' : a.target, kind: 'export' };
    case 'review.approve': return { icon: Link2, tone: 'success', text: <>linked a partner line to <b className="mono">{d.orderId}</b></>, object: d.orderId, kind: 'review', href: d.orderId ? `/orders/${encodeURIComponent(d.orderId)}` : undefined };
    case 'review.reject': return { icon: XCircle, tone: 'neutral', text: <>marked a partner line as not ours</>, object: `Line ${String(a.target).slice(-6)}`, kind: 'review' };
    case 'card.save': return { icon: PenLine, tone: 'info', text: <>saved a rate card for <b>{a.target}</b></>, object: d.effectiveFrom ? `Effective ${new Date(d.effectiveFrom).toISOString().slice(0, 10)}` : a.target, kind: 'card' };
    default: return { icon: PenLine, tone: 'neutral', text: <>{a.action}</>, object: a.target, kind: 'other' };
  }
}

export function describeUpload(u) {
  const failed = u.status === 'failed';
  return {
    icon: failed ? FileX2 : FileUp, tone: failed ? 'critical' : 'neutral',
    text: failed ? <><b>{u.fileName}</b> failed to import</> : <>imported <b>{u.fileName}</b>{u.stats?.rows ? <> · {u.stats.rows.toLocaleString('en-IN')} rows</> : null}</>,
    object: `${SOURCE_LABEL[u.sourceType] ?? u.sourceType} · ${u.partner}`,
  };
}

export const actorName = (by, me) => {
  if (!by || by === 'seed') return 'System';
  if (me && by === me.email) return 'You';
  return by;
};
