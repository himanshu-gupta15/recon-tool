'use client';
import { LogOut } from 'lucide-react';
import { api } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/roles';
import { initials } from '@/lib/format';
import { useApp } from '@/components/shell/AppContext';
import { Card, Badge, Button } from '@/components/ui';

export default function Profile() {
  const { user } = useApp();
  return (
    <>
      <Card title="Profile" sub="Managed by your workspace administrator">
        <div className="row gap-16">
          <span className="avatar" style={{ width: 52, height: 52, fontSize: 16 }}>{initials(user.name)}</span>
          <div><div className="t-section">{user.name}</div><div className="t-meta">{user.email}</div></div>
          <Badge tone="accent" plain>{ROLE_LABEL[user.role]}</Badge>
        </div>
      </Card>
      <Card flush>
        <div className="setting-row"><div><div className="sr-title">Name</div><div className="sr-desc">Shown in the audit log and on claims you update.</div></div><input className="input" value={user.name} readOnly aria-label="Name" style={{ maxWidth: 360 }} /></div>
        <div className="setting-row"><div><div className="sr-title">Email</div><div className="sr-desc">Used to sign in.</div></div><input className="input" value={user.email} readOnly aria-label="Email" style={{ maxWidth: 360 }} /></div>
        <div className="setting-row"><div><div className="sr-title">Role</div><div className="sr-desc">Decides which pages and actions you can use.</div></div><div className="row"><Badge tone="neutral" plain>{ROLE_LABEL[user.role]}</Badge><a className="link" href="/settings/roles">See permissions</a></div></div>
        <div className="setting-row"><div><div className="sr-title">Session</div><div className="sr-desc">Sessions last 10 hours on this device.</div></div><div><Button icon={LogOut} onClick={async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); window.location.href = '/login'; }}>Sign out</Button></div></div>
      </Card>
      <p className="t-meta">Profile editing isn’t available yet. Ask an administrator to change your name, email or role.</p>
    </>
  );
}
