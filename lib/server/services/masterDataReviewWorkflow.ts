import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole, AppUser } from '../types/submissions';
import { logActivityEvent } from './activityLog';

export type MasterDataReviewType = 'agency' | 'brand' | 'creator';
export type MasterDataReviewStatus = 'pending' | 'approved' | 'rejected';

type UserSummary = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type BrandSourceRecord = {
  id: string;
  name: string | null;
  agency_name: string | null;
  agency_trade_name: string | null;
  brand_name: string | null;
  brand_trade_name: string | null;
};

type CreatorSourceRecord = {
  id: string;
  name: string | null;
};

export type MasterDataReviewRecord = {
  id: string;
  type: MasterDataReviewType;
  submitted_value: string;
  normalized_value: string;
  submitted_trade_name: string | null;
  status: MasterDataReviewStatus;
  created_from_submission_id: string | null;
  submitted_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  last_edited_by: string | null;
  last_edited_at: string | null;
  edit_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type MasterDataReviewListItem = MasterDataReviewRecord & {
  submitted_by_name: string | null;
  submitted_by_email: string | null;
  reviewed_by_name: string | null;
  reviewed_by_email: string | null;
  last_edited_by_name: string | null;
  last_edited_by_email: string | null;
  submission_pi: string | null;
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function cleanText(value: string | null | undefined) {
  const next = value?.trim() ?? '';
  return next.length > 0 ? next : null;
}

function isDuplicateInsertError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) return false;
  return error.code === '23505' || /duplicate key/i.test(error.message ?? '');
}

function asUserMap(users: UserSummary[]) {
  return new Map(
    users.map((row) => [
      String(row.id),
      {
        full_name: row.full_name ?? null,
        email: row.email ?? null,
      },
    ])
  );
}

function mapReviewRow(row: MasterDataReviewRecord, userMap: Map<string, { full_name: string | null; email: string | null }>, submissionMap: Map<string, string | null>): MasterDataReviewListItem {
  return {
    ...row,
    submitted_by_name: userMap.get(row.submitted_by)?.full_name ?? null,
    submitted_by_email: userMap.get(row.submitted_by)?.email ?? null,
    reviewed_by_name: row.reviewed_by ? userMap.get(row.reviewed_by)?.full_name ?? null : null,
    reviewed_by_email: row.reviewed_by ? userMap.get(row.reviewed_by)?.email ?? null : null,
    last_edited_by_name: row.last_edited_by ? userMap.get(row.last_edited_by)?.full_name ?? null : null,
    last_edited_by_email: row.last_edited_by ? userMap.get(row.last_edited_by)?.email ?? null : null,
    submission_pi: row.created_from_submission_id ? submissionMap.get(row.created_from_submission_id) ?? null : null,
  };
}

export function canManageMasterData(role: AppRole) {
  return role === 'finance' || role === 'admin' || role === 'developer';
}

async function fetchReviewRecord(adminClient: SupabaseClient, reviewId: string) {
  const { data, error } = await adminClient
    .from('master_data_reviews')
    .select('id, type, submitted_value, normalized_value, submitted_trade_name, status, created_from_submission_id, submitted_by, reviewed_by, reviewed_at, rejection_reason, last_edited_by, last_edited_at, edit_reason, created_at, updated_at')
    .eq('id', reviewId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Review not found.');
  }

  return data as MasterDataReviewRecord;
}

export async function listMasterDataReviews(userClient: SupabaseClient): Promise<MasterDataReviewListItem[]> {
  const { data, error } = await userClient
    .from('master_data_reviews')
    .select('id, type, submitted_value, normalized_value, submitted_trade_name, status, created_from_submission_id, submitted_by, reviewed_by, reviewed_at, rejection_reason, last_edited_by, last_edited_at, edit_reason, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as MasterDataReviewRecord[];
  const userIds = Array.from(
    new Set(
      rows.flatMap((row) => [row.submitted_by, row.reviewed_by, row.last_edited_by]).filter(Boolean)
    )
  ) as string[];
  const submissionIds = Array.from(new Set(rows.map((row) => row.created_from_submission_id).filter(Boolean))) as string[];

  const [usersRes, submissionsRes] = await Promise.all([
    userIds.length > 0
      ? userClient.from('users').select('id, full_name, email').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    submissionIds.length > 0
      ? userClient.from('intake_submissions').select('id, proforma_invoice').in('id', submissionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (usersRes.error) {
    throw new Error(usersRes.error.message);
  }

  if (submissionsRes.error) {
    throw new Error(submissionsRes.error.message);
  }

  const userMap = asUserMap((usersRes.data ?? []) as UserSummary[]);
  const submissionMap = new Map(
    ((submissionsRes.data ?? []) as Array<{ id: string; proforma_invoice: string | null }>).map((row) => [
      String(row.id),
      row.proforma_invoice ?? null,
    ])
  );

  return rows.map((row) => mapReviewRow(row, userMap, submissionMap));
}

async function loadActiveBrandRows(adminClient: SupabaseClient) {
  const { data, error } = await adminClient
    .from('brands')
    .select('id, name, agency_name, agency_trade_name, brand_name, brand_trade_name')
    .eq('is_active', true);

  if (error) throw new Error(error.message);
  return (data ?? []) as BrandSourceRecord[];
}

async function loadActiveCreatorRows(adminClient: SupabaseClient) {
  const { data, error } = await adminClient
    .from('creators')
    .select('id, name')
    .eq('is_active', true);

  if (error) throw new Error(error.message);
  return (data ?? []) as CreatorSourceRecord[];
}

function findAgencyRow(rows: BrandSourceRecord[], normalizedValue: string, excludeId?: string) {
  return rows.find((row) => {
    if (excludeId && row.id === excludeId) return false;
    return [row.name, row.agency_name].some((value) => value && normalizeText(value) === normalizedValue);
  }) ?? null;
}

function findBrandRow(rows: BrandSourceRecord[], normalizedValue: string, excludeId?: string) {
  return rows.find((row) => {
    if (excludeId && row.id === excludeId) return false;
    return [row.name, row.brand_name].some((value) => value && normalizeText(value) === normalizedValue);
  }) ?? null;
}

function findCreatorRow(rows: CreatorSourceRecord[], normalizedValue: string, excludeId?: string) {
  return rows.find((row) => {
    if (excludeId && row.id === excludeId) return false;
    return row.name ? normalizeText(row.name) === normalizedValue : false;
  }) ?? null;
}

async function checkExistingAgency(adminClient: SupabaseClient, normalizedValue: string) {
  const rows = await loadActiveBrandRows(adminClient);
  return findAgencyRow(rows, normalizedValue);
}

async function checkExistingBrand(adminClient: SupabaseClient, normalizedValue: string) {
  const rows = await loadActiveBrandRows(adminClient);
  return findBrandRow(rows, normalizedValue);
}

async function checkExistingCreator(adminClient: SupabaseClient, normalizedValue: string) {
  const rows = await loadActiveCreatorRows(adminClient);
  return findCreatorRow(rows, normalizedValue);
}

async function findSourceRowForApprovedReview(adminClient: SupabaseClient, review: MasterDataReviewRecord) {
  if (review.type === 'creator') {
    const rows = await loadActiveCreatorRows(adminClient);
    return findCreatorRow(rows, review.normalized_value);
  }

  const rows = await loadActiveBrandRows(adminClient);
  return review.type === 'agency'
    ? findAgencyRow(rows, review.normalized_value)
    : findBrandRow(rows, review.normalized_value);
}

async function promoteAgencyReview(adminClient: SupabaseClient, appUser: AppUser, review: MasterDataReviewRecord) {
  const existing = await checkExistingAgency(adminClient, review.normalized_value);
  if (existing) return { outcome: 'matched_existing' as const, sourceId: existing.id };

  const insertPayload = {
    name: review.submitted_value,
    agency_name: review.submitted_value,
    agency_trade_name: cleanText(review.submitted_trade_name),
    is_active: true,
    created_by: appUser.id,
    updated_by: appUser.id,
  };

  const { data, error } = await adminClient.from('brands').insert(insertPayload).select('id').single();

  if (error) {
    if (isDuplicateInsertError(error)) {
      const matched = await checkExistingAgency(adminClient, review.normalized_value);
      if (matched) return { outcome: 'matched_existing' as const, sourceId: matched.id };
    }
    throw new Error(error.message);
  }

  return { outcome: 'inserted' as const, sourceId: String(data.id) };
}

async function promoteBrandReview(adminClient: SupabaseClient, appUser: AppUser, review: MasterDataReviewRecord) {
  const existing = await checkExistingBrand(adminClient, review.normalized_value);
  if (existing) return { outcome: 'matched_existing' as const, sourceId: existing.id };

  const insertPayload = {
    name: review.submitted_value,
    brand_name: review.submitted_value,
    brand_trade_name: cleanText(review.submitted_trade_name),
    is_active: true,
    created_by: appUser.id,
    updated_by: appUser.id,
  };

  const { data, error } = await adminClient.from('brands').insert(insertPayload).select('id').single();

  if (error) {
    if (isDuplicateInsertError(error)) {
      const matched = await checkExistingBrand(adminClient, review.normalized_value);
      if (matched) return { outcome: 'matched_existing' as const, sourceId: matched.id };
    }
    throw new Error(error.message);
  }

  return { outcome: 'inserted' as const, sourceId: String(data.id) };
}

async function promoteCreatorReview(adminClient: SupabaseClient, appUser: AppUser, review: MasterDataReviewRecord) {
  const existing = await checkExistingCreator(adminClient, review.normalized_value);
  if (existing) return { outcome: 'matched_existing' as const, sourceId: existing.id };

  const insertPayload = {
    name: review.submitted_value,
    brand_id: null,
    is_active: true,
    created_by: appUser.id,
  };

  const { data, error } = await adminClient.from('creators').insert(insertPayload).select('id').single();

  if (error) {
    if (isDuplicateInsertError(error)) {
      const matched = await checkExistingCreator(adminClient, review.normalized_value);
      if (matched) return { outcome: 'matched_existing' as const, sourceId: matched.id };
    }
    throw new Error(error.message);
  }

  return { outcome: 'inserted' as const, sourceId: String(data.id) };
}

async function promoteReviewToSourceTable(adminClient: SupabaseClient, appUser: AppUser, review: MasterDataReviewRecord) {
  if (review.type === 'agency') return promoteAgencyReview(adminClient, appUser, review);
  if (review.type === 'brand') return promoteBrandReview(adminClient, appUser, review);
  return promoteCreatorReview(adminClient, appUser, review);
}

export async function approveMasterDataReview(params: {
  adminClient: SupabaseClient;
  appUser: AppUser;
  reviewId: string;
}) {
  const { adminClient, appUser, reviewId } = params;
  const review = await fetchReviewRecord(adminClient, reviewId);

  if (review.status !== 'pending') {
    throw new Error('Only pending reviews can be approved.');
  }

  const sourceResult = await promoteReviewToSourceTable(adminClient, appUser, review);
  const reviewedAt = new Date().toISOString();

  const { data: updated, error: updateError } = await adminClient
    .from('master_data_reviews')
    .update({
      status: 'approved',
      reviewed_by: appUser.id,
      reviewed_at: reviewedAt,
      rejection_reason: null,
      updated_at: reviewedAt,
    })
    .eq('id', reviewId)
    .eq('status', 'pending')
    .select('id, type, submitted_value, normalized_value, submitted_trade_name, status, created_from_submission_id, submitted_by, reviewed_by, reviewed_at, rejection_reason, last_edited_by, last_edited_at, edit_reason, created_at, updated_at')
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message || 'Failed to mark review approved.');
  }

  await logActivityEvent(adminClient, {
    actorUserId: appUser.id,
    action: 'master_data_approved',
    details: {
      message: `Master data ${review.submitted_value} was approved.`,
      review_type: review.type,
      submitted_value: review.submitted_value,
      source_result: sourceResult,
    },
    submissionId: review.created_from_submission_id ?? null,
    structured: {
      action_type: 'master_data_approved',
      from_status: review.status,
      to_status: 'approved',
      entity_type: 'master_data_review',
      entity_id: review.id,
      metadata: {
        review_type: review.type,
        submitted_value: review.submitted_value,
        normalized_value: review.normalized_value,
        source_result: sourceResult,
        created_from_submission_id: review.created_from_submission_id,
        financial_year: null,
        module: 'master_data',
      },
    },
  });

  return {
    review: updated as MasterDataReviewRecord,
    sourceResult,
  };
}

export async function rejectMasterDataReview(params: {
  adminClient: SupabaseClient;
  appUser: AppUser;
  reviewId: string;
  rejectionReason?: string | null;
}) {
  const { adminClient, appUser, reviewId, rejectionReason } = params;
  const review = await fetchReviewRecord(adminClient, reviewId);

  if (review.status !== 'pending') {
    throw new Error('Only pending reviews can be ignored.');
  }

  const reviewedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await adminClient
    .from('master_data_reviews')
    .update({
      status: 'rejected',
      reviewed_by: appUser.id,
      reviewed_at: reviewedAt,
      rejection_reason: cleanText(rejectionReason) ?? 'Ignored by finance',
      updated_at: reviewedAt,
    })
    .eq('id', reviewId)
    .eq('status', 'pending')
    .select('id, type, submitted_value, normalized_value, submitted_trade_name, status, created_from_submission_id, submitted_by, reviewed_by, reviewed_at, rejection_reason, last_edited_by, last_edited_at, edit_reason, created_at, updated_at')
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message || 'Failed to ignore review.');
  }

  await logActivityEvent(adminClient, {
    actorUserId: appUser.id,
    action: 'master_data_ignored',
    details: {
      message: `Master data ${review.submitted_value} was ignored.`,
      review_type: review.type,
      submitted_value: review.submitted_value,
      rejection_reason: updated.rejection_reason,
    },
    submissionId: review.created_from_submission_id ?? null,
    structured: {
      action_type: 'master_data_ignored',
      from_status: review.status,
      to_status: 'rejected',
      entity_type: 'master_data_review',
      entity_id: review.id,
      metadata: {
        review_type: review.type,
        submitted_value: review.submitted_value,
        rejection_reason: updated.rejection_reason,
        created_from_submission_id: review.created_from_submission_id,
        financial_year: null,
        module: 'master_data',
      },
    },
  });


  return updated as MasterDataReviewRecord;
}

export async function editApprovedMasterDataReview(params: {
  adminClient: SupabaseClient;
  appUser: AppUser;
  reviewId: string;
  submittedValue: string;
  submittedTradeName?: string | null;
  editReason: string;
}) {
  const { adminClient, appUser, reviewId, submittedValue, submittedTradeName, editReason } = params;

  const review = await fetchReviewRecord(adminClient, reviewId);
  if (review.status !== 'approved') {
    throw new Error('Only approved reviews can be edited.');
  }

  const nextValue = cleanText(submittedValue);
  if (!nextValue) {
    throw new Error('Value is required.');
  }

  const nextTradeName = review.type === 'creator' ? null : cleanText(submittedTradeName);
  const nextEditReason = cleanText(editReason);
  if (!nextEditReason) {
    throw new Error('Edit reason is required.');
  }

  const nextNormalizedValue = normalizeText(nextValue);
  const currentSource = await findSourceRowForApprovedReview(adminClient, review);
  if (!currentSource) {
    throw new Error('Approved source record could not be resolved for this review.');
  }

  if (review.type === 'agency') {
    const rows = await loadActiveBrandRows(adminClient);
    const duplicate = findAgencyRow(rows, nextNormalizedValue, currentSource.id);
    if (duplicate) {
      throw new Error('An active master data value already exists with this name.');
    }

    const { error } = await adminClient
      .from('brands')
      .update({
        name: nextValue,
        agency_name: nextValue,
        agency_trade_name: nextTradeName,
        updated_by: appUser.id,
      })
      .eq('id', currentSource.id);

    if (error) {
      if (isDuplicateInsertError(error)) {
        const retryRows = await loadActiveBrandRows(adminClient);
        if (findAgencyRow(retryRows, nextNormalizedValue, currentSource.id)) {
          throw new Error('An active master data value already exists with this name.');
        }
      }
      throw new Error(error.message);
    }
  } else if (review.type === 'brand') {
    const rows = await loadActiveBrandRows(adminClient);
    const duplicate = findBrandRow(rows, nextNormalizedValue, currentSource.id);
    if (duplicate) {
      throw new Error('An active master data value already exists with this name.');
    }

    const { error } = await adminClient
      .from('brands')
      .update({
        name: nextValue,
        brand_name: nextValue,
        brand_trade_name: nextTradeName,
        updated_by: appUser.id,
      })
      .eq('id', currentSource.id);

    if (error) {
      if (isDuplicateInsertError(error)) {
        const retryRows = await loadActiveBrandRows(adminClient);
        if (findBrandRow(retryRows, nextNormalizedValue, currentSource.id)) {
          throw new Error('An active master data value already exists with this name.');
        }
      }
      throw new Error(error.message);
    }
  } else {
    const rows = await loadActiveCreatorRows(adminClient);
    const duplicate = findCreatorRow(rows, nextNormalizedValue, currentSource.id);
    if (duplicate) {
      throw new Error('An active master data value already exists with this name.');
    }

    const { error } = await adminClient
      .from('creators')
      .update({
        name: nextValue,
      })
      .eq('id', currentSource.id);

    if (error) {
      if (isDuplicateInsertError(error)) {
        const retryRows = await loadActiveCreatorRows(adminClient);
        if (findCreatorRow(retryRows, nextNormalizedValue, currentSource.id)) {
          throw new Error('An active master data value already exists with this name.');
        }
      }
      throw new Error(error.message);
    }
  }

  const editedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await adminClient
    .from('master_data_reviews')
    .update({
      submitted_value: nextValue,
      normalized_value: nextNormalizedValue,
      submitted_trade_name: nextTradeName,
      last_edited_by: appUser.id,
      last_edited_at: editedAt,
      edit_reason: nextEditReason,
      updated_at: editedAt,
    })
    .eq('id', reviewId)
    .eq('status', 'approved')
    .select('id, type, submitted_value, normalized_value, submitted_trade_name, status, created_from_submission_id, submitted_by, reviewed_by, reviewed_at, rejection_reason, last_edited_by, last_edited_at, edit_reason, created_at, updated_at')
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message || 'Failed to audit master data edit.');
  }

  await logActivityEvent(adminClient, {
    actorUserId: appUser.id,
    action: 'master_data_edited',
    details: {
      message: `Master data ${review.submitted_value} was edited.`,
      review_type: review.type,
      old_value: {
        submitted_value: review.submitted_value,
        submitted_trade_name: review.submitted_trade_name,
      },
      new_value: {
        submitted_value: nextValue,
        submitted_trade_name: nextTradeName,
      },
      edit_reason: nextEditReason,
    },
    submissionId: review.created_from_submission_id ?? null,
    structured: {
      action_type: 'master_data_edited',
      entity_type: 'master_data_review',
      entity_id: review.id,
      metadata: {
        review_type: review.type,
        old_value: {
          submitted_value: review.submitted_value,
          submitted_trade_name: review.submitted_trade_name,
        },
        new_value: {
          submitted_value: nextValue,
          submitted_trade_name: nextTradeName,
        },
        edit_reason: nextEditReason,
        created_from_submission_id: review.created_from_submission_id,
        financial_year: null,
        module: 'master_data',
      },
    },
  });

  return updated as MasterDataReviewRecord;
}