'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Building2, Calculator, KeyRound, Scale, ShieldCheck, User, Users } from 'lucide-react';
import { useApp } from '@/components/shell/AppContext';
import { can } from '@/lib/roles';
import { PageHeader } from '@/components/ui';

const ITEMS = [
  ['/settings', 'Profile', User],
  ['/settings/team', 'Team', Users, 'team'],
  ['/settings/roles', 'Roles & permissions', KeyRound],
  ['/settings/partners', 'Partners', Building2, 'rates'],
  ['/settings/rate-cards', 'Rate cards', Calculator, 'rates'],
  ['/settings/rules', 'Reconciliation rules', Scale],
  ['/settings/notifications', 'Notifications', Bell],
  ['/settings/security', 'Security', ShieldCheck],
];

export default function SettingsLayout({ children }) {
  const path = usePathname();
  const { user } = useApp();
  return (
    <>
      <PageHeader title="Settings" sub="Your profile, team access, partners and the rules that decide every result." />
      <div className="settings">
        <nav className="settings-nav" aria-label="Settings">
          {ITEMS.filter(([, , , need]) => !need || can(user, need)).map(([href, label, Icon]) => (
            <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}><Icon aria-hidden="true" />{label}</Link>
          ))}
        </nav>
        <div className="stack gap-24" style={{ minWidth: 0 }}>{children}</div>
      </div>
    </>
  );
}
