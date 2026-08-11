import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '../../../../lib/server/supabase';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';
import { listTeamLeadSubmissions } from '../../../../lib/server/services/team';
import { createPerfTimer } from '../../../../lib/server/perf-timing';

function resolveToken(req: NextRequest) {
  try {
    return getBearerToken(req);
  } catch {
    return getAccessTokenFromCookieHeader(req.cookies) ?? '';
  }
}

function clampLimit(value: string | null, fallback = 50) {
  const parsed = Number.parseInt(value || '', 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 100);
}

function parseOffset(value: string | null) {
  const parsed = Number.parseInt(value || '', 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
}

export async function GET(req: NextRequest) {
  const perf = createPerfTimer('submissions-team');
  perf.mark('START');
  try {
    assertSupabaseEnv();

    const token = resolveToken(req);
    if (!token) throw new Error('Missing auth token');
    perf.log('request_parse_and_token');

    const userClient = createUserScopedClient(token);
    const appUser = await getCurrentAppUser(userClient, token);
    if (appUser.role !== 'team_lead') {
      throw new Error('Unauthorized');
    }
    perf.log('auth_app_user_resolve');

    const params = req.nextUrl.searchParams;
    const adminClient = createServiceClient();
    const result = await listTeamLeadSubmissions(adminClient, {
      teamLeadId: appUser.id,
      limit: clampLimit(params.get('limit'), 50),
      offset: parseOffset(params.get('offset')),
      query: params.get('query'),
      status: params.get('status'),
      memberQuery: params.get('member_query'),
      submissionId: params.get('submission_id'),
    }, perf);
    perf.log('list_team_lead_submissions_total');

    const response = NextResponse.json({ success: true, ...result }, { status: 200 });
    perf.log('json_response_prepare');
    perf.total();
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
