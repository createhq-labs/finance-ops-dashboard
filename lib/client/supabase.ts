'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

/**
 * Browser-only Supabase client used exclusively for the Google OAuth handshake.
 * PKCE code exchange requires the code_verifier that signInWithOAuth stores in
 * this client's local storage, so it must persist a session (unlike the
 * server-only clients in lib/server/supabase.ts). It is not used for any other
 * request in the app — the existing httpOnly-cookie session remains the source
 * of truth once /api/auth/oauth/callback issues it.
 */
export function getBrowserSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase browser env configuration');
  }

  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });

  return browserClient;
}
