import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '@/lib/server/auth';
import { getAccessTokenFromCookieHeader } from '@/lib/server/services/authCookies';
import { canManageUsers, updateDashboardUser } from '@/lib/server/services/users';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '@/lib/server/supabase';

function resolveToken(req: NextRequest) {
  try {
    return getBearerToken(req);
  } catch {
    return getAccessTokenFromCookieHeader(req.cookies) ?? '';
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSupabaseEnv();
    const token = resolveToken(req);
    if (!token) throw new Error('Missing auth token');

    const userClient = createUserScopedClient(token);
    const appUser = await getCurrentAppUser(userClient, token);

    if (!canManageUsers(appUser.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const serviceClient = createServiceClient();
    const user = await updateDashboardUser(serviceClient, appUser, id, body ?? {});

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update user.' },
      { status: 400 }
    );
  }
}
