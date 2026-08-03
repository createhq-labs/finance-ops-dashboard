import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';
import { countPendingFollowUpsForUser, countPendingGstScreenshotMissingFollowUps } from '../../../../lib/server/services/followUps';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '../../../../lib/server/supabase';

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

    const scope = req.nextUrl.searchParams.get('scope');
    if (scope === 'gst_screenshot_missing') {
      if (appUser.role !== 'finance' && appUser.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 });
      }
      const count = await countPendingGstScreenshotMissingFollowUps({ adminClient });
      return NextResponse.json({ success: true, count }, { status: 200 });
    }

    const count = await countPendingFollowUpsForUser({ adminClient, appUser });

    return NextResponse.json({ success: true, count }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load follow-up count.' },
      { status: 400 }
    );
  }
}
