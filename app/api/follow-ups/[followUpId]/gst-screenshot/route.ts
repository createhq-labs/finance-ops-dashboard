import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../../lib/server/auth';
import { logActivityEvent } from '../../../../../lib/server/services/activityLog';
import { getAccessTokenFromCookieHeader } from '../../../../../lib/server/services/authCookies';
import {
  getLatestSubmissionAttachmentByType,
  removeSubmissionAttachmentsByType,
  uploadGstScreenshotAttachment,
  validateGstScreenshotFile,
} from '../../../../../lib/server/services/submissionAttachments';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '../../../../../lib/server/supabase';
import { GST_SCREENSHOT_DOCUMENT_TYPE } from '../../../../../lib/shared/submission-attachments';

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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ followUpId: string }> }
) {
  try {
    assertSupabaseEnv();

    let token = '';
    try {
      token = getBearerToken(req);
    } catch {
      token = getAccessTokenFromCookieHeader(req.cookies) ?? '';
    }
    if (!token) throw new Error('Missing auth token');

    const { followUpId } = await context.params;
    const userClient = createUserScopedClient(token);
    const adminClient = createServiceClient();
    const appUser = await getCurrentAppUser(userClient, token);

    if (!['finance', 'admin', 'developer'].includes(appUser.role)) {
      throw new Error('Only finance/admin can upload GST screenshots.');
    }

    const formData = await req.formData();
    const fileEntry = formData.get('file');
    const file = isFormUploadFile(fileEntry) ? fileEntry : null;
    if (!file) throw new Error('GST screenshot file is required.');
    validateGstScreenshotFile(file);

    const { data: followUp, error: followUpError } = await adminClient
      .from('follow_ups')
      .select('id, submission_id, follow_up_type')
      .eq('id', followUpId)
      .maybeSingle();

    if (followUpError) throw new Error(followUpError.message);
    if (!followUp) throw new Error('Follow-up not found.');
    if (String(followUp.follow_up_type ?? '') !== 'gst_pending') {
      throw new Error('GST screenshot uploads are only available for GST follow-ups.');
    }

    const submissionId = String(followUp.submission_id ?? '');
    const existingAttachment = await getLatestSubmissionAttachmentByType({
      adminClient,
      submissionId,
      documentType: GST_SCREENSHOT_DOCUMENT_TYPE,
    });

    const removedAttachments = await removeSubmissionAttachmentsByType({
      adminClient,
      submissionId,
      documentType: GST_SCREENSHOT_DOCUMENT_TYPE,
    });

    const attachment = await uploadGstScreenshotAttachment({
      adminClient,
      submissionId,
      uploadedBy: appUser.id,
      file,
    });

    await logActivityEvent(adminClient, {
      actorUserId: appUser.id,
      submissionId,
      action: existingAttachment ? 'gst_screenshot_replaced' : 'gst_screenshot_uploaded',
      details: {
        follow_up_id: String(followUp.id),
        attachment_id: attachment.id,
        file_name: attachment.file_name,
        replaced_attachment_ids: removedAttachments.map((item) => item.id),
      },
      structured: {
        action_type: existingAttachment ? 'gst_screenshot_replaced' : 'gst_screenshot_uploaded',
        entity_type: 'submission_attachment',
        entity_id: attachment.id,
        metadata: {
          follow_up_id: String(followUp.id),
          document_type: attachment.document_type,
          file_name: attachment.file_name,
          replaced_attachment_ids: removedAttachments.map((item) => item.id),
          actor_role: appUser.role,
          actor_user_id: appUser.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      replaced: Boolean(existingAttachment),
      attachment: {
        id: attachment.id,
        document_type: attachment.document_type,
        file_name: attachment.file_name,
        file_size_bytes: attachment.file_size_bytes,
        mime_type: attachment.mime_type,
        uploaded_at: attachment.uploaded_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
