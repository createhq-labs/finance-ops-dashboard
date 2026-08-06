'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { LoginExperience } from '@/components/auth/login-experience';
import { getBrowserSupabaseClient } from '@/lib/client/supabase';
import { GOOGLE_LOGIN_ENABLED } from '@/lib/shared/feature-flags';

function getSafeNextParam() {
  if (typeof window === 'undefined') return null;
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/dashboard') ? next : null;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    if (!GOOGLE_LOGIN_ENABLED) return;

    setError('');
    setGoogleLoading(true);

    try {
      const supabase = getBrowserSupabaseClient();
      const safeNext = getSafeNextParam();
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      if (safeNext) callbackUrl.searchParams.set('next', safeNext);

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl.toString() },
      });

      if (oauthError) {
        throw new Error(oauthError.message || 'Unable to start Google sign-in');
      }
      // On success the browser is redirected to Google; this component unmounts.
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to start Google sign-in');
      setGoogleLoading(false);
    }
  }

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
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="login-field">
          <label htmlFor="email" className="login-field-label">
            Email
          </label>
          <div className="login-input-wrap">
            <Mail size={16} className="login-input-icon" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="login-input"
              placeholder="you@create.wtf"
            />
          </div>
        </div>

        <div className="login-field">
          <label htmlFor="password" className="login-field-label">
            Password
          </label>
          <div className="login-input-wrap">
            <Lock size={16} className="login-input-icon" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="login-input login-input-password"
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              className="login-input-eye"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error ? <p className="login-form-error">{error}</p> : null}

        <button type="submit" disabled={loading} className="login-submit">
          {loading ? <span className="login-spinner" aria-label="Signing in" /> : 'Sign in'}
        </button>

        {GOOGLE_LOGIN_ENABLED ? (
          <>
            <div className="login-divider">
              <span>or</span>
            </div>
            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={googleLoading}
              className="login-google-button"
            >
              {googleLoading ? (
                <span className="login-spinner" aria-label="Redirecting to Google" />
              ) : (
                'Continue with Google'
              )}
            </button>
          </>
        ) : null}

        <style jsx>{`
          @property --login-button-border-angle {
            syntax: '<angle>';
            inherits: false;
            initial-value: 100deg;
          }

          .login-form {
            display: flex;
            flex-direction: column;
            margin-top: 24px;
          }

          .login-field {
            margin-bottom: 16px;
          }

          .login-field-label {
            display: block;
            margin-bottom: 6px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: rgba(255, 255, 255, 0.94);
          }

          .login-input-wrap {
            position: relative;
            display: flex;
            align-items: center;
          }

          .login-input-wrap :global(.login-input-icon) {
            position: absolute;
            left: 14px;
            color: rgba(255, 255, 255, 0.88);
            pointer-events: none;
          }

          .login-input {
            width: 100%;
            height: 48px;
            padding: 0 14px 0 42px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.18);
            background: #000000;
            box-shadow: inset 0 0 0 999px #000000;
            color: #ffffff;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
          }

          .login-input::placeholder {
            color: rgba(255, 255, 255, 0.48);
          }

          .login-input:hover:not(:focus) {
            border-color: rgba(6, 182, 212, 0.3);
          }

          .login-input:focus {
            border-color: rgba(6, 182, 212, 0.5);
            box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.08);
          }

          .login-input-password {
            padding-right: 42px;
          }

          .login-input-eye {
            position: absolute;
            right: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            border: none;
            padding: 0;
            color: rgba(255, 255, 255, 0.88);
            cursor: pointer;
            transition: color 0.15s ease;
          }

          .login-input-eye:hover {
            color: #ffffff;
          }

          .login-form-error {
            margin: 0 0 16px;
            padding: 12px 14px;
            border-radius: 10px;
            border: 1px solid rgba(251, 113, 133, 0.25);
            background: rgba(251, 113, 133, 0.1);
            color: #fecdd3;
            font-size: 13px;
          }

          .login-submit {
            --login-button-border-angle: 100deg;
            box-sizing: border-box;
            height: 48px;
            margin-top: 8px;
            border: 2px solid transparent;
            border-radius: 10px;
            background:
              linear-gradient(135deg, #06b6d4 0%, #4f46e5 100%) padding-box,
              linear-gradient(
                var(--login-button-border-angle),
                #22d3ee 0%,
                #67e8f9 18%,
                #38bdf8 34%,
                #6366f1 58%,
                #8b5cf6 78%,
                #d946ef 100%
              ) border-box;
            color: #ffffff;
            font-size: 15px;
            font-weight: 600;
            letter-spacing: 0.02em;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 200ms ease;
          }

          .login-submit:hover:not(:disabled),
          .login-submit:focus-visible:not(:disabled) {
            animation: rotateButtonBorder 3000ms linear infinite;
            background:
              linear-gradient(135deg, #22d3ee 0%, #6366f1 100%) padding-box,
              linear-gradient(
                var(--login-button-border-angle),
                #22d3ee 0%,
                #67e8f9 18%,
                #38bdf8 34%,
                #6366f1 58%,
                #8b5cf6 78%,
                #d946ef 100%
              ) border-box;
            transform: translateY(-1px);
            box-shadow: 0 8px 24px rgba(6, 182, 212, 0.25);
          }

          .login-submit:active:not(:disabled) {
            transform: translateY(0);
          }

          .login-submit:disabled {
            cursor: not-allowed;
            opacity: 0.75;
          }

          .login-divider {
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 16px 0;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: rgba(255, 255, 255, 0.48);
          }

          .login-divider::before,
          .login-divider::after {
            content: '';
            flex: 1;
            height: 1px;
            background: rgba(255, 255, 255, 0.14);
          }

          .login-google-button {
            box-sizing: border-box;
            height: 48px;
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 10px;
            background: #000000;
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: border-color 0.2s ease, background 0.2s ease;
          }

          .login-google-button:hover:not(:disabled) {
            border-color: rgba(6, 182, 212, 0.4);
            background: rgba(6, 182, 212, 0.06);
          }

          .login-google-button:disabled {
            cursor: not-allowed;
            opacity: 0.75;
          }

          .login-spinner {
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: #ffffff;
            border-radius: 50%;
            animation: login-spin 600ms linear infinite;
          }

          @keyframes login-spin {
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes rotateButtonBorder {
            from {
              --login-button-border-angle: 0deg;
            }
            to {
              --login-button-border-angle: 360deg;
            }
          }
        `}</style>
      </form>
    </LoginExperience>
  );
}
