'use client';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, Info, Minus, RefreshCw } from 'lucide-react';
import { STATUS, CLAIM_STATUS } from '@/lib/status';
import { inr, num } from '@/lib/format';

export function Button({ href, external, variant, size, icon: Icon, iconRight: IconRight, children, className = '', loading, ...rest }) {
  const cls = ['btn', variant, size, className].filter(Boolean).join(' ');
  const inner = <>{loading ? <span className="spinner" aria-hidden="true" /> : Icon && <Icon aria-hidden="true" />}{children}{IconRight && <IconRight aria-hidden="true" />}</>;
  if (href && external) return <a href={href} className={cls} {...rest}>{inner}</a>;
  if (href) return <Link href={href} className={cls} {...rest}>{inner}</Link>;
  return <button type="button" className={cls} disabled={loading || rest.disabled} {...rest}>{inner}</button>;
}

export function IconButton({ label, icon: Icon, dot, ...rest }) {
  return <button type="button" className="icon-btn" aria-label={label} title={label} {...rest}><Icon aria-hidden="true" />{dot && <span className="dot" />}</button>;
}

export function PageHeader({ title, sub, actions, children }) {
  return (
    <header className="page-head">
      <div className="grow">
        <h1 className="t-page">{title}</h1>
        {sub && <p className="sub">{sub}</p>}
        {children}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, sub, actions, children, flush, className = '', foot, ...rest }) {
  return (
    <section className={`card ${flush ? 'flush' : ''} ${className}`} {...rest}>
      {(title || actions) && (
        <div className="card-head">
          <div className="grow">{title && <h2 className="t-section">{title}</h2>}{sub && <p className="t-meta">{sub}</p>}</div>
          {actions && <div className="row wrap">{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
      {foot && <div className="card-foot">{foot}</div>}
    </section>
  );
}

export function Badge({ tone = 'neutral', children, icon: Icon, plain, title }) {
  return <span className={`badge ${tone} ${Icon ? 'has-icon' : ''} ${plain ? 'plain' : ''}`} title={title}>{Icon && <Icon aria-hidden="true" />}{children}</span>;
}

export function StatusBadge({ status }) {
  const s = STATUS[status];
  return <Badge tone={s?.tone ?? 'neutral'} title={s?.reason}>{s?.label ?? status ?? '—'}</Badge>;
}

export function ClaimBadge({ status }) {
  const s = CLAIM_STATUS[status];
  return <Badge tone={s?.tone ?? 'neutral'} title={s?.hint}>{s?.label ?? status}</Badge>;
}

// Signed money with consistent colour: negatives red, zero muted.
export function Money({ value, signed, className = '', strong }) {
  if (value === null || value === undefined) return <span className={`money zero ${className}`}>—</span>;
  const tone = signed ? (value < 0 ? 'neg' : value > 0 ? 'pos' : 'zero') : '';
  return <span className={`money ${tone} ${strong ? 'strong' : ''} ${className}`}>{inr(value, { sign: signed })}</span>;
}

// For metrics where up is bad (exceptions), pass invert.
export function Delta({ value, invert, neutral, unit = '%', digits = 1, label }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className="faint">{label ?? 'No prior data'}</span>;
  const flat = Math.abs(value) < 0.0005;
  const up = value > 0;
  const good = flat ? null : invert ? !up : up;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const shown = unit === '%' ? `${Math.abs(value * 100).toFixed(digits)}%` : `${Math.abs(value).toFixed(digits)}${unit}`;
  return <span className={`delta ${flat || neutral ? 'flat' : good ? 'good' : 'bad'}`}><Icon aria-hidden="true" />{shown}<span className="sr-only">{up ? ' increase' : ' decrease'}</span></span>;
}

export function Skeleton({ w = '100%', h = 14, r, style, className = '' }) {
  return <span className={`skeleton ${className}`} style={{ display: 'block', width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}

export function SkeletonRows({ rows = 6, cols = 6 }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 24, padding: '16px 14px', borderBottom: '1px solid var(--line-2)' }}>
          {Array.from({ length: cols }).map((__, j) => <Skeleton key={j} h={12} w={j === 0 ? '80%' : `${50 + ((i * 7 + j * 13) % 40)}%`} style={j >= cols - 3 ? { marginLeft: 'auto' } : undefined} />)}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Info, title, children, actions, compact }) {
  return (
    <div className={`empty-state ${compact ? 'compact' : ''}`}>
      <div className="empty-icon"><Icon aria-hidden="true" /></div>
      <h3 className="t-section">{title}</h3>
      {children && <p>{children}</p>}
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export function ErrorState({ title = "Couldn't load this", message, onRetry, compact }) {
  return (
    <EmptyState icon={AlertTriangle} title={title} compact={compact} actions={onRetry && <Button icon={RefreshCw} onClick={onRetry}>Try again</Button>}>
      {message || 'The server didn’t respond as expected.'} If this keeps happening, check that the API is running.
    </EmptyState>
  );
}

const ALERT_ICON = { info: Info, warning: AlertTriangle, critical: AlertCircle, success: CheckCircle2 };
export function Alert({ tone = 'info', title, children, actions, role }) {
  const Icon = ALERT_ICON[tone];
  return (
    <div className={`alert ${tone}`} role={role ?? (tone === 'critical' ? 'alert' : 'status')}>
      <Icon aria-hidden="true" />
      <div className="grow">{title && <div className="alert-title">{title}</div>}{children && <div className="alert-body">{children}</div>}</div>
      {actions && <div className="alert-actions">{actions}</div>}
    </div>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

export function Tabs({ value, onChange, items, label }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map(({ value: v, label: l, count }) => (
        <button key={v} type="button" role="tab" className="tab" aria-selected={value === v} onClick={() => onChange(v)}>
          {l}{count !== undefined && count !== null && <span className="count">{num(count)}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, size, total, onPage, noun = 'rows' }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total ? (page - 1) * size + 1 : 0; const to = Math.min(total, page * size);
  return (
    <div className="table-foot">
      <span className="tnum">{total ? `${num(from)}–${num(to)} of ${num(total)} ${noun}` : `0 ${noun}`}</span>
      {pages > 1 && (
        <div className="pager">
          <span className="tnum" style={{ marginRight: 4 }}>Page {page} of {num(pages)}</span>
          <Button size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" />
          <Button size="sm" icon={ChevronRight} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page" />
        </div>
      )}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, onSubmit, label, icon: Icon }) {
  return (
    <form className="search-input" role="search" onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}>
      {Icon && <Icon aria-hidden="true" />}
      <input className="input" type="search" aria-label={label ?? placeholder} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </form>
  );
}

export function Field({ label, hint, children }) {
  return <label className="field"><span>{label}</span>{children}{hint && <span className="hint">{hint}</span>}</label>;
}

export function Meter({ value, color, label }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return <div className="meter" role="img" aria-label={label}><i style={{ width: `${v * 100}%`, background: color }} /></div>;
}
