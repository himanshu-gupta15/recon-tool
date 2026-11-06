'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, BookOpen, ChevronRight, CircleHelp, FileText, Inbox, Keyboard, Menu, PackageX, Search, Upload } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { ROLE_LABEL, can } from '@/lib/roles';
import { initials, num, relative } from '@/lib/format';
import { useApp } from './AppContext';

const LABELS = {
  '': 'Overview', reconciliation: 'Reconciliation', settlements: 'Settlements', freight: 'Freight', returns: 'Returns',
  claims: 'Claims', review: 'Review queue', uploads: 'Uploads', reports: 'Reports', tax: 'TCS & TDS', audit: 'Audit log',
  settings: 'Settings', team: 'Team', roles: 'Roles & permissions', partners: 'Partners', 'rate-cards': 'Rate cards',
  rules: 'Reconciliation rules', notifications: 'Notifications', security: 'Security', orders: 'Order',
};

function crumbs(path) {
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return [{ label: 'Overview' }];
  if (parts[0] === 'orders') return [{ label: 'Reconciliation', href: '/reconciliation' }, { label: decodeURIComponent(parts[1] ?? '') }];
  if (parts[0] === 'returns') return [{ label: 'Reconciliation', href: '/reconciliation' }, { label: 'Returns' }];
  return parts.map((p, i) => ({ label: LABELS[p] ?? decodeURIComponent(p), href: i < parts.length - 1 ? '/' + parts.slice(0, i + 1).join('/') : undefined }));
}

function usePopover() {
  const [open, setOpen] = useState(false); const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return { open, setOpen, ref };
}

export default function Topbar({ onMenu }) {
  const path = usePathname(); const router = useRouter();
  const { user, counts } = useApp();
  const [q, setQ] = useState('');
  const searchRef = useRef(null);
  const notif = usePopover(); const help = usePopover();
  const list = crumbs(path);
  const canSearch = can(user, 'orders');

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const items = [];
  if (counts?.review) items.push({ icon: Inbox, tone: 'info', title: `${num(counts.review)} partner lines need review`, sub: 'Payments with no usable order ID', href: '/review' });
  if (counts?.toFile) items.push({ icon: FileText, tone: 'warning', title: `${num(counts.toFile)} claims ready to file`, sub: 'Raised by reconciliation, not yet sent', href: '/claims?status=open' });
  if (counts?.missingReturns) items.push({ icon: PackageX, tone: 'critical', title: `${num(counts.missingReturns)} returns not received`, sub: 'Past the courier’s grace period', href: '/returns' });
  if (counts?.noRateCard) items.push({ icon: AlertTriangle, tone: 'warning', title: `${num(counts.noRateCard)} orders have no rate card`, sub: 'Expected payout can’t be calculated', href: '/review?tab=rate' });
  if (counts?.failedUploads) items.push({ icon: Upload, tone: 'critical', title: `${num(counts.failedUploads)} uploads failed`, sub: 'See upload history for the reason', href: '/uploads' });

  return (
    <header className="topbar">
      <IconButton label="Open navigation" icon={Menu} onClick={onMenu} className="icon-btn menu-toggle" />
      <span className="mobile-title" style={{ display: 'none' }}>{list.at(-1)?.label}</span>
      <nav className="crumbs" aria-label="Breadcrumb">
        {list.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && <ChevronRight aria-hidden="true" />}
            {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page" className="truncate">{c.label}</span>}
          </Fragment>
        ))}
      </nav>
      {canSearch ? (
        <form className="topbar-search" role="search" onSubmit={(e) => { e.preventDefault(); const v = q.trim(); if (v) router.push(`/reconciliation?q=${encodeURIComponent(v)}`); }}>
          <Search aria-hidden="true" />
          <input ref={searchRef} className="input" type="search" placeholder="Search order ID or AWB" aria-label="Search order ID or AWB" value={q} onChange={(e) => setQ(e.target.value)} />
          <kbd>⌘K</kbd>
        </form>
      ) : <span style={{ marginLeft: 'auto' }} />}
      <div className="topbar-actions">
        <div style={{ position: 'relative' }} ref={notif.ref}>
          <IconButton label="Notifications" icon={Bell} dot={items.length > 0} aria-expanded={notif.open} aria-haspopup="dialog" onClick={() => notif.setOpen((o) => !o)} />
          {notif.open && (
            <div className="popover right" role="dialog" aria-label="Notifications" style={{ width: 340 }}>
              <div className="menu-head row between"><span className="strong">Needs attention</span>{counts?.lastImport && <span className="t-meta">Last import {relative(counts.lastImport)}</span>}</div>
              {items.length ? items.map((it) => (
                <Link key={it.title} href={it.href} className="notif" onClick={() => notif.setOpen(false)}>
                  <span className="notif-icon" style={{ background: `var(--${it.tone}-bg)`, color: `var(--${it.tone})` }}><it.icon aria-hidden="true" /></span>
                  <span><span className="strong" style={{ display: 'block', fontSize: 13.5 }}>{it.title}</span><span className="t-meta">{it.sub}</span></span>
                </Link>
              )) : <div className="t-meta" style={{ padding: '10px 10px 12px' }}>You’re all caught up. Nothing needs action right now.</div>}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }} ref={help.ref}>
          <IconButton label="Help" icon={CircleHelp} aria-expanded={help.open} aria-haspopup="menu" onClick={() => help.setOpen((o) => !o)} />
          {help.open && (
            <div className="popover right" role="menu" style={{ width: 260 }}>
              <Link className="menu-item" role="menuitem" href="/settings/rules" onClick={() => help.setOpen(false)}><BookOpen aria-hidden="true" />How reconciliation decides</Link>
              <Link className="menu-item" role="menuitem" href="/uploads" onClick={() => help.setOpen(false)}><Upload aria-hidden="true" />Upload a partner report</Link>
              <div className="menu-sep" />
              <div className="menu-head t-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Keyboard style={{ width: 13, height: 13 }} aria-hidden="true" />Shortcuts</div>
              <div className="menu-item" style={{ cursor: 'default' }}><span className="grow">Search orders</span><kbd>⌘K</kbd> <kbd>/</kbd></div>
              <div className="menu-item" style={{ cursor: 'default' }}><span className="grow">Close dialog</span><kbd>Esc</kbd></div>
            </div>
          )}
        </div>
        <span className="role-chip" title="Your role decides what you can see and do">{ROLE_LABEL[user.role]}</span>
        <Link href="/settings" className="avatar sm" aria-label={`Your profile: ${user.name}`} title={user.name} style={{ marginLeft: 4 }}>{initials(user.name)}</Link>
      </div>
    </header>
  );
}
