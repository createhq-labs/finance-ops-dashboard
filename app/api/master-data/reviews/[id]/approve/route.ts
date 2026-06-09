import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../../../lib/server/auth';
import { getAccessTokenFromCookieHeader } from '../../../../../../lib/server/services/authCookies';
import { approveMasterDataReview, canManageMasterData } from '../../../../../../lib/server/services/masterDataReviewWorkflow';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '../../../../../../lib/server/supabase';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSupabaseEnv();

    let token = '';
    try {
      token = getBearerToken(req);
    } catch {
      token = getAccessTokenFromCookieHeader(req.cookies) ?? '';
    }
    if (!token) throw new Error('Missing auth token');

    const { id } = await context.params;
    if (!id) throw new Error('Review id is required.');

    const userClient = createUserScopedClient(token);
    const appUser = await getCurrentAppUser(userClient, token);

    if (!canManageMasterData(appUser.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const adminClient = createServiceClient();
    const result = await approveMasterDataReview({ adminClient, appUser, reviewId: id });

    return NextResponse.json({ success: true, review: result.review, source_result: result.sourceResult }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to approve review.' },
      { status: 400 }
    );
  }
}
