import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '../../../../lib/server/supabase';
import { logActivityEvent, logSubmissionCreated } from '../../../../lib/server/services/activityLog';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';
import { createPendingMasterDataReviews } from '../../../../lib/server/services/masterDataReviews';
import { createFinanceAndAdminSubmissionNotifications, createPendingMasterReviewNotifications } from '../../../../lib/server/services/notifications';
import {
  createSubmissionWithLineItems,
  findExistingPiInSubmissionChain,
  shouldSkipPiGeneration,
  type ResolvedPreviousSubmissionForCreate,
} from '../../../../lib/server/services/submissions';
import {
  carryForwardReferencePoAttachment,
  carryForwardProductReimbursementAttachment,
  getProductReimbursementAttachmentForSubmission,
  getReferencePoAttachmentForSubmission,
  uploadProductReimbursementAttachment,
  uploadReferencePoAttachment,
  validateProductReimbursementFile,
  validateReferencePoFile,
} from '../../../../lib/server/services/submissionAttachments';
import type { AppUser, CreateSubmissionInput, SanitizedSubmissionPayload } from '../../../../lib/server/types/submissions';
import { sanitizeLineItems, sanitizeSubmissionInput } from '../../../../lib/server/validators/submissions';

type FormUploadFile = File & {
  name: string;
  size: number;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function isFormUploadFile(value: FormDataEntryValue | null): value is FormUploadFile {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'arrayBuffer' in value &&
    'name' in value &&
    'size' in value &&
    'type' in value
  );
}

function normalizeDeliverableName(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function requiresProductReimbursementDocument(lineItems: Array<{ deliverable_name?: string | null }>) {
  return lineItems.some((item) => normalizeDeliverableName(item.deliverable_name) === 'product reimbursement');
}

type ResolvedPreviousSubmission = ResolvedPreviousSubmissionForCreate & {
  submitted_by: string | null;
  business_line: string | null;
  is_latest_version: boolean | null;
};

function sumProductReimbursementLineAmount(lineItems: Array<{ deliverable_name?: string | null; amount?: number | null }>) {
  return lineItems.reduce((total, item) => {
    if (normalizeDeliverableName(item.deliverable_name) !== 'product reimbursement') return total;
    const amount = Number(item.amount ?? 0);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

async function cleanupFailedSubmission(
  adminClient: ReturnType<typeof createServiceClient>,
  submissionId: string,
  previousSubmissionId?: string | null,
  uploadedStoragePaths: string[] = []
) {
  const uniqueUploadedStoragePaths = Array.from(new Set(uploadedStoragePaths.filter(Boolean)));
  if (uniqueUploadedStoragePaths.length > 0) {
    try {
      const { error } = await adminClient.storage.from('finance-documents').remove(uniqueUploadedStoragePaths);
      if (error) console.error('cleanup uploaded storage objects failed', error);
    } catch (cleanupError) {
      console.error('cleanup uploaded storage objects failed', cleanupError);
    }
  }

  try {
    const { error } = await adminClient.from('submission_attachments').delete().eq('submission_id', submissionId);
    if (error) console.error('cleanup attachment metadata failed', error);
  } catch (cleanupError) {
    console.error('cleanup attachment metadata failed', cleanupError);
  }

  try {
    const { error } = await adminClient.from('intake_submissions').delete().eq('id', submissionId);
    if (error) console.error('cleanup incomplete submission failed', error);
  } catch (cleanupError) {
    console.error('cleanup incomplete submission failed', cleanupError);
  }

  if (previousSubmissionId) {
    try {
      const { error } = await adminClient
        .from('intake_submissions')
        .update({
          is_latest_version: true,
          superseded_at: null,
        })
        .eq('id', previousSubmissionId);
      if (error) console.error('cleanup restore previous submission failed', error);
    } catch (cleanupError) {
      console.error('cleanup restore previous submission failed', cleanupError);
    }
  }
}

async function resolvePreviousSubmissionForResubmission(params: {
  adminClient: ReturnType<typeof createServiceClient>;
  appUser: AppUser;
  submissionPayload: SanitizedSubmissionPayload;
}): Promise<ResolvedPreviousSubmission | null> {
  const { adminClient, appUser, submissionPayload } = params;
  if (!submissionPayload.previous_submission_id) return null;

  const { data, error } = await adminClient
    .from('intake_submissions')
    .select('id, submitted_by, business_line, is_latest_version, proforma_invoice')
    .eq('id', submissionPayload.previous_submission_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Previous submission not found for resubmission.');

  const previous = data as ResolvedPreviousSubmission;

  if (String(previous.submitted_by ?? '') !== appUser.id) {
    throw new Error('You can only resubmit your own submission.');
  }

  if (String(previous.business_line ?? '') !== String(submissionPayload.business_line ?? '')) {
    throw new Error('Resubmission business line must match the previous submission.');
  }

  if (previous.is_latest_version !== true) {
    throw new Error('Please resubmit the latest version of this submission.');
  }

  return previous;
}

async function runNonCriticalSideEffect(label: string, effect: () => Promise<void>) {
  try {
    await effect();
  } catch (error) {
    console.error(label, error);
  }
}

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
    const adminClient = createServiceClient();
    const appUser = await getCurrentAppUser(userClient, token);

    let body: CreateSubmissionInput;
    let productReimbursementFile: File | null = null;
    let referencePoFile: File | null = null;
    let removeProductReimbursementAttachment = false;
    let removeReferencePoAttachment = false;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const payloadEntry = formData.get('payload');
      body = JSON.parse(String(payloadEntry || '{}')) as CreateSubmissionInput;

      const reimbursementEntry = formData.get('product_reimbursement_file');
      const hasReimbursementField = formData.has('product_reimbursement_file');
      productReimbursementFile = isFormUploadFile(reimbursementEntry) ? reimbursementEntry : null;
      if (hasReimbursementField && reimbursementEntry && !productReimbursementFile) {
        throw new Error('Uploaded product reimbursement file could not be read on the server.');
      }

      const referencePoEntry = formData.get('reference_po_file');
      const hasReferencePoField = formData.has('reference_po_file');
      referencePoFile = isFormUploadFile(referencePoEntry) ? referencePoEntry : null;
      if (hasReferencePoField && referencePoEntry && !referencePoFile) {
        throw new Error('Uploaded reference PO file could not be read on the server.');
      }

      removeProductReimbursementAttachment = formData.get('remove_product_reimbursement_attachment') === '1';
      removeReferencePoAttachment = formData.get('remove_reference_po_attachment') === '1';
    } else {
      body = (await req.json()) as CreateSubmissionInput;
    }

    const submissionPayload = sanitizeSubmissionInput(body);
    if (appUser.role === 'employee') {
      if (!appUser.business_line) {
        throw new Error('Your business line is not assigned. Please contact finance or admin.');
      }
      if (submissionPayload.business_line !== appUser.business_line) {
        throw new Error('Employee submissions must use your assigned business line.');
      }
    }

    const lineItemsPayload = sanitizeLineItems(body.line_items);
    const needsProductReimbursementDocument = requiresProductReimbursementDocument(lineItemsPayload);
    const productReimbursementLineAmount = sumProductReimbursementLineAmount(lineItemsPayload);
    const effectiveReimbursementAmount = productReimbursementLineAmount > 0
      ? productReimbursementLineAmount
      : submissionPayload.reimbursement_amount;
    const persistedSubmissionPayload = needsProductReimbursementDocument
      ? { ...submissionPayload, reimbursement_amount: effectiveReimbursementAmount }
      : submissionPayload;
    const resolvedPreviousSubmission = await resolvePreviousSubmissionForResubmission({
      adminClient,
      appUser,
      submissionPayload: persistedSubmissionPayload,
    });
    const resolvedPreviousSubmissionWithChainPi = resolvedPreviousSubmission
      ? {
          ...resolvedPreviousSubmission,
          proforma_invoice:
            resolvedPreviousSubmission.proforma_invoice ??
            (await findExistingPiInSubmissionChain(adminClient, resolvedPreviousSubmission.id)),
        }
      : null;
    let carriedProductReimbursementSource: Awaited<ReturnType<typeof getProductReimbursementAttachmentForSubmission>> = null;
    let carriedReferencePoSource: Awaited<ReturnType<typeof getReferencePoAttachmentForSubmission>> = null;

    if (needsProductReimbursementDocument && !(effectiveReimbursementAmount > 0)) {
      throw new Error('Product reimbursement amount is required.');
    }

    if (productReimbursementFile) {
      validateProductReimbursementFile(productReimbursementFile);
    }
    if (needsProductReimbursementDocument && removeProductReimbursementAttachment && !productReimbursementFile) {
      throw new Error('Product reimbursement document is required and cannot be removed.');
    }
    if (needsProductReimbursementDocument && !productReimbursementFile) {
      carriedProductReimbursementSource = await getProductReimbursementAttachmentForSubmission({
        adminClient,
        submissionId: resolvedPreviousSubmission?.id,
      });
      if (!carriedProductReimbursementSource) {
        throw new Error('Product reimbursement document is required.');
      }
    }
    if (referencePoFile) {
      validateReferencePoFile(referencePoFile);
    } else if (resolvedPreviousSubmission?.id && !removeReferencePoAttachment) {
      carriedReferencePoSource = await getReferencePoAttachmentForSubmission({
        adminClient,
        submissionId: resolvedPreviousSubmission.id,
      });
    }

    const result = await createSubmissionWithLineItems({
      userClient,
      adminClient,
      appUser,
      submissionPayload: persistedSubmissionPayload,
      lineItemsPayload,
      resolvedPreviousSubmission: resolvedPreviousSubmissionWithChainPi,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          stage: result.stage,
          error: result.error,
          sync_status: { supabase: 'failed', sheets: 'pending_sheet_sync' },
        },
        { status: 400 }
      );
    }

    let productReimbursementAttachment = null;
    let referencePoAttachment = null;
    let referencePoAttachmentWasUploaded = false;
    const uploadedStoragePaths: string[] = [];

    if (needsProductReimbursementDocument && productReimbursementFile) {
      try {
        productReimbursementAttachment = await uploadProductReimbursementAttachment({
          adminClient,
          submissionId: result.submission.id,
          uploadedBy: appUser.id,
          file: productReimbursementFile,
        });
        uploadedStoragePaths.push(productReimbursementAttachment.file_path);
      } catch (attachmentError) {
        await cleanupFailedSubmission(adminClient, result.submission.id, resolvedPreviousSubmission?.id, uploadedStoragePaths);
        const message = attachmentError instanceof Error ? attachmentError.message : 'Failed to upload reimbursement attachment.';
        return NextResponse.json(
          {
            success: false,
            stage: 'upload_attachment',
            error: message,
            sync_status: { supabase: 'failed', sheets: 'pending_sheet_sync' },
          },
          { status: 400 }
        );
      }
    }

    if (needsProductReimbursementDocument && !productReimbursementFile && carriedProductReimbursementSource) {
      try {
        await carryForwardProductReimbursementAttachment({
          adminClient,
          previousSubmissionId: resolvedPreviousSubmission?.id,
          newSubmissionId: result.submission.id,
        });
      } catch (attachmentError) {
        await cleanupFailedSubmission(adminClient, result.submission.id, resolvedPreviousSubmission?.id, uploadedStoragePaths);
        const message = attachmentError instanceof Error ? attachmentError.message : 'Failed to carry forward reimbursement attachment.';
        return NextResponse.json(
          {
            success: false,
            stage: 'carry_forward_attachment',
            error: message,
            sync_status: { supabase: 'failed', sheets: 'pending_sheet_sync' },
          },
          { status: 400 }
        );
      }
    }

    if (referencePoFile) {
      try {
        referencePoAttachment = await uploadReferencePoAttachment({
          adminClient,
          submissionId: result.submission.id,
          uploadedBy: appUser.id,
          file: referencePoFile,
        });
        uploadedStoragePaths.push(referencePoAttachment.file_path);
        referencePoAttachmentWasUploaded = true;
      } catch (attachmentError) {
        await cleanupFailedSubmission(adminClient, result.submission.id, resolvedPreviousSubmission?.id, uploadedStoragePaths);
        const message = attachmentError instanceof Error ? attachmentError.message : 'Failed to upload reference PO attachment.';
        return NextResponse.json(
          {
            success: false,
            stage: 'upload_attachment',
            error: message,
            sync_status: { supabase: 'failed', sheets: 'pending_sheet_sync' },
          },
          { status: 400 }
        );
      }
    } else if (carriedReferencePoSource) {
      try {
        referencePoAttachment = await carryForwardReferencePoAttachment({
          adminClient,
          previousSubmissionId: resolvedPreviousSubmission?.id,
          newSubmissionId: result.submission.id,
        });
      } catch (attachmentError) {
        await cleanupFailedSubmission(adminClient, result.submission.id, resolvedPreviousSubmission?.id, uploadedStoragePaths);
        const message = attachmentError instanceof Error ? attachmentError.message : 'Failed to carry forward reference PO attachment.';
        return NextResponse.json(
          {
            success: false,
            stage: 'carry_forward_attachment',
            error: message,
            sync_status: { supabase: 'failed', sheets: 'pending_sheet_sync' },
          },
          { status: 400 }
        );
      }
    }

    if (productReimbursementAttachment) {
      await runNonCriticalSideEffect('log reimbursement attachment upload failed', async () => {
        await logActivityEvent(adminClient, {
          actorUserId: appUser.id,
          action: 'submission_attachment_uploaded',
          submissionId: result.submission.id,
          details: {
            attachment_id: productReimbursementAttachment.id,
            document_type: productReimbursementAttachment.document_type,
            file_name: productReimbursementAttachment.file_name,
          },
          structured: {
            action_type: 'submission_attachment_uploaded',
            entity_type: 'submission_attachment',
            entity_id: productReimbursementAttachment.id,
            metadata: {
              attachment_id: productReimbursementAttachment.id,
              document_type: productReimbursementAttachment.document_type,
              file_name: productReimbursementAttachment.file_name,
            },
          },
        });
      });
    }

    if (referencePoAttachment && referencePoAttachmentWasUploaded) {
      await runNonCriticalSideEffect('log reference po attachment upload failed', async () => {
        await logActivityEvent(adminClient, {
          actorUserId: appUser.id,
          action: 'submission_attachment_uploaded',
          submissionId: result.submission.id,
          details: {
            attachment_id: referencePoAttachment.id,
            document_type: referencePoAttachment.document_type,
            file_name: referencePoAttachment.file_name,
          },
          structured: {
            action_type: 'submission_attachment_uploaded',
            entity_type: 'submission_attachment',
            entity_id: referencePoAttachment.id,
            metadata: {
              attachment_id: referencePoAttachment.id,
              document_type: referencePoAttachment.document_type,
              file_name: referencePoAttachment.file_name,
            },
          },
        });
      });
    }

    const masterReviewResult = await createPendingMasterDataReviews({
      adminClient,
      userClient,
      appUser,
      submissionId: result.submission.id,
      submissionPayload: persistedSubmissionPayload,
      lineItemsPayload,
    });

    if (!masterReviewResult.success) {
      console.error('createPendingMasterDataReviews failed', {
        submissionId: result.submission.id,
        error: masterReviewResult.error,
        code: masterReviewResult.code,
        details: masterReviewResult.details,
        hint: masterReviewResult.hint,
      });
    }

    const assignedPiNumber = result.submission.proforma_invoice;
    const resolvedPiNumber = assignedPiNumber ?? (shouldSkipPiGeneration(persistedSubmissionPayload, lineItemsPayload) ? 'No PI Required' : 'PI pending approval');

    await runNonCriticalSideEffect('createFinanceAndAdminSubmissionNotifications failed', async () => {
      await createFinanceAndAdminSubmissionNotifications({
        adminClient,
        appUser,
        submissionId: result.submission.id,
        piNumber: resolvedPiNumber,
        entityName: persistedSubmissionPayload.agency_brand_name,
        isResubmission: Boolean(persistedSubmissionPayload.previous_submission_id),
      });
    });

    if (masterReviewResult.success && masterReviewResult.createdReviews.length > 0) {
      await runNonCriticalSideEffect('createPendingMasterReviewNotifications failed', async () => {
        await createPendingMasterReviewNotifications({
          adminClient,
          appUser,
          submissionId: result.submission.id,
          createdReviews: masterReviewResult.createdReviews,
        });
      });
    }

    await runNonCriticalSideEffect('logSubmissionCreated failed', async () => {
      await logSubmissionCreated(userClient, appUser.id, result.submission.id, {
        role: appUser.role,
        line_items_count: lineItemsPayload.length,
        intake_status: 'submitted',
        sync_status: 'pending_sheet_sync',
        pending_master_reviews_created: masterReviewResult.success ? masterReviewResult.created : 0,
        financial_year: result.submission.financial_year ?? null,
      });
    });

    if (resolvedPreviousSubmission?.id) {
      await runNonCriticalSideEffect('submission_resubmitted activity log failed', async () => {
        await logActivityEvent(userClient, {
          actorUserId: appUser.id,
          submissionId: result.submission.id,
          action: 'submission_resubmitted',
          details: {
            message: 'Submission ' + result.submission.id + ' was resubmitted.',
            previous_submission_id: resolvedPreviousSubmission.id,
            pi_number: assignedPiNumber,
            business_line: submissionPayload.business_line,
            financial_year: result.submission.financial_year ?? null,
            module: 'finance',
          },
          structured: {
            action_type: 'submission_resubmitted',
            entity_type: 'submission',
            entity_id: result.submission.id,
            metadata: {
              previous_submission_id: resolvedPreviousSubmission.id,
              pi_number: assignedPiNumber,
              business_line: submissionPayload.business_line,
              financial_year: result.submission.financial_year ?? null,
              module: 'finance',
            },
          },
        });
      });

      await runNonCriticalSideEffect('submission_superseded activity log failed', async () => {
        await logActivityEvent(userClient, {
          actorUserId: appUser.id,
          submissionId: resolvedPreviousSubmission.id,
          action: 'submission_superseded',
          details: {
            message: 'Submission ' + resolvedPreviousSubmission.id + ' was superseded.',
            new_submission_id: result.submission.id,
            pi_number: assignedPiNumber,
            business_line: submissionPayload.business_line,
            financial_year: result.submission.financial_year ?? null,
            module: 'finance',
          },
          structured: {
            action_type: 'submission_superseded',
            entity_type: 'submission',
            entity_id: resolvedPreviousSubmission.id,
            metadata: {
              new_submission_id: result.submission.id,
              pi_number: assignedPiNumber,
              business_line: submissionPayload.business_line,
              financial_year: result.submission.financial_year ?? null,
              module: 'finance',
            },
          },
        });
      });
    }

    if (productReimbursementAttachment) {
      await runNonCriticalSideEffect('reimbursement_uploaded activity log failed', async () => {
        await logActivityEvent(userClient, {
          actorUserId: appUser.id,
          submissionId: result.submission.id,
          action: 'reimbursement_uploaded',
          details: {
            message: 'Product reimbursement file ' + productReimbursementAttachment.file_name + ' was uploaded.',
            document_type: productReimbursementAttachment.document_type,
            file_name: productReimbursementAttachment.file_name,
            financial_year: result.submission.financial_year ?? null,
            module: 'attachments',
          },
          structured: {
            action_type: 'reimbursement_uploaded',
            entity_type: 'submission_attachment',
            entity_id: productReimbursementAttachment.id,
            metadata: {
              pi_number: assignedPiNumber,
              business_line: submissionPayload.business_line,
              document_type: productReimbursementAttachment.document_type,
              file_name: productReimbursementAttachment.file_name,
              financial_year: result.submission.financial_year ?? null,
              module: 'attachments',
            },
          },
        });
      });
    }

    if (referencePoAttachment && referencePoAttachmentWasUploaded) {
      await runNonCriticalSideEffect('reference_po_uploaded activity log failed', async () => {
        await logActivityEvent(userClient, {
          actorUserId: appUser.id,
          submissionId: result.submission.id,
          action: 'reference_po_uploaded',
          details: {
            message: 'Reference PO file ' + referencePoAttachment.file_name + ' was uploaded.',
            document_type: referencePoAttachment.document_type,
            file_name: referencePoAttachment.file_name,
            financial_year: result.submission.financial_year ?? null,
            module: 'attachments',
          },
          structured: {
            action_type: 'reference_po_uploaded',
            entity_type: 'submission_attachment',
            entity_id: referencePoAttachment.id,
            metadata: {
              pi_number: assignedPiNumber,
              business_line: submissionPayload.business_line,
              document_type: referencePoAttachment.document_type,
              file_name: referencePoAttachment.file_name,
              financial_year: result.submission.financial_year ?? null,
              module: 'attachments',
            },
          },
        });
      });
    }

    return NextResponse.json(
      {
        success: true,
        submission_id: result.submission.id,
        pi_number: assignedPiNumber,
        currency: result.submission.currency ?? submissionPayload.currency,
        master_data_reviews: masterReviewResult,
        sync_status: {
          supabase: 'ok',
          sheets: result.submission.sync_status ?? 'pending_sheet_sync',
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json(
      {
        success: false,
        stage: 'request_validation_or_auth',
        error: message,
        sync_status: { supabase: 'failed', sheets: 'pending_sheet_sync' },
      },
      { status: 400 }
    );
  }
}
