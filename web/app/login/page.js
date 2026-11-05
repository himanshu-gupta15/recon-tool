'use client';
import { useState } from 'react';
import { api } from '../lib';

export default function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const u = await api('/auth/login', { json: { email, password } });
      window.location.href = u.role === 'returns' ? '/returns' : '/';
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <div className="login">
      <form onSubmit={submit}>
        <div><h1>Recon</h1><p className="sub">See whether every order was paid correctly.</p></div>
        {error && <div className="notice err" role="alert" style={{ margin: 0 }}>{error}</div>}
        <label className="f">Email<input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="f">Password<input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="btn primary" disabled={busy} style={{ justifyContent: 'center' }}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
