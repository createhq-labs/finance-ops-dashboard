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
    <main className="bg-app" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <section className="intake-section" style={{ width: '100%', maxWidth: 460 }}>
        <div className="intake-section-header">
          <h1 style={{ margin: 0 }}>CREATE Finance Ops</h1>
          <p className="text-muted" style={{ marginTop: 6 }}>Sign in with your provisioned <strong>@create.wtf</strong> account.</p>
        </div>

        <form onSubmit={onSubmit} className="intake-section-body" style={{ display: 'grid', gap: 12 }}>
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
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>

          {error ? <p style={{ marginTop: 6, color: 'var(--danger)' }}>{error}</p> : null}
          <p className="text-muted" style={{ marginTop: 6 }}>No public signup. Ask admin/finance to provision your account.</p>
        </form>
      </section>
    </main>
  );
}
