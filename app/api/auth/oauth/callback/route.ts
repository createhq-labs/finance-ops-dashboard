import { NextRequest, NextResponse } from 'next/server';
import { assertSupabaseEnv, createUserScopedClient } from '@/lib/server/supabase';
import { getAuthenticatedSupabaseUser } from '@/lib/server/auth';
import { issueAppSessionResponse, resolveActiveAppUserBySupabaseAuthId } from '@/lib/server/services/authSession';
import { GOOGLE_LOGIN_ENABLED } from '@/lib/shared/feature-flags';

/**
 * Exchanges an already-established Supabase OAuth session (access/refresh
 * token pair produced client-side by exchangeCodeForSession) for this app's
 * own httpOnly session cookies. Mirrors /api/auth/login: the OAuth-authenticated
 * Supabase identity must resolve to an existing, active public.users row via
 * supabase_auth_id before any cookie is issued. No public.users row is ever
 * created or modified here.
 */
export async function POST(req: NextRequest) {
  try {
    assertSupabaseEnv();

    if (!GOOGLE_LOGIN_ENABLED) {
      return NextResponse.json({ success: false, error: 'Google sign-in is not enabled.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const accessToken = typeof body?.access_token === 'string' ? body.access_token : '';
    const refreshToken = typeof body?.refresh_token === 'string' ? body.refresh_token : '';

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ success: false, error: 'Missing session from Google sign-in.' }, { status: 400 });
    }

    const userClient = createUserScopedClient(accessToken);
    const authUser = await getAuthenticatedSupabaseUser(userClient, accessToken).catch(() => null);

    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Google sign-in could not be verified.' }, { status: 401 });
    }

    const resolved = await resolveActiveAppUserBySupabaseAuthId(userClient, authUser.id);
    if (!resolved.ok) {
      const message =
        resolved.reason === 'inactive'
          ? 'Account is inactive. Contact admin/finance.'
          : 'This Google account is not provisioned. Contact admin/finance.';
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }

    return issueAppSessionResponse(resolved.user, accessToken, refreshToken);
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}
