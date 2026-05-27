import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppUser, SanitizedLineItemPayload, SanitizedSubmissionPayload } from '../types/submissions';

type PendingReviewInsert = {
  type: 'agency' | 'brand' | 'creator';
  submitted_value: string;
  normalized_value: string;
  submitted_trade_name: string | null;
  created_from_submission_id: string;
  submitted_by: string;
  status: 'pending';
};

type CreatedReviewSummary = {
  id: string;
  type: 'agency' | 'brand' | 'creator';
  submitted_value: string;
};

function normalizeMasterValue(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function asText(value: string | null | undefined) {
  const next = value?.trim() ?? '';
  return next.length > 0 ? next : null;
}

export async function createPendingMasterDataReviews(params: {
  userClient: SupabaseClient;
  appUser: AppUser;
  submissionId: string;
  submissionPayload: SanitizedSubmissionPayload;
  lineItemsPayload: SanitizedLineItemPayload[];
}) {
  const { userClient, appUser, submissionId, submissionPayload, lineItemsPayload } = params;

  const [agenciesRes, brandsRes, creatorsRes] = await Promise.all([
    userClient.from('brands').select('agency_name').eq('is_active', true).not('agency_name', 'is', null),
    userClient.from('brands').select('brand_name').eq('is_active', true).not('brand_name', 'is', null),
    userClient.from('creators').select('name').eq('is_active', true),
  ]);

  const errors = [agenciesRes.error, brandsRes.error, creatorsRes.error].filter(Boolean);
  if (errors.length > 0) {
    return {
      success: false as const,
      created: 0,
      error: errors.map((error) => error?.message).join(' | '),
    };
  }

  const approvedAgencyNames = new Set(
    (agenciesRes.data ?? [])
      .map((row) => normalizeMasterValue(String(row.agency_name ?? '')))
      .filter(Boolean)
  );
  const approvedBrandNames = new Set(
    (brandsRes.data ?? [])
      .map((row) => normalizeMasterValue(String(row.brand_name ?? '')))
      .filter(Boolean)
  );
  const approvedCreatorNames = new Set(
    (creatorsRes.data ?? [])
      .map((row) => normalizeMasterValue(String(row.name ?? '')))
      .filter(Boolean)
  );

  const inserts: PendingReviewInsert[] = [];
  const seen = new Set<string>();

  function pushPendingReview(
    type: PendingReviewInsert['type'],
    submittedValue: string | null | undefined,
    approvedSet: Set<string>,
    submittedTradeName?: string | null
  ) {
    const value = asText(submittedValue);
    if (!value) return;
    const normalized = normalizeMasterValue(value);
    if (!normalized || approvedSet.has(normalized)) return;

    const dedupeKey = `${type}:${normalized}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    inserts.push({
      type,
      submitted_value: value,
      normalized_value: normalized,
      submitted_trade_name: asText(submittedTradeName),
      created_from_submission_id: submissionId,
      submitted_by: appUser.id,
      status: 'pending',
    });
  }

  if (submissionPayload.entity_type === 'Agency') {
    pushPendingReview('agency', submissionPayload.agency_name, approvedAgencyNames, submissionPayload.agency_trade_name);
  }

  pushPendingReview('brand', submissionPayload.brand_name, approvedBrandNames, submissionPayload.brand_trade_name);

  for (const lineItem of lineItemsPayload) {
    pushPendingReview('creator', lineItem.creator_name, approvedCreatorNames);
    pushPendingReview('brand', lineItem.brand_name, approvedBrandNames);
  }

  if (inserts.length === 0) {
    return { success: true as const, created: 0, createdReviews: [] as CreatedReviewSummary[] };
  }

  const candidateTypes = Array.from(new Set(inserts.map((item) => item.type)));
  const candidateValues = Array.from(new Set(inserts.map((item) => item.normalized_value)));
  const existingPendingRes = await userClient
    .from('master_data_reviews')
    .select('type, normalized_value')
    .eq('status', 'pending')
    .in('type', candidateTypes)
    .in('normalized_value', candidateValues);

  if (existingPendingRes.error) {
    return {
      success: false as const,
      created: 0,
      createdReviews: [] as CreatedReviewSummary[],
      error: existingPendingRes.error.message,
    };
  }

  const existingPendingKeys = new Set(
    (existingPendingRes.data ?? []).map((row) => `${row.type}:${row.normalized_value}`)
  );

  const filteredInserts = inserts.filter((item) => !existingPendingKeys.has(`${item.type}:${item.normalized_value}`));
  if (filteredInserts.length === 0) {
    return { success: true as const, created: 0, createdReviews: [] as CreatedReviewSummary[] };
  }

  const { data, error } = await userClient
    .from('master_data_reviews')
    .insert(filteredInserts)
    .select('id, type, submitted_value');

  if (error) {
    if (error.code === '23505') {
      return { success: true as const, created: 0, createdReviews: [] as CreatedReviewSummary[] };
    }

    return {
      success: false as const,
      created: 0,
      createdReviews: [] as CreatedReviewSummary[],
      error: error.message,
    };
  }

  return {
    success: true as const,
    created: filteredInserts.length,
    createdReviews: (data ?? []) as CreatedReviewSummary[],
  };
}
