'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/lib/client/supabase';
import { GOOGLE_LOGIN_ENABLED } from '@/lib/shared/feature-flags';

function resolveSafeNext(next: string | null) {
  return next && next.startsWith('/dashboard') ? next : '/dashboard';
}

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'working' | 'error'>('working');
  const [message, setMessage] = useState('Completing sign-in…');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!GOOGLE_LOGIN_ENABLED) {
        setStatus('error');
        setMessage('Google sign-in is not enabled.');
        return;
      }

      const oauthError = searchParams.get('error') || searchParams.get('error_description');
      if (oauthError) {
        setStatus('error');
        setMessage('Google sign-in was cancelled or failed.');
        return;
      }

      const code = searchParams.get('code');
      if (!code) {
        setStatus('error');
        setMessage('Google sign-in did not return an authorization code.');
        return;
      }

      let supabase: ReturnType<typeof getBrowserSupabaseClient>;
      try {
        supabase = getBrowserSupabaseClient();
      } catch {
        setStatus('error');
        setMessage('Sign-in is not configured correctly.');
        return;
      }

      try {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError || !data.session) {
          setStatus('error');
          setMessage('Unable to complete Google sign-in.');
          return;
        }

        const { access_token, refresh_token } = data.session;

        const response = await fetch('/api/auth/oauth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token, refresh_token }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result?.success) {
          await supabase.auth.signOut();
          if (!cancelled) {
            setStatus('error');
            setMessage(result?.error || 'Access denied. Contact admin/finance.');
          }
          return;
        }

        if (cancelled) return;

        const safeNext = resolveSafeNext(searchParams.get('next'));
        router.push(safeNext);
        router.refresh();
      } catch {
        await supabase.auth.signOut().catch(() => {});
        if (!cancelled) {
          setStatus('error');
          setMessage('Unable to complete sign-in. Please try again.');
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="oauth-callback">
      {status === 'working' ? (
        <p>{message}</p>
      ) : (
        <>
          <p>{message}</p>
          <a href="/login">Return to sign-in</a>
        </>
      )}

      <style jsx>{`
        .oauth-callback {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          height: 100vh;
          width: 100vw;
          background: #000000;
          color: #ffffff;
          font-size: 14px;
          text-align: center;
        }

        .oauth-callback a {
          color: #22d3ee;
        }
      `}</style>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
