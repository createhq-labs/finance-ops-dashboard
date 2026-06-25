import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '@/lib/server/auth';
import { getAccessTokenFromCookieHeader } from '@/lib/server/services/authCookies';
import {
  canManageUsers,
  createDashboardUser,
  isKnownRole,
  isKnownStatus,
  listUsers,
} from '@/lib/server/services/users';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '@/lib/server/supabase';
import type { AppRole, BusinessLine } from '@/lib/server/types/submissions';

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

    if (!canManageUsers(appUser.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const search = req.nextUrl.searchParams.get('search') || '';
    const roleParam = req.nextUrl.searchParams.get('role') || 'all';
    const statusParam = req.nextUrl.searchParams.get('status') || 'all';
    const businessLineParam = req.nextUrl.searchParams.get('business_line') || 'all';

    if (roleParam !== 'all' && !isKnownRole(roleParam)) {
      return NextResponse.json({ success: false, error: 'Invalid role filter.' }, { status: 400 });
    }
    if (statusParam !== 'all' && !isKnownStatus(statusParam)) {
      return NextResponse.json({ success: false, error: 'Invalid status filter.' }, { status: 400 });
    }
    if (businessLineParam !== 'all' && businessLineParam !== 'IM' && businessLineParam !== 'TM') {
      return NextResponse.json({ success: false, error: 'Invalid business line filter.' }, { status: 400 });
    }

    const users = await listUsers(userClient, {
      search,
      role: (roleParam === 'all' ? 'all' : roleParam) as 'all' | AppRole,
      status: (statusParam === 'all' ? 'all' : statusParam) as 'all' | 'active' | 'inactive',
      businessLine: (businessLineParam === 'all' ? 'all' : businessLineParam) as 'all' | BusinessLine,
    });

    return NextResponse.json({ success: true, users }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load users.' },
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

    if (!canManageUsers(appUser.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const serviceClient = createServiceClient();
    const result = await createDashboardUser(serviceClient, appUser, body ?? {});

    return NextResponse.json(
      {
        success: true,
        user: result.user,
        temporary_password: result.temporaryPassword,
        delivery_method: result.deliveryMethod,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create user.' },
      { status: 400 }
    );
  }
}
