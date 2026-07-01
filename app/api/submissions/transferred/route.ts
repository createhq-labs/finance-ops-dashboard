import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '@/lib/server/auth';
import { getAccessTokenFromCookieHeader } from '@/lib/server/services/authCookies';
import { createServiceClient, createUserScopedClient, assertSupabaseEnv } from '@/lib/server/supabase';
import { listTransferredSubmissions } from '@/lib/server/services/submissionOwnership';
import { ENABLE_TRANSFERRED_SUBMISSIONS } from '@/lib/shared/feature-flags';

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
  if (!ENABLE_TRANSFERRED_SUBMISSIONS) {
    return NextResponse.json({ success: false, error: 'Not found.' }, { status: 404 });
  }

  try {
    assertSupabaseEnv();
    const token = resolveToken(req);
    if (!token) throw new Error('Missing auth token');

    const userClient = createUserScopedClient(token);
    const appUser = await getCurrentAppUser(userClient, token);
    if (appUser.role !== 'team_lead') throw new Error('Unauthorized');

    const params = req.nextUrl.searchParams;
    const serviceClient = createServiceClient();
    const result = await listTransferredSubmissions(serviceClient, {
      teamLeadId: appUser.id,
      limit: clampLimit(params.get('limit'), 50),
      offset: parseOffset(params.get('offset')),
      query: params.get('query'),
      status: params.get('status'),
      originalEmployeeQuery: params.get('original_employee_query'),
      submissionId: params.get('submission_id'),
      dateFrom: params.get('date_from'),
      dateTo: params.get('date_to'),
    });

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
