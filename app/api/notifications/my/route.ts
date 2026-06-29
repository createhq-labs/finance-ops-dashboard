import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { assertSupabaseEnv, createUserScopedClient } from '../../../../lib/server/supabase';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';

function clampLimit(value: string | null, fallback: number) {
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
    const appUser = await getCurrentAppUser(userClient, token);
    const limit = clampLimit(req.nextUrl.searchParams.get('limit'), 40);
    const offset = parseOffset(req.nextUrl.searchParams.get('offset'));

    const { data, error } = await userClient
      .from('notifications')
      .select('id, role_target, type, title, message, related_submission_id, related_review_id, target_path, is_read, created_at')
      .eq('user_id', appUser.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (error) throw new Error(error.message);

    const items = (data ?? []).slice(0, limit);
    const hasMore = (data ?? []).length > limit;

    const { count, error: countError } = await userClient
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', appUser.id)
      .eq('is_read', false);

    if (countError) throw new Error(countError.message);

    return NextResponse.json({
      success: true,
      notifications: items,
      unread_count: count ?? 0,
      has_more: hasMore,
      next_offset: hasMore ? offset + limit : null,
      offset,
      limit,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load notifications.' },
      { status: 400 }
    );
  }
}
