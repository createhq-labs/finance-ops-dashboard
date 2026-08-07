import { NextRequest, NextResponse } from 'next/server';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '@/lib/server/supabase';
import { issueAppSessionResponse, resolveActiveAppUserBySupabaseAuthId } from '@/lib/server/services/authSession';

function isCreateDomainEmail(email: string) {
  return email.toLowerCase().endsWith('@create.wtf');
}

export async function POST(req: NextRequest) {
  try {
    assertSupabaseEnv();
    const body = await req.json();

    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '').trim();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'email and password are required' }, { status: 400 });
    }

    // Gate 1: company domain only.
    if (!isCreateDomainEmail(email)) {
      return NextResponse.json({ success: false, error: 'Only @create.wtf accounts can login.' }, { status: 403 });
    }

    const svc = createServiceClient();

    // Gate 2 + 3: user must exist in public.users and be active.
    const { data: appUser, error: appUserError } = await svc
      .from('users')
      .select('id, supabase_auth_id, email, role, status, business_line')
      .eq('email', email)
      .single();

    if (appUserError || !appUser) {
      return NextResponse.json({ success: false, error: 'Account is not provisioned. Contact admin/finance.' }, { status: 403 });
    }

    if (appUser.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Account is inactive. Contact admin/finance.' }, { status: 403 });
    }

    const anon = createUserScopedClient('');
    const { data, error } = await anon.auth.signInWithPassword({ email, password });

    if (error || !data.session || !data.user) {
      return NextResponse.json({ success: false, error: error?.message || 'Login failed' }, { status: 401 });
    }

    // Ensure authenticated identity matches provisioned identity, then issue the session.
    const resolved = await resolveActiveAppUserBySupabaseAuthId(svc, data.user.id);
    if (!resolved.ok) {
      const message =
        resolved.reason === 'inactive'
          ? 'Account is inactive. Contact admin/finance.'
          : 'Account mismatch. Contact admin/finance.';
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }

    return issueAppSessionResponse(resolved.user, data.session.access_token, data.session.refresh_token);
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}
