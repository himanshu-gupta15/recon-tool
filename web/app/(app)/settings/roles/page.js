'use client';
import { Check, Minus } from 'lucide-react';
import { PERMISSIONS, ROLE_LABEL } from '@/lib/roles';
import { useApp } from '@/components/shell/AppContext';
import { Card } from '@/components/ui';

const ROLES = ['finance', 'cofounder', 'returns'];

export default function Roles() {
  const { user } = useApp();
  return (
    <Card flush title="Roles & permissions" sub="Enforced by the server on every request. Your role is highlighted.">
      <div className="table-wrap">
        <table className="table compact">
          <thead><tr><th>Permission</th>{ROLES.map((r) => <th key={r} style={{ textAlign: 'center', color: r === user.role ? 'var(--accent)' : undefined }}>{ROLE_LABEL[r]}</th>)}</tr></thead>
          <tbody>
            {PERMISSIONS.map(([label, roles]) => (
              <tr key={label}>
                <td>{label}</td>
                {ROLES.map((r) => (
                  <td key={r} style={{ textAlign: 'center', background: r === user.role ? 'color-mix(in srgb, var(--accent-soft) 60%, transparent)' : undefined }}>
                    {roles.includes(r) ? <Check aria-label="Allowed" className="perm-yes" style={{ width: 16, height: 16 }} /> : <Minus aria-label="Not allowed" className="perm-no" style={{ width: 16, height: 16 }} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot">Finance executives see customer names and phones masked. Returns managers only see return claims.</div>
    </Card>
  );
}
