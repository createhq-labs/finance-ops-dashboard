import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { assertSupabaseEnv, createUserScopedClient } from '../../../../lib/server/supabase';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';

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
    const limit = Number.parseInt(req.nextUrl.searchParams.get('limit') || '40', 10);

    const { data, error } = await userClient
      .from('notifications')
      .select('id, role_target, type, title, message, related_submission_id, related_review_id, target_path, is_read, created_at')
      .eq('user_id', appUser.id)
      .order('created_at', { ascending: false })
      .limit(Number.isNaN(limit) ? 40 : Math.min(Math.max(limit, 1), 100));

    if (error) throw new Error(error.message);

    const { count, error: countError } = await userClient
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', appUser.id)
      .eq('is_read', false);

    if (countError) throw new Error(countError.message);

    return NextResponse.json({
      success: true,
      notifications: data ?? [],
      unread_count: count ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load notifications.' },
      { status: 400 }
    );
  }
}
