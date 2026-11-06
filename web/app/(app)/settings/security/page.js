import { CheckCircle2 } from 'lucide-react';
import { Card, Badge } from '@/components/ui';

const CONTROLS = [
  ['Sign-in sessions', 'HTTP-only cookie, expires after 10 hours. Sign-in attempts are rate limited.'],
  ['Role checks', 'Every API request checks your role on the server, not just in the browser.'],
  ['Customer data', 'Customer name and phone are optional, masked for everyone except the co-founder, and left out of evidence exports.'],
  ['Unmapped columns', 'Columns you don’t map are never stored, and uploaded files are deleted after import.'],
  ['AI column mapping', 'The model sees only column names and sample values with letters and digits masked.'],
  ['Audit trail', 'Approvals, claim updates, review decisions, exports and rate changes are recorded with who and when.'],
];

export default function Security() {
  return (
    <Card flush title="Security" sub="Controls built into this workspace" actions={<Badge tone="neutral" plain>Read-only</Badge>}>
      {CONTROLS.map(([t, d]) => (
        <div key={t} className="setting-row">
          <div className="row gap-12" style={{ alignItems: 'flex-start' }}><CheckCircle2 aria-hidden="true" style={{ width: 16, height: 16, color: 'var(--success)', marginTop: 2 }} /><div className="sr-title">{t}</div></div>
          <div style={{ color: 'var(--ink-2)' }}>{d}</div>
        </div>
      ))}
      <div className="table-foot">Single sign-on, two-factor sign-in and password changes aren’t available yet.</div>
    </Card>
  );
}
