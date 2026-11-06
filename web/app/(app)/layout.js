'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useApi } from '@/lib/api';
import { AppProvider } from '@/components/shell/AppContext';
import Sidebar, { BrandMark } from '@/components/shell/Sidebar';
import Topbar from '@/components/shell/Topbar';
import { Skeleton } from '@/components/ui';

function ShellSkeleton({ error }) {
  return (
    <div className="shell" aria-busy="true">
      <aside className="sidebar" style={{ padding: 0 }}>
        <div className="sidebar-brand"><BrandMark /><span className="brand-word">RECON</span></div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={12} w={`${50 + (i * 17) % 40}%`} />)}</div>
      </aside>
      <div className="main-col">
        <div className="topbar" />
        <div className="content">{error ? <p className="muted">Redirecting to sign in…</p> : <><Skeleton w={220} h={24} /><Skeleton w={320} h={14} style={{ marginTop: 10 }} /><Skeleton h={96} style={{ marginTop: 28 }} r={10} /><Skeleton h={320} style={{ marginTop: 20 }} r={10} /></>}</div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }) {
  const me = useApi('/me');
  const [nav, setNav] = useState(false);
  const path = usePathname();
  useEffect(() => { setNav(false); }, [path]);
  if (!me.data) return <ShellSkeleton error={me.error} />;
  return (
    <AppProvider user={me.data}>
      <a href="#main" className="sr-only">Skip to content</a>
      <div className="shell">
        <Sidebar open={nav} onNavigate={() => setNav(false)} />
        <div className={`scrim ${nav ? 'open' : ''}`} onClick={() => setNav(false)} aria-hidden="true" />
        <div className="main-col">
          <Topbar onMenu={() => setNav(true)} />
          <main id="main" className="content" key={path}>{children}</main>
        </div>
      </div>
    </AppProvider>
  );
}
