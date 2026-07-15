import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { syncFollowUps } from '../../../../lib/server/services/followUps';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '../../../../lib/server/supabase';
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

type SubmissionStatusRow = {
  id: string;
  intake_status: string | null;
  closure_status: string | null;
};

type ReviewStatusRow = {
  id: string;
  status: string | null;
};

async function loadSubmissionStatusMeta(submissionIds: string[]) {
  if (submissionIds.length === 0) {
    return {
      submissionMap: new Map<string, SubmissionStatusRow>(),
      successorSet: new Set<string>(),
    };
  }

  const serviceClient = createServiceClient();
  const [{ data: submissions, error: submissionsError }, { data: successors, error: successorsError }] = await Promise.all([
    serviceClient
      .from('intake_submissions')
      .select('id, intake_status, closure_status')
      .in('id', submissionIds),
    serviceClient
      .from('intake_submissions')
      .select('previous_submission_id')
      .in('previous_submission_id', submissionIds),
  ]);

  if (submissionsError) throw new Error(submissionsError.message);
  if (successorsError) throw new Error(successorsError.message);

  return {
    submissionMap: new Map(
      ((submissions ?? []) as SubmissionStatusRow[]).map((row) => [String(row.id), row])
    ),
    successorSet: new Set(
      ((successors ?? []) as Array<{ previous_submission_id: string | null }>).flatMap((row) =>
        row.previous_submission_id ? [String(row.previous_submission_id)] : []
      )
    ),
  };
}

async function loadReviewStatusMap(reviewIds: string[]) {
  if (reviewIds.length === 0) {
    return new Map<string, ReviewStatusRow>();
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from('master_data_reviews')
    .select('id, status')
    .in('id', reviewIds);

  if (error) throw new Error(error.message);

  return new Map(((data ?? []) as ReviewStatusRow[]).map((row) => [String(row.id), row]));
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
    const adminClient = createServiceClient();
    await syncFollowUps(adminClient);
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
    const submissionIds = Array.from(new Set(items.flatMap((item) => (item.related_submission_id ? [String(item.related_submission_id)] : []))));
    const reviewIds = Array.from(new Set(items.flatMap((item) => (item.related_review_id ? [String(item.related_review_id)] : []))));
    const [{ submissionMap, successorSet }, reviewMap] = await Promise.all([
      loadSubmissionStatusMeta(submissionIds),
      loadReviewStatusMap(reviewIds),
    ]);

    const enrichedItems = items.map((item) => {
      const submission = item.related_submission_id ? submissionMap.get(String(item.related_submission_id)) : null;
      const review = item.related_review_id ? reviewMap.get(String(item.related_review_id)) : null;

      return {
        ...item,
        related_submission_status: submission?.intake_status ?? null,
        related_submission_closed_status: submission?.closure_status ?? null,
        related_review_status: review?.status ?? null,
        has_resubmission_successor: item.related_submission_id ? successorSet.has(String(item.related_submission_id)) : false,
      };
    });

    const hasMore = (data ?? []).length > limit;

    const { count, error: countError } = await userClient
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', appUser.id)
      .eq('is_read', false);

    if (countError) throw new Error(countError.message);

    return NextResponse.json({
      success: true,
      notifications: enrichedItems,
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
