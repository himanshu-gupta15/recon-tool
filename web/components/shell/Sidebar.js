'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BarChart3, ChevronsUpDown, FileCheck2, FileText, Inbox, LayoutDashboard, LogOut, ScrollText, Settings, Upload, User } from 'lucide-react';
import { api } from '@/lib/api';
import { ROLE_LABEL, FINANCE, ALL } from '@/lib/roles';
import { initials } from '@/lib/format';
import { useApp } from './AppContext';

export const NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, roles: ALL },
  {
    label: 'Reconciliation', icon: FileCheck2, roles: ALL,
    children: [
      { href: '/reconciliation', label: 'All reconciliations', roles: FINANCE },
      { href: '/reconciliation/settlements', label: 'Settlements', roles: FINANCE },
      { href: '/returns', label: 'Returns', roles: ALL, count: 'missingReturns' },
      { href: '/reconciliation/freight', label: 'Freight', roles: FINANCE },
    ],
  },
  { href: '/claims', label: 'Claims', icon: FileText, roles: ALL, count: 'toFile' },
  { href: '/review', label: 'Review queue', icon: Inbox, roles: FINANCE, count: 'review' },
  { href: '/uploads', label: 'Uploads', icon: Upload, roles: ALL },
  { href: '/reports', label: 'Reports', icon: BarChart3, roles: FINANCE },
  { href: '/audit', label: 'Audit log', icon: ScrollText, roles: FINANCE },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ALL },
];

const isActive = (path, href) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M2 7h6M2 10h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
    </span>
  );
}

export default function Sidebar({ open, onNavigate }) {
  const path = usePathname();
  const { user, counts } = useApp();
  const role = user.role;
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const router = useRouter();
  useEffect(() => {
    if (!menu) return;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenu(false); };
    const esc = (e) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [menu]);
  const logout = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); window.location.href = '/login'; };
  // A child under /reconciliation/* must not also light up its parent.
  const childActive = (href) => (href === '/reconciliation' ? path === '/reconciliation' : isActive(path, href));
  const count = (k) => (k && counts?.[k] ? <span className="nav-count">{counts[k] > 999 ? '999+' : counts[k]}</span> : null);

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Sidebar">
      <div className="sidebar-brand">
        <BrandMark />
        <span className="brand-word">RECON</span>
        {process.env.NODE_ENV !== 'production' && <span className="brand-env">Demo</span>}
      </div>
      <nav className="sidebar-nav" aria-label="Main">
        {NAV.filter((n) => n.roles.includes(role)).map((n) => {
          if (n.children) {
            const kids = n.children.filter((c) => c.roles.includes(role));
            if (!kids.length) return null;
            const first = kids[0];
            const groupActive = kids.some((c) => childActive(c.href)) || path.startsWith('/orders/');
            return (
              <div key={n.label}>
                <Link href={first.href} className="nav-item" onClick={onNavigate} aria-current={groupActive && !kids.some((c) => childActive(c.href)) ? 'page' : undefined}>
                  <n.icon aria-hidden="true" />{n.label}
                </Link>
                <div className="nav-sub">
                  {kids.map((c) => (
                    <Link key={c.href} href={c.href} className="nav-item" onClick={onNavigate} aria-current={childActive(c.href) ? 'page' : undefined}>{c.label}{count(c.count)}</Link>
                  ))}
                </div>
              </div>
            );
          }
          return (
            <Link key={n.href} href={n.href} className="nav-item" onClick={onNavigate} aria-current={isActive(path, n.href) ? 'page' : undefined}>
              <n.icon aria-hidden="true" />{n.label}{count(n.count)}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-foot" ref={menuRef}>
        {menu && (
          <div className="popover up" role="menu">
            <div className="menu-head"><div className="strong truncate">{user.name}</div><div className="t-meta truncate">{user.email}</div></div>
            <div className="menu-sep" />
            <button className="menu-item" role="menuitem" onClick={() => { setMenu(false); onNavigate?.(); router.push('/settings'); }}><User aria-hidden="true" />Profile</button>
            <button className="menu-item" role="menuitem" onClick={() => { setMenu(false); onNavigate?.(); router.push('/settings/roles'); }}><Settings aria-hidden="true" />Roles &amp; permissions</button>
            <div className="menu-sep" />
            <button className="menu-item danger" role="menuitem" onClick={logout}><LogOut aria-hidden="true" />Sign out</button>
          </div>
        )}
        <button className="account-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <span className="avatar">{initials(user.name)}</span>
          <span className="grow" style={{ minWidth: 0 }}>
            <span className="strong truncate" style={{ display: 'block', fontSize: 13.5 }}>{user.name}</span>
            <span className="t-meta truncate" style={{ display: 'block' }}>{ROLE_LABEL[role]}</span>
          </span>
          <ChevronsUpDown aria-hidden="true" style={{ width: 15, height: 15, color: 'var(--faint)' }} />
        </button>
      </div>
    </aside>
  );
}
