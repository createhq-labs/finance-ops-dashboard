"use client";

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json().catch(() => null);
      setLoading(false);

      if (!res.ok || !json?.success) {
        setError(json?.error || 'Login failed');
        return;
      }

      const nextPath = new URLSearchParams(window.location.search).get('next');
      const safeNext = nextPath && nextPath.startsWith('/dashboard') ? nextPath : '/dashboard';
      router.push(safeNext);
      router.refresh();
    } catch {
      setLoading(false);
      setError('Unable to reach login service. Please try again.');
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: 20,
      background: 'radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.15), transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.12), transparent 50%), var(--bg)'
    }}>
      <section className="surface" style={{ width: '100%', maxWidth: 420, padding: '36px 32px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div className="sidebar-logo-mark" style={{ width: 40, height: 40, fontSize: 18 }}>C</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Finance Ops</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>CREATE · Internal</div>
          </div>
        </div>

        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>Sign in</h1>
        <p className="text-muted" style={{ marginTop: 0, marginBottom: 24, fontSize: 14 }}>
          Use your provisioned <strong>@create.wtf</strong> account.
        </p>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="intake-input"
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="intake-input"
          />
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4, padding: '12px 0', fontSize: 15 }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          {error ? <p style={{ margin: 0, color: 'var(--danger)', fontSize: 14 }}>{error}</p> : null}
        </form>

        <p className="text-muted" style={{ marginTop: 20, fontSize: 12, textAlign: 'center' }}>
          No public signup. Contact admin to provision access.
        </p>
      </section>
    </main>
  );
}
