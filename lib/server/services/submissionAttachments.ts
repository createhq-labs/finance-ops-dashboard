import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppUser, SubmissionAttachmentRecord } from '../types/submissions';
import {
  PRODUCT_REIMBURSEMENT_ALLOWED_MIME_TYPES,
  PRODUCT_REIMBURSEMENT_DOCUMENT_TYPE,
  PRODUCT_REIMBURSEMENT_MAX_FILE_SIZE_BYTES,
} from '../../shared/submission-attachments';

type UploadableFile = {
  name: string;
  size: number;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function sanitizeFileName(name: string) {
  const cleaned = String(name || 'document')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/-+/g, '-');
  return cleaned || 'document';
}

export function validateProductReimbursementFile(file: UploadableFile | null | undefined) {
  if (!file) throw new Error('Product reimbursement document is required.');
  if (file.size > PRODUCT_REIMBURSEMENT_MAX_FILE_SIZE_BYTES) {
    throw new Error('Product reimbursement file must be 10 MB or smaller.');
  }
  if (!PRODUCT_REIMBURSEMENT_ALLOWED_MIME_TYPES.includes(file.type as (typeof PRODUCT_REIMBURSEMENT_ALLOWED_MIME_TYPES)[number])) {
    throw new Error('Only PDF, PNG, JPEG, or WEBP files are allowed for product reimbursement.');
  }
}

export async function uploadProductReimbursementAttachment(params: {
  adminClient: SupabaseClient;
  submissionId: string;
  uploadedBy: string;
  file: UploadableFile;
}): Promise<SubmissionAttachmentRecord> {
  const { adminClient, submissionId, uploadedBy, file } = params;
  validateProductReimbursementFile(file);

  const attachmentId = randomUUID();
  const safeFileName = sanitizeFileName(file.name);
  const filePath = `submissions/${submissionId}/product-reimbursement/${attachmentId}-${safeFileName}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await adminClient.storage
    .from('finance-documents')
    .upload(filePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || 'Failed to upload reimbursement document.');
  }

  const metadata: SubmissionAttachmentRecord = {
    id: attachmentId,
    submission_id: submissionId,
    document_type: PRODUCT_REIMBURSEMENT_DOCUMENT_TYPE,
    file_name: safeFileName,
    file_path: filePath,
    file_size_bytes: file.size,
    mime_type: file.type,
    uploaded_by: uploadedBy,
    uploaded_at: new Date().toISOString(),
  };

  const { data, error: insertError } = await adminClient
    .from('submission_attachments')
    .insert(metadata)
    .select('id, submission_id, document_type, file_name, file_path, file_size_bytes, mime_type, uploaded_by, uploaded_at')
    .single();

  if (insertError || !data) {
    await adminClient.storage.from('finance-documents').remove([filePath]);
    throw new Error(insertError?.message || 'Failed to save reimbursement attachment metadata.');
  }

  return data as SubmissionAttachmentRecord;
}

export async function getSubmissionAttachmentForUser(params: {
  adminClient: SupabaseClient;
  attachmentId: string;
  appUser: AppUser;
}): Promise<SubmissionAttachmentRecord> {
  const { adminClient, attachmentId, appUser } = params;

  const { data: attachment, error: attachmentError } = await adminClient
    .from('submission_attachments')
    .select('id, submission_id, document_type, file_name, file_path, file_size_bytes, mime_type, uploaded_by, uploaded_at')
    .eq('id', attachmentId)
    .maybeSingle();

  if (attachmentError) throw new Error(attachmentError.message);
  if (!attachment) throw new Error('Attachment not found.');

  const { data: submission, error: submissionError } = await adminClient
    .from('intake_submissions')
    .select('id, submitted_by')
    .eq('id', attachment.submission_id)
    .maybeSingle();

  if (submissionError) throw new Error(submissionError.message);
  if (!submission) throw new Error('Parent submission not found.');

  const isPrivileged = ['finance', 'admin', 'developer'].includes(appUser.role);
  const ownsSubmission = String(submission.submitted_by ?? '') === appUser.id;

  if (!isPrivileged && !ownsSubmission) {
    if (appUser.role !== 'team_lead') {
      throw new Error('You do not have access to this attachment.');
    }

    const { data: mapping, error: mappingError } = await adminClient
      .from('team_lead_members')
      .select('employee_id')
      .eq('team_lead_id', appUser.id)
      .eq('employee_id', String(submission.submitted_by ?? ''))
      .maybeSingle();

    if (mappingError) throw new Error(mappingError.message);
    if (!mapping) throw new Error('You do not have access to this attachment.');
  }

  return attachment as SubmissionAttachmentRecord;
}

export async function createSubmissionAttachmentSignedUrl(params: {
  adminClient: SupabaseClient;
  filePath: string;
  download?: boolean;
}) {
  const { adminClient, filePath, download = false } = params;
  const { data, error } = await adminClient.storage
    .from('finance-documents')
    .createSignedUrl(filePath, 60 * 5, download ? { download: true } : undefined);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Unable to generate attachment link.');
  }

  return data.signedUrl;
}
