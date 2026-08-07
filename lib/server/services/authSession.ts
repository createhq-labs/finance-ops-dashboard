import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { AppRole, BusinessLine } from '../types/submissions';
import { setAuthCookies } from './authCookies';

export type AppSessionUser = {
  id: string;
  email: string;
  role: AppRole;
  status: 'active' | 'inactive';
  business_line: BusinessLine | null;
};

export type ResolveAppSessionResult =
  | { ok: true; user: AppSessionUser }
  | { ok: false; reason: 'not_found' | 'inactive' };

/**
 * Post-authentication resolution shared by every login path (password, OAuth):
 * given a Supabase Auth user id that has already been verified as authentic
 * by the caller, find the mapped Finance application user and confirm it is
 * active. Never creates, updates, or upserts a public.users row.
 */
export async function resolveActiveAppUserBySupabaseAuthId(
  client: SupabaseClient,
  supabaseAuthId: string
): Promise<ResolveAppSessionResult> {
  const { data, error } = await client
    .from('users')
    .select('id, email, role, status, business_line')
    .eq('supabase_auth_id', supabaseAuthId)
    .single();

  if (error || !data) {
    return { ok: false, reason: 'not_found' };
  }

  if (data.status !== 'active') {
    return { ok: false, reason: 'inactive' };
  }

  return { ok: true, user: data as AppSessionUser };
}

/**
 * Issues the existing httpOnly session cookies and the standard success body
 * shared by every login path. The caller remains responsible for proving the
 * accessToken/refreshToken pair is genuine before calling this.
 */
export function issueAppSessionResponse(user: AppSessionUser, accessToken: string, refreshToken: string) {
  const res = NextResponse.json({ success: true, user }, { status: 200 });
  setAuthCookies(res, accessToken, refreshToken);
  return res;
}
