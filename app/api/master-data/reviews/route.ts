import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';
import { canManageMasterData, listMasterDataReviews, type MasterDataReviewStatus, type MasterDataReviewType } from '../../../../lib/server/services/masterDataReviewWorkflow';
import { assertSupabaseEnv, createUserScopedClient } from '../../../../lib/server/supabase';

const ALLOWED_STATUS = new Set<MasterDataReviewStatus | 'all'>(['pending', 'approved', 'rejected', 'all']);
const ALLOWED_TYPE = new Set<MasterDataReviewType | 'all'>(['agency', 'brand', 'creator', 'all']);

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

    if (!canManageMasterData(appUser.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const statusParam = (req.nextUrl.searchParams.get('status') || 'all') as MasterDataReviewStatus | 'all';
    const typeParam = (req.nextUrl.searchParams.get('type') || 'all') as MasterDataReviewType | 'all';

    if (!ALLOWED_STATUS.has(statusParam)) {
      return NextResponse.json({ success: false, error: 'Invalid status filter.' }, { status: 400 });
    }

    if (!ALLOWED_TYPE.has(typeParam)) {
      return NextResponse.json({ success: false, error: 'Invalid type filter.' }, { status: 400 });
    }

    const allItems = await listMasterDataReviews(userClient);
    const items = allItems.filter((item) => {
      if (statusParam !== 'all' && item.status !== statusParam) return false;
      if (typeParam !== 'all' && item.type !== typeParam) return false;
      return true;
    });

    const summary = {
      total: allItems.length,
      pending: allItems.filter((item) => item.status === 'pending').length,
      approved: allItems.filter((item) => item.status === 'approved').length,
      rejected: allItems.filter((item) => item.status === 'rejected').length,
    };

    return NextResponse.json({ success: true, items, summary }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load master data reviews.' },
      { status: 400 }
    );
  }
}
