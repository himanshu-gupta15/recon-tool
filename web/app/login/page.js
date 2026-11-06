'use client';
import { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { BrandMark } from '@/components/shell/Sidebar';
import { Alert, Button, Field, Badge } from '@/components/ui';

const DEMO = [['finance@demo.local', 'Finance Executive'], ['founder@demo.local', 'Finance Co-founder'], ['returns@demo.local', 'Returns Manager']];

export default function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const u = await api('/auth/login', { json: { email, password } });
      window.location.href = u.role === 'returns' ? '/returns' : '/';
    } catch (err) { setError(err.message === 'Wrong email or password' ? 'That email and password don’t match. Check both and try again.' : err.message); setBusy(false); }
  };
  return (
    <div className="auth">
      <div className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <div className="row gap-12" style={{ marginBottom: 12 }}><BrandMark /><span className="brand-word">RECON</span></div>
          <div><h1 className="t-page">Sign in</h1><p className="muted mt-4">Reconcile partner payouts, freight and returns.</p></div>
          {error && <Alert tone="critical">{error}</Alert>}
          <Field label="Work email"><input className="input" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
          <Field label="Password"><input className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Button type="submit" variant="primary" size="lg" className="block" loading={busy} iconRight={busy ? undefined : ArrowRight}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          {process.env.NODE_ENV !== 'production' && (
            <div className="stack gap-12" style={{ marginTop: 12 }}>
              <div className="t-label">Demo accounts · password demo1234</div>
              <div className="demo-accounts">
                {DEMO.map(([e, r]) => (
                  <button type="button" key={e} onClick={() => { setEmail(e); setPassword('demo1234'); }}>
                    <span className="grow"><span className="strong" style={{ display: 'block', fontSize: 13 }}>{r}</span><span className="t-meta mono">{e}</span></span>
                    <span className="t-meta">Use</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
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
    </div>
  );
}
