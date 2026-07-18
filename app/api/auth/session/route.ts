import { NextRequest, NextResponse } from 'next/server';
import { assertSupabaseEnv, createUserScopedClient } from '@/lib/server/supabase';
import { getAuthenticatedSupabaseUser } from '@/lib/server/auth';
import { getAccessTokenFromCookieHeader } from '@/lib/server/services/authCookies';

export async function GET(req: NextRequest) {
  try {
    assertSupabaseEnv();
    const token = getAccessTokenFromCookieHeader(req.cookies);
    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const anon = createUserScopedClient(token);
    const authUser = await getAuthenticatedSupabaseUser(anon, token).catch(() => null);
    if (!authUser) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const { data: appUser, error: appUserError } = await anon
      .from('users')
      .select('id, email, full_name, role, status, business_line')
      .eq('supabase_auth_id', authUser.id)
      .single();

    if (appUserError || !appUser) {
      return NextResponse.json({ authenticated: false, error: 'App user not found' }, { status: 401 });
    }

    return NextResponse.json({ authenticated: true, user: appUser }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ authenticated: false, error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}
