import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';
import { assertSupabaseEnv, createUserScopedClient } from '../../../../lib/server/supabase';

export async function GET(req: NextRequest) {
  try {
    assertSupabaseEnv();

    let token = '';
    try {
      token = getBearerToken(req);
    } catch {
      token = getAccessTokenFromCookieHeader(req.cookies) ?? '';
    }
    if (!token) throw new Error('Missing auth token');

    const userClient = createUserScopedClient(token);
    const appUser = await getCurrentAppUser(userClient, token);

    if (!(appUser.role === 'employee' || appUser.role === 'team_lead')) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }

    const { count, error } = await userClient
      .from('intake_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('submitted_by', appUser.id)
      .eq('intake_status', 'rejected')
      .eq('is_latest_version', true);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, count: count ?? 0 }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load pending resubmission count.' },
      { status: 400 }
    );
  }
}
