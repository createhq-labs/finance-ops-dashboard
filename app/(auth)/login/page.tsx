'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { LoginExperience } from '@/components/auth/login-experience';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body?.error || 'Unable to sign in');
      }

      const nextPath =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('next')
          : null;
      const safeNext = nextPath && nextPath.startsWith('/dashboard') ? nextPath : '/dashboard';

      router.push(safeNext);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoginExperience>
      <form className="space-y-4" onSubmit={handleSubmit}>

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-widest text-white/75 mx-2">
            Email
          </label>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 transition focus-within:border-sky-400/50 focus-within:bg-black/30">
            <Mail size={15} className="shrink-0 text-white/40" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              placeholder="you@create.wtf"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-widest text-white/75 mx-2">
              Password
          </label>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 transition focus-within:border-sky-400/50 focus-within:bg-black/30">
            <Lock size={15} className="shrink-0 text-white/40" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              className="shrink-0 text-white/85 transition hover:text-white/80"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error ? (
          <p className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-600 text-sm font-semibold text-white shadow-[0_8px_32px_-4px_rgba(99,102,241,0.5)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

      </form>
    </LoginExperience>
  );
}
