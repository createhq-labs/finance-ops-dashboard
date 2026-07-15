import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '../../../../lib/server/supabase';
import { logActivityEvent, logSubmissionCreated } from '../../../../lib/server/services/activityLog';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';
import { createPendingMasterDataReviews } from '../../../../lib/server/services/masterDataReviews';
import { createFinanceAndAdminSubmissionNotifications, createPendingMasterReviewNotifications } from '../../../../lib/server/services/notifications';
import { allocateGapFreePiForSubmission, createSubmissionWithLineItems } from '../../../../lib/server/services/submissions';
import {
  uploadProductReimbursementAttachment,
  uploadReferencePoAttachment,
  validateProductReimbursementFile,
  validateReferencePoFile,
} from '../../../../lib/server/services/submissionAttachments';
import type { CreateSubmissionInput } from '../../../../lib/server/types/submissions';
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

async function cleanupFailedSubmission(adminClient: ReturnType<typeof createServiceClient>, submissionId: string, previousSubmissionId?: string | null) {
  await adminClient.from('intake_submissions').delete().eq('id', submissionId);
  if (previousSubmissionId) {
    await adminClient
      .from('intake_submissions')
      .update({
        is_latest_version: true,
        superseded_at: null,
      })
      .eq('id', previousSubmissionId);
  }
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

    if (productReimbursementFile) {
      validateProductReimbursementFile(productReimbursementFile);
    }
    if (referencePoFile) {
      validateReferencePoFile(referencePoFile);
    }

    const result = await createSubmissionWithLineItems({
      userClient,
      adminClient,
      appUser,
      submissionPayload,
      lineItemsPayload,
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

    if (needsProductReimbursementDocument && productReimbursementFile) {
      try {
        productReimbursementAttachment = await uploadProductReimbursementAttachment({
          adminClient,
          submissionId: result.submission.id,
          uploadedBy: appUser.id,
          file: productReimbursementFile,
        });
      } catch (attachmentError) {
        await cleanupFailedSubmission(adminClient, result.submission.id, submissionPayload.previous_submission_id);
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

    if (referencePoFile) {
      try {
        referencePoAttachment = await uploadReferencePoAttachment({
          adminClient,
          submissionId: result.submission.id,
          uploadedBy: appUser.id,
          file: referencePoFile,
        });
      } catch (attachmentError) {
        await cleanupFailedSubmission(adminClient, result.submission.id, submissionPayload.previous_submission_id);
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
    }

    const masterReviewResult = await createPendingMasterDataReviews({
      userClient,
      appUser,
      submissionId: result.submission.id,
      submissionPayload,
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

    let assignedPiNumber = result.submission.proforma_invoice;

    if (result.pi_allocation_pending) {
      try {
        assignedPiNumber = await allocateGapFreePiForSubmission(adminClient, result.submission.id);
      } catch (piError) {
        await cleanupFailedSubmission(adminClient, result.submission.id, submissionPayload.previous_submission_id);
        const message = piError instanceof Error ? piError.message : 'Failed to allocate PI number.';
        return NextResponse.json(
          {
            success: false,
            stage: 'assign_pi',
            error: message,
            sync_status: { supabase: 'failed', sheets: 'pending_sheet_sync' },
          },
          { status: 400 }
        );
      }
    }

    const resolvedPiNumber = assignedPiNumber ?? 'No PI Required';

    await runNonCriticalSideEffect('createFinanceAndAdminSubmissionNotifications failed', async () => {
      await createFinanceAndAdminSubmissionNotifications({
        adminClient,
        appUser,
        submissionId: result.submission.id,
        piNumber: resolvedPiNumber,
        entityName: submissionPayload.agency_brand_name,
        isResubmission: Boolean(submissionPayload.previous_submission_id),
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

    if (submissionPayload.previous_submission_id) {
      await runNonCriticalSideEffect('submission_resubmitted activity log failed', async () => {
        await logActivityEvent(userClient, {
          actorUserId: appUser.id,
          submissionId: result.submission.id,
          action: 'submission_resubmitted',
          details: {
            message: 'Submission ' + result.submission.id + ' was resubmitted.',
            previous_submission_id: submissionPayload.previous_submission_id,
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
              previous_submission_id: submissionPayload.previous_submission_id,
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
          submissionId: submissionPayload.previous_submission_id,
          action: 'submission_superseded',
          details: {
            message: 'Submission ' + submissionPayload.previous_submission_id + ' was superseded.',
            new_submission_id: result.submission.id,
            pi_number: assignedPiNumber,
            business_line: submissionPayload.business_line,
            financial_year: result.submission.financial_year ?? null,
            module: 'finance',
          },
          structured: {
            action_type: 'submission_superseded',
            entity_type: 'submission',
            entity_id: submissionPayload.previous_submission_id,
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

    if (referencePoAttachment) {
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
