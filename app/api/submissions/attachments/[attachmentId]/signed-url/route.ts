import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../../../lib/server/auth';
import { logActivityEvent } from '../../../../../../lib/server/services/activityLog';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '../../../../../../lib/server/supabase';
import { getAccessTokenFromCookieHeader } from '../../../../../../lib/server/services/authCookies';
import {
  createSubmissionAttachmentSignedUrl,
  getSubmissionAttachmentForUser,
} from '../../../../../../lib/server/services/submissionAttachments';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ attachmentId: string }> }
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

    const { attachmentId } = await context.params;
    const userClient = createUserScopedClient(token);
    const adminClient = createServiceClient();
    const appUser = await getCurrentAppUser(userClient, token);

    const attachment = await getSubmissionAttachmentForUser({
      adminClient,
      attachmentId,
      appUser,
    });

    const isDownload = req.nextUrl.searchParams.get('download') === '1';
    const signedUrl = await createSubmissionAttachmentSignedUrl({
      adminClient,
      filePath: attachment.file_path,
      download: isDownload,
    });

    await logActivityEvent(adminClient, {
      actorUserId: appUser.id,
      action: isDownload ? 'submission_attachment_downloaded' : 'submission_attachment_viewed',
      submissionId: attachment.submission_id,
      details: {
        attachment_id: attachment.id,
        document_type: attachment.document_type,
        file_name: attachment.file_name,
      },
      structured: {
        action_type: isDownload ? 'submission_attachment_downloaded' : 'submission_attachment_viewed',
        entity_type: 'submission_attachment',
        entity_id: attachment.id,
        metadata: {
          attachment_id: attachment.id,
          document_type: attachment.document_type,
          file_name: attachment.file_name,
          access_mode: isDownload ? 'download' : 'view',
          actor_role: appUser.role,
          actor_user_id: appUser.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      url: signedUrl,
      file_name: attachment.file_name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
