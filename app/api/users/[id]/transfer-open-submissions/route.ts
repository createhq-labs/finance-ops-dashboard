import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '@/lib/server/auth';
import { getAccessTokenFromCookieHeader } from '@/lib/server/services/authCookies';
import { createServiceClient, createUserScopedClient, assertSupabaseEnv } from '@/lib/server/supabase';
import { transferOpenSubmissionsToMappedTeamLead } from '@/lib/server/services/submissionOwnership';
import { ENABLE_TRANSFERRED_SUBMISSIONS } from '@/lib/shared/feature-flags';

function resolveToken(req: NextRequest) {
  try {
    return getBearerToken(req);
  } catch {
    return getAccessTokenFromCookieHeader(req.cookies) ?? '';
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!ENABLE_TRANSFERRED_SUBMISSIONS) {
    return NextResponse.json({ success: false, error: 'Not found.' }, { status: 404 });
  }

  try {
    assertSupabaseEnv();
    const token = resolveToken(req);
    if (!token) throw new Error('Missing auth token');

    const userClient = createUserScopedClient(token);
    const appUser = await getCurrentAppUser(userClient, token);
    const { id } = await context.params;

    const serviceClient = createServiceClient();
    const result = await transferOpenSubmissionsToMappedTeamLead({
      adminClient: serviceClient,
      actorUserId: appUser.id,
      actorRole: appUser.role,
      employeeId: id,
    });

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to transfer submissions.' },
      { status: 400 }
    );
  }
}
