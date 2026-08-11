import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';
import { canManageMasterData, getMasterDataReviewSummary, listMasterDataReviews, type MasterDataReviewStatus, type MasterDataReviewType } from '../../../../lib/server/services/masterDataReviewWorkflow';
import { assertSupabaseEnv, createUserScopedClient } from '../../../../lib/server/supabase';
import { createPerfTimer } from '../../../../lib/server/perf-timing';

const ALLOWED_STATUS = new Set<MasterDataReviewStatus | 'all'>(['pending', 'approved', 'rejected', 'all']);
const ALLOWED_TYPE = new Set<MasterDataReviewType | 'all'>(['agency', 'brand', 'creator', 'agency_gst_address', 'brand_gst_address', 'all']);

export async function GET(req: NextRequest) {
  const perf = createPerfTimer('master-data-reviews');
  perf.mark('START');
  try {
    assertSupabaseEnv();

    let token = '';
    try {
      token = getBearerToken(req);
    } catch {
      token = getAccessTokenFromCookieHeader(req.cookies) ?? '';
    }
    if (!token) throw new Error('Missing auth token');
    perf.log('request_parse_and_token');

    const userClient = createUserScopedClient(token);
    const appUser = await getCurrentAppUser(userClient, token);
    perf.log('auth_app_user_resolve');

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

    // Incremental sync mode: only active when `updated_after` is present and
    // a valid timestamp. Absent/invalid -> falls straight through to the
    // existing full-fetch behavior below, unchanged. The watermark can only
    // have come from a previous response's own rows, so a delta query can
    // never miss a row it hasn't already shown the caller. Delta mode always
    // returns every changed row regardless of status/type (see
    // listMasterDataReviews) - the caller is expected to already hold the
    // full set and re-apply its own status/type filtering after merging.
    const updatedAfterParam = req.nextUrl.searchParams.get('updated_after');
    const updatedAfter = updatedAfterParam && !Number.isNaN(new Date(updatedAfterParam).getTime()) ? updatedAfterParam : null;
    perf.mark(updatedAfter ? 'mode=delta' : 'mode=full');

    if (updatedAfter) {
      const [items, summary] = await Promise.all([
        listMasterDataReviews(userClient, { updatedAfter }, perf),
        // Summary is always derived fresh from the full table, never from
        // the delta set, so counters stay authoritative regardless of how
        // small/empty the delta is.
        getMasterDataReviewSummary(userClient),
      ]);
      perf.log('delta_items_and_summary_total');

      const response = NextResponse.json({ success: true, mode: 'delta', items, summary }, { status: 200 });
      perf.total();
      return response;
    }

    const allItems = await listMasterDataReviews(userClient, {}, perf);
    const items = allItems.filter((item) => {
      if (statusParam !== 'all' && item.status !== statusParam) return false;
      if (typeParam !== 'all' && item.type !== typeParam) return false;
      return true;
    });
    perf.log('status_type_filter');

    const summary = {
      total: allItems.length,
      pending: allItems.filter((item) => item.status === 'pending').length,
      approved: allItems.filter((item) => item.status === 'approved').length,
      rejected: allItems.filter((item) => item.status === 'rejected').length,
    };
    perf.log('summary_computation');

    const response = NextResponse.json({ success: true, mode: 'full', items, summary }, { status: 200 });
    perf.total();
    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load master data reviews.' },
      { status: 400 }
    );
  }
}
