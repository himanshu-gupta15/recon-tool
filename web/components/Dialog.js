'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Alert } from './ui';

// Native <dialog>: focus trapping, Escape and backdrop come for free.
export function Modal({ open, onClose, title, description, icon: Icon, tone, children, footer, wide, labelledBy }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}
      aria-labelledby={labelledBy ?? 'modal-title'}
    >
      {open && <>
        <div className="modal-head">
          {Icon && <div className={`modal-icon ${tone ?? ''}`}><Icon aria-hidden="true" /></div>}
          <div className="grow"><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div>
        </div>
        {children && <div className="modal-body">{children}</div>}
        {footer && <div className="modal-foot">{footer}</div>}
      </>}
    </dialog>
  );
}

// For destructive or irreversible actions. onConfirm may throw; the error is shown inline.
export function ConfirmDialog({ open, onClose, onConfirm, title, description, consequence, confirmLabel = 'Confirm', tone = 'critical', icon, children, disabled }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (open) { setError(''); setBusy(false); } }, [open]);
  const run = async () => {
    setBusy(true); setError('');
    try { await onConfirm(); } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <Modal
      open={open} onClose={onClose} title={title} description={description} icon={icon} tone={tone}
      footer={<><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant={tone === 'critical' ? 'danger' : 'primary'} onClick={run} loading={busy} disabled={disabled}>{confirmLabel}</Button></>}
    >
      {consequence && <div className="callout"><div className="t-meta" style={{ color: 'var(--ink-2)' }}>{consequence}</div></div>}
      {children}
      {error && <Alert tone="critical">{error}</Alert>}
    </Modal>
  );
}
