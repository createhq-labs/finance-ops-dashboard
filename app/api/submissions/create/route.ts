import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '../../../../lib/server/supabase';
import { logSubmissionCreated } from '../../../../lib/server/services/activityLog';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';
import { createPendingMasterDataReviews } from '../../../../lib/server/services/masterDataReviews';
import { createFinanceAndAdminSubmissionNotifications, createPendingMasterReviewNotifications } from '../../../../lib/server/services/notifications';
import { createSubmissionWithLineItems } from '../../../../lib/server/services/submissions';
import { uploadProductReimbursementAttachment, validateProductReimbursementFile } from '../../../../lib/server/services/submissionAttachments';
import type { CreateSubmissionInput } from '../../../../lib/server/types/submissions';

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
import { sanitizeLineItems, sanitizeSubmissionInput } from '../../../../lib/server/validators/submissions';


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
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const payloadEntry = formData.get('payload');
      body = JSON.parse(String(payloadEntry || '{}')) as CreateSubmissionInput;
      const fileEntry = formData.get('product_reimbursement_file');
      const hasAttachmentField = formData.has('product_reimbursement_file');
      productReimbursementFile = isFormUploadFile(fileEntry) ? fileEntry : null;
      if (hasAttachmentField && fileEntry && !productReimbursementFile) {
        throw new Error('Uploaded product reimbursement file could not be read on the server.');
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

    if (needsProductReimbursementDocument && productReimbursementFile) {
      try {
        await uploadProductReimbursementAttachment({
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

    const masterReviewResult = await createPendingMasterDataReviews({
      userClient,
      appUser,
      submissionId: result.submission.id,
      submissionPayload,
      lineItemsPayload,
    });

    await createFinanceAndAdminSubmissionNotifications({
      adminClient,
      appUser,
      submissionId: result.submission.id,
      piNumber: result.submission.proforma_invoice ?? 'No PI Required',
      entityName: submissionPayload.agency_brand_name,
      isResubmission: Boolean(submissionPayload.previous_submission_id),
    });

    if (masterReviewResult.success && masterReviewResult.createdReviews.length > 0) {
      await createPendingMasterReviewNotifications({
        adminClient,
        appUser,
        submissionId: result.submission.id,
        createdReviews: masterReviewResult.createdReviews,
      });
    }

    await logSubmissionCreated(userClient, appUser.id, result.submission.id, {
      role: appUser.role,
      line_items_count: lineItemsPayload.length,
      intake_status: 'submitted',
      sync_status: 'pending_sheet_sync',
      pending_master_reviews_created: masterReviewResult.success ? masterReviewResult.created : 0,
    });

    return NextResponse.json(
      {
        success: true,
        submission_id: result.submission.id,
        pi_number: result.submission.proforma_invoice,
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
