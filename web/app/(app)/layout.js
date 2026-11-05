'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, useApi } from '../lib';

const ITEMS = [
  ['/', 'Money at risk', ['finance', 'cofounder', 'returns']], ['/upload', 'Upload files', ['finance', 'cofounder', 'returns']],
  ['/orders', 'Orders', ['finance', 'cofounder']], ['/claims', 'Claims', ['finance', 'cofounder', 'returns']],
  ['/returns', 'Returns', ['finance', 'cofounder', 'returns']], ['/review', 'Review queue', ['finance', 'cofounder']],
  ['/rates', 'Rate cards', ['finance', 'cofounder']], ['/tax', 'TCS and TDS', ['finance', 'cofounder']],
];

export default function AppLayout({ children }) {
  const path = usePathname();
  const me = useApi('/me');
  if (!me.data) return <div className="empty">{me.error ? 'Redirecting…' : 'Loading…'}</div>;
  const logout = async () => { await api('/auth/logout', { method: 'POST' }); window.location.href = '/login'; };
  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <div className="brand">Recon</div>
        {ITEMS.filter(([, , roles]) => roles.includes(me.data.role)).map(([href, label]) => (
          <Link key={href} href={href} className={path === href ? 'on' : ''} aria-current={path === href ? 'page' : undefined}>{label}</Link>
        ))}
        <div className="foot">
          <div>{me.data.name}</div>
          <button className="linkish" onClick={logout}>Sign out</button>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
