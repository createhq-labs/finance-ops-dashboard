import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '@/lib/server/auth';
import { getAccessTokenFromCookieHeader } from '@/lib/server/services/authCookies';
import { canManageUsers, resetDashboardUserPassword } from '@/lib/server/services/users';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '@/lib/server/supabase';

function resolveToken(req: NextRequest) {
  try {
    return getBearerToken(req);
  } catch {
    return getAccessTokenFromCookieHeader(req.cookies) ?? '';
  }
}

export async function POST(
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
    const serviceClient = createServiceClient();
    const result = await resetDashboardUserPassword(serviceClient, appUser, id);

    return NextResponse.json(
      {
        success: true,
        user: result.user,
        temporary_password: result.temporaryPassword,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to reset password.' },
      { status: 400 }
    );
  }
}
