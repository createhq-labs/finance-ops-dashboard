import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '../../../../lib/server/supabase';
import { logSubmissionCreated } from '../../../../lib/server/services/activityLog';
import { createSubmissionWithLineItems } from '../../../../lib/server/services/submissions';
import type { CreateSubmissionInput } from '../../../../lib/server/types/submissions';
import { sanitizeLineItems, sanitizeSubmissionInput } from '../../../../lib/server/validators/submissions';

export async function POST(req: NextRequest) {
  try {
    assertSupabaseEnv();

    const token = getBearerToken(req);
    const userClient = createUserScopedClient(token);
    const adminClient = createServiceClient();

    const appUser = await getCurrentAppUser(userClient, token);
    const body = (await req.json()) as CreateSubmissionInput;

    const submissionPayload = sanitizeSubmissionInput(body);
    const lineItemsPayload = sanitizeLineItems(body.line_items);

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

    await logSubmissionCreated(userClient, appUser.id, result.submission.id, {
      role: appUser.role,
      line_items_count: lineItemsPayload.length,
      intake_status: 'submitted',
      sync_status: 'pending_sheet_sync',
    });

    return NextResponse.json(
      {
        success: true,
        submission_id: result.submission.id,
        pi_number: result.submission.proforma_invoice,
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