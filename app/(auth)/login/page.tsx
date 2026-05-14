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

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok || !json.success) {
      setError(json.error || 'Login failed');
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="bg-app" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <section className="surface" style={{ width: '100%', maxWidth: 460, padding: 24 }}>
        <div style={{ marginBottom: 14 }}>
          <h1 style={{ margin: 0 }}>CREATE Finance Ops</h1>
          <p className="text-muted" style={{ marginTop: 6 }}>
            Use your provisioned <strong>@create.wtf</strong> account.
          </p>
        </div>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)' }}
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)' }}
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        {error ? <p className="text-danger" style={{ marginTop: 12 }}>{error}</p> : null}
        <p className="text-muted" style={{ marginTop: 12 }}>No public signup. Ask admin/finance to provision your account.</p>
      </section>
    </main>
  );
}
