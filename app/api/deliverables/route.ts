import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '@/lib/server/auth';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '@/lib/server/supabase';
import { getAccessTokenFromCookieHeader } from '@/lib/server/services/authCookies';
import { canManageDeliverables, createDeliverable, listDeliverables } from '@/lib/server/services/deliverables';

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
    if (!canManageDeliverables(appUser.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const items = await listDeliverables(userClient);
    return NextResponse.json({ success: true, items }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load deliverables.' },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSupabaseEnv();
    const token = resolveToken(req);
    if (!token) throw new Error('Missing auth token');

    const userClient = createUserScopedClient(token);
    const appUser = await getCurrentAppUser(userClient, token);
    if (!canManageDeliverables(appUser.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const serviceClient = createServiceClient();
    const body = await req.json().catch(() => ({}));
    const item = await createDeliverable(serviceClient, appUser.id, body ?? {});

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create deliverable.' },
      { status: 400 }
    );
  }
}

