import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '../../../../lib/server/supabase';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';
import { listTeamLeadSubmissions } from '../../../../lib/server/services/team';

function resolveToken(req: NextRequest) {
  try {
    return getBearerToken(req);
  } catch {
    return getAccessTokenFromCookieHeader(req.cookies) ?? '';
  }
}

export async function GET(req: NextRequest) {
  try {
    assertSupabaseEnv();

    const token = resolveToken(req);
    if (!token) throw new Error('Missing auth token');

    const userClient = createUserScopedClient(token);
    const appUser = await getCurrentAppUser(userClient, token);
    if (appUser.role !== 'team_lead') {
      throw new Error('Unauthorized');
    }

    const adminClient = createServiceClient();
    const submissions = await listTeamLeadSubmissions(adminClient, appUser.id);

    return NextResponse.json({ success: true, submissions }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
