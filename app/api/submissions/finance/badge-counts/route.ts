import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../../lib/server/auth';
import { getAccessTokenFromCookieHeader } from '../../../../../lib/server/services/authCookies';
import { FINANCE_BADGE_TRACKING_SINCE } from '../../../../../lib/shared/feature-flags';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '../../../../../lib/server/supabase';

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
    const adminClient = createServiceClient();
    const appUser = await getCurrentAppUser(userClient, token);

    if (!(appUser.role === 'finance' || appUser.role === 'admin')) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
    }

    const [newSubmissionsResult, newResubmissionsResult] = await Promise.all([
      adminClient
        .from('intake_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('intake_status', 'submitted')
        .is('previous_submission_id', null)
        .gte('created_at', FINANCE_BADGE_TRACKING_SINCE),
      adminClient
        .from('intake_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('intake_status', 'submitted')
        .not('previous_submission_id', 'is', null)
        .gte('created_at', FINANCE_BADGE_TRACKING_SINCE),
    ]);

    if (newSubmissionsResult.error) throw new Error(newSubmissionsResult.error.message);
    if (newResubmissionsResult.error) throw new Error(newResubmissionsResult.error.message);

    return NextResponse.json(
      {
        success: true,
        newSubmissions: newSubmissionsResult.count ?? 0,
        newResubmissions: newResubmissionsResult.count ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load Finance Review badge counts.' },
      { status: 400 }
    );
  }
}
