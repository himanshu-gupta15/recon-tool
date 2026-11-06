import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui';

export function AuthAside() {
  return (
    <aside className="auth-aside" aria-hidden="true">
      <div className="preview">
        <div className="card-head"><span className="t-section">Exceptions requiring attention</span><Badge tone="neutral" plain>Example</Badge></div>
        {[['Unpaid', 'critical', '−₹1,409.00'], ['Short paid', 'warning', '−₹37.00'], ['Short paid', 'warning', '−₹46.00'], ['Matched', 'success', '₹0.00']].map(([l, t, v], i) => (
          <div key={i} className="row between" style={{ padding: '12px 18px', borderTop: i ? '1px solid var(--line-2)' : 0 }}>
            <Badge tone={t}>{l}</Badge><span className={`tnum strong ${t === 'success' ? 'faint' : 'neg'}`}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ maxWidth: 460 }}>
        <h2 className="t-section" style={{ fontSize: 18 }}>Know which orders were paid wrong, and why.</h2>
        <p className="muted mt-8">Upload settlement, COD, freight and warehouse files. Recon matches every order against your rate cards and turns gaps into claims with evidence.</p>
        <p className="t-meta mt-16 row gap-4"><ShieldCheck aria-hidden="true" style={{ width: 14, height: 14 }} />Fixed, explainable rules. Every action is audit-logged.</p>
      </div>
    </aside>
  );
}
