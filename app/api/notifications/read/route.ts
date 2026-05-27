import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { assertSupabaseEnv, createUserScopedClient } from '../../../../lib/server/supabase';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';

export async function POST(req: NextRequest) {
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
    const body = (await req.json().catch(() => ({}))) as { id?: string; mark_all?: boolean };

    if (body.mark_all) {
      const { error } = await userClient
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', appUser.id)
        .eq('is_read', false);

      if (error) throw new Error(error.message);

      return NextResponse.json({ success: true });
    }

    if (!body.id) throw new Error('Notification id is required.');

    const { error } = await userClient
      .from('notifications')
      .update({ is_read: true })
      .eq('id', body.id)
      .eq('user_id', appUser.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update notification.' },
      { status: 400 }
    );
  }
}
