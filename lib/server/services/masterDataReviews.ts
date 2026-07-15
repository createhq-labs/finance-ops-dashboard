import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppUser, SanitizedLineItemPayload, SanitizedSubmissionPayload } from '../types/submissions';

export type GstAddressReviewPayload = {
  entity_type: 'Agency' | 'Brand';
  entity_name: string;
  entity_trade_name: string | null;
  gst_number: string;
  address: string;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
};

type PendingReviewInsert = {
  type: 'agency' | 'brand' | 'creator' | 'agency_gst_address' | 'brand_gst_address';
  submitted_value: string;
  normalized_value: string;
  submitted_trade_name: string | null;
  created_from_submission_id: string;
  submitted_by: string;
  status: 'pending';
  payload: Record<string, unknown>;
};

type CreatedReviewSummary = {
  id: string;
  type: PendingReviewInsert['type'];
  submitted_value: string;
};

type ReviewFailureDetails = {
  success: false;
  created: 0;
  createdReviews: CreatedReviewSummary[];
  error: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

function normalizeMasterValue(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeGstNumber(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function asText(value: string | null | undefined) {
  const next = value?.trim() ?? '';
  return next.length > 0 ? next : null;
}

function buildGstReviewPayload(submissionPayload: SanitizedSubmissionPayload): GstAddressReviewPayload | null {
  const entityType = submissionPayload.entity_type === 'Agency' || submissionPayload.entity_type === 'Brand'
    ? submissionPayload.entity_type
    : null;
  const entityName = asText(submissionPayload.agency_brand_name);
  const gstNumber = normalizeGstNumber(submissionPayload.gst_number);
  const address = asText(submissionPayload.address);

  if (!entityType || !entityName || !gstNumber || !address) return null;

  return {
    entity_type: entityType,
    entity_name: entityName,
    entity_trade_name: asText(submissionPayload.agency_brand_trade_name),
    gst_number: gstNumber,
    address,
    city: asText(submissionPayload.city),
    state: asText(submissionPayload.state),
    country: asText(submissionPayload.country),
    pincode: asText(submissionPayload.pincode),
  };
}

function normalizeGstReviewField(value: string | null | undefined) {
  return normalizeMasterValue(String(value ?? ''));
}

function buildApprovedGstMappingKey(payload: GstAddressReviewPayload) {
  return [
    payload.entity_type.trim(),
    normalizeMasterValue(payload.entity_name),
    normalizeGstReviewField(payload.entity_trade_name),
    payload.gst_number,
    normalizeMasterValue(payload.address),
    normalizeGstReviewField(payload.city),
    normalizeGstReviewField(payload.state),
    normalizeGstReviewField(payload.country),
    normalizeGstReviewField(payload.pincode),
  ].join('::');
}

export async function createPendingMasterDataReviews(params: {
  userClient: SupabaseClient;
  appUser: AppUser;
  submissionId: string;
  submissionPayload: SanitizedSubmissionPayload;
  lineItemsPayload: SanitizedLineItemPayload[];
}) {
  const { userClient, appUser, submissionId, submissionPayload, lineItemsPayload } = params;
  const [agenciesRes, brandsRes, creatorsRes, gstMappingsRes] = await Promise.all([
    userClient.from('brands').select('agency_name').eq('is_active', true).not('agency_name', 'is', null),
    userClient.from('brands').select('brand_name').eq('is_active', true).not('brand_name', 'is', null),
    userClient.from('creators').select('name').eq('is_active', true),
    userClient.from('gst_address_mappings').select('entity_type, entity_name, entity_trade_name, gst_number, address, city, state, country, pincode').eq('is_active', true),
  ]);

  const errors = [agenciesRes.error, brandsRes.error, creatorsRes.error, gstMappingsRes.error].filter(Boolean);
  if (errors.length > 0) {
    return {
      success: false as const,
      created: 0,
      createdReviews: [] as CreatedReviewSummary[],
      error: errors.map((error) => error?.message).join(' | '),
      code: errors.map((error) => error?.code).filter(Boolean).join(' | ') || null,
      details: errors.map((error) => error?.details).filter(Boolean).join(' | ') || null,
      hint: errors.map((error) => error?.hint).filter(Boolean).join(' | ') || null,
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
  const approvedGstMappings = new Set(
    (gstMappingsRes.data ?? []).map((row) =>
      buildApprovedGstMappingKey({
        entity_type: String(row.entity_type ?? '').trim() as 'Agency' | 'Brand',
        entity_name: String(row.entity_name ?? '').trim(),
        entity_trade_name: asText(String(row.entity_trade_name ?? '')),
        gst_number: normalizeGstNumber(String(row.gst_number ?? '')),
        address: String(row.address ?? '').trim(),
        city: asText(String(row.city ?? '')),
        state: asText(String(row.state ?? '')),
        country: asText(String(row.country ?? '')),
        pincode: asText(String(row.pincode ?? '')),
      })
    )
  );

  const inserts: PendingReviewInsert[] = [];
  const seen = new Set<string>();

  function pushPendingReview(
    type: PendingReviewInsert['type'],
    submittedValue: string | null | undefined,
    normalizedValue: string,
    approved: boolean,
    submittedTradeName?: string | null,
    payload?: Record<string, unknown>
  ) {
    const value = asText(submittedValue);
    if (!value || approved) {
      return;
    }

    const dedupeKey = type + ':' + normalizedValue;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    inserts.push({
      type,
      submitted_value: value,
      normalized_value: normalizedValue,
      submitted_trade_name: asText(submittedTradeName),
      created_from_submission_id: submissionId,
      submitted_by: appUser.id,
      status: 'pending',
      payload: payload ?? {},
    });
  }

  if (submissionPayload.entity_type === 'Agency') {
    const normalized = normalizeMasterValue(String(submissionPayload.agency_name ?? ''));
    pushPendingReview(
      'agency',
      submissionPayload.agency_name,
      normalized,
      approvedAgencyNames.has(normalized),
      submissionPayload.agency_trade_name
    );
  }

  const normalizedSubmissionBrand = normalizeMasterValue(String(submissionPayload.brand_name ?? ''));
  pushPendingReview(
    'brand',
    submissionPayload.brand_name,
    normalizedSubmissionBrand,
    approvedBrandNames.has(normalizedSubmissionBrand),
    submissionPayload.brand_trade_name
  );

  for (const lineItem of lineItemsPayload) {
    const normalizedCreator = normalizeMasterValue(String(lineItem.creator_name ?? ''));
    pushPendingReview('creator', lineItem.creator_name, normalizedCreator, approvedCreatorNames.has(normalizedCreator));

    const normalizedBrand = normalizeMasterValue(String(lineItem.brand_name ?? ''));
    pushPendingReview('brand', lineItem.brand_name, normalizedBrand, approvedBrandNames.has(normalizedBrand));
  }

  const gstPayload = buildGstReviewPayload(submissionPayload);
  if (gstPayload) {
    const mappingKey = buildApprovedGstMappingKey(gstPayload);
    pushPendingReview(
      gstPayload.entity_type === 'Agency' ? 'agency_gst_address' : 'brand_gst_address',
      gstPayload.entity_name,
      mappingKey,
      approvedGstMappings.has(mappingKey),
      gstPayload.entity_trade_name,
      gstPayload
    );
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
    console.error('master_data_reviews existing pending lookup failed', {
      submissionId,
      candidateTypes,
      candidateValues,
      error: existingPendingRes.error,
    });
    return {
      success: false as const,
      created: 0,
      createdReviews: [] as CreatedReviewSummary[],
      error: existingPendingRes.error.message,
      code: existingPendingRes.error.code ?? null,
      details: existingPendingRes.error.details ?? null,
      hint: existingPendingRes.error.hint ?? null,
    };
  }

  const existingPendingKeys = new Set(
    (existingPendingRes.data ?? []).map((row) => String(row.type) + ':' + String(row.normalized_value))
  );

  const filteredInserts = inserts.filter((item) => !existingPendingKeys.has(item.type + ':' + item.normalized_value));
  if (filteredInserts.length === 0) {
    return { success: true as const, created: 0, createdReviews: [] as CreatedReviewSummary[] };
  }

  const createdReviews: CreatedReviewSummary[] = [];
  let skipped = 0;

  for (const item of filteredInserts) {
    const { data, error } = await userClient
      .from('master_data_reviews')
      .insert(item)
      .select('id, type, submitted_value')
      .single();

    if (error) {
      if (error.code === '23505') {
        console.info('Pending master review already exists, skipping duplicate creation', {
          submissionId,
          reviewType: item.type,
          normalizedValue: item.normalized_value,
        });
        skipped += 1;
        continue;
      }

      console.error('master_data_reviews insert failed', {
        submissionId,
        reviewType: item.type,
        payloadKeys: item.payload ? Object.keys(item.payload) : [],
        error,
      });

      return {
        success: false as const,
        created: 0,
        createdReviews: [] as CreatedReviewSummary[],
        error: error.message,
        code: error.code ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
      };
    }

    if (data) {
      createdReviews.push(data as CreatedReviewSummary);
    }
  }

  return {
    success: true as const,
    created: createdReviews.length,
    skipped,
    createdReviews,
  };
}
