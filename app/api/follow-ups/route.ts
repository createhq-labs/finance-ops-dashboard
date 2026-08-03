import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../lib/server/auth';
import { getAccessTokenFromCookieHeader } from '../../../lib/server/services/authCookies';
import { listFollowUpsForUser } from '../../../lib/server/services/followUps';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '../../../lib/server/supabase';

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
    const query = req.nextUrl.searchParams.get('q') ?? '';
    const status = (req.nextUrl.searchParams.get('status') ?? 'all') as 'all' | 'pending' | 'completed';
    const type = (req.nextUrl.searchParams.get('type') ?? 'all') as 'all' | 'payment_received_pending' | 'gst_pending';
    const screenshot = (req.nextUrl.searchParams.get('screenshot') ?? 'all') as 'all' | 'missing' | 'uploaded';

    const items = await listFollowUpsForUser({
      adminClient,
      appUser,
      query,
      status,
      type,
      screenshot,
    });

    return NextResponse.json({ success: true, follow_ups: items }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load follow-ups.' },
      { status: 400 }
    );
  }
}
