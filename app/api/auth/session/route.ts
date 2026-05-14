import { NextRequest, NextResponse } from 'next/server';
import { assertSupabaseEnv, createUserScopedClient } from '../../../../lib/server/supabase';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';

export async function GET(req: NextRequest) {
  try {
    assertSupabaseEnv();
    const token = getAccessTokenFromCookieHeader(req.cookies);
    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const anon = createUserScopedClient(token);
    const { data, error } = await anon.auth.getUser(token);
    if (error || !data.user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const { data: appUser, error: appUserError } = await anon
      .from('users')
      .select('id, email, full_name, role, status')
      .eq('supabase_auth_id', data.user.id)
      .single();

    if (appUserError || !appUser) {
      return NextResponse.json({ authenticated: false, error: 'App user not found' }, { status: 401 });
    }

    return NextResponse.json({ authenticated: true, user: appUser }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ authenticated: false, error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}
