import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../../../lib/server/auth';
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

    const signedUrl = await createSubmissionAttachmentSignedUrl({
      adminClient,
      filePath: attachment.file_path,
      download: req.nextUrl.searchParams.get('download') === '1',
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
