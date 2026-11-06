'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { BrandMark } from '@/components/shell/Sidebar';
import { AuthAside } from '@/components/AuthAside';
import { Alert, Button, Field } from '@/components/ui';

export default function Register() {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api('/auth/register', { json: { name, email, password } });
      window.location.href = '/';
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <div className="auth">
      <div className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <div className="row gap-12" style={{ marginBottom: 12 }}><BrandMark /><span className="brand-word">RECON</span></div>
          <div><h1 className="t-page">Create your account</h1><p className="muted mt-4">You’ll join as a Finance Executive in this shared demo.</p></div>
          {error && <Alert tone="critical">{error}</Alert>}
          <Field label="Full name"><input className="input" required maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label="Email"><input className="input" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password"><input className="input" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <p className="t-meta">Use a password you don’t use anywhere else. Everyone shares the same invented data, and other users can see your name and email.</p>
          <Button type="submit" variant="primary" size="lg" className="block" loading={busy} iconRight={busy ? undefined : ArrowRight}>{busy ? 'Creating account…' : 'Create account'}</Button>
          <p className="muted" style={{ textAlign: 'center' }}>Already have an account? <Link className="link" href="/login">Sign in</Link></p>
        </form>
      </div>
      <AuthAside />
    </div>
  );
}
