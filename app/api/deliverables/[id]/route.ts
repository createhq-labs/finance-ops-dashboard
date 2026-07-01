import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '@/lib/server/auth';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '@/lib/server/supabase';
import { getAccessTokenFromCookieHeader } from '@/lib/server/services/authCookies';
import { canManageDeliverables, updateDeliverable } from '@/lib/server/services/deliverables';

function resolveToken(req: NextRequest) {
  try {
    return getBearerToken(req);
  } catch {
    return getAccessTokenFromCookieHeader(req.cookies) ?? '';
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSupabaseEnv();
    const token = resolveToken(req);
    if (!token) throw new Error('Missing auth token');

    const userClient = createUserScopedClient(token);
    const appUser = await getCurrentAppUser(userClient, token);
    if (!canManageDeliverables(appUser.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const serviceClient = createServiceClient();
    const item = await updateDeliverable(serviceClient, appUser.id, id, body ?? {});

    return NextResponse.json({ success: true, item }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update deliverable.' },
      { status: 400 }
    );
  }
}

