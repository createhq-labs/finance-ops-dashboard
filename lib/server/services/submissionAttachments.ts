import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppUser, SubmissionAttachmentRecord } from '../types/submissions';
import {
  GST_SCREENSHOT_ALLOWED_MIME_TYPES,
  GST_SCREENSHOT_DOCUMENT_TYPE,
  GST_SCREENSHOT_MAX_FILE_SIZE_BYTES,
  PRODUCT_REIMBURSEMENT_ALLOWED_MIME_TYPES,
  PRODUCT_REIMBURSEMENT_DOCUMENT_TYPE,
  PRODUCT_REIMBURSEMENT_MAX_FILE_SIZE_BYTES,
  REFERENCE_PO_ALLOWED_MIME_TYPES,
  REFERENCE_PO_DOCUMENT_TYPE,
  REFERENCE_PO_MAX_FILE_SIZE_BYTES,
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

function validateSubmissionAttachmentFile(params: {
  file: UploadableFile | null | undefined;
  requiredLabel: string;
  sizeLabel: string;
  typeLabel: string;
  maxSizeBytes: number;
  allowedMimeTypes: readonly string[];
}) {
  const { file, requiredLabel, sizeLabel, typeLabel, maxSizeBytes, allowedMimeTypes } = params;
  if (!file) throw new Error(requiredLabel);
  if (file.size > maxSizeBytes) {
    throw new Error(sizeLabel);
  }
  if (!allowedMimeTypes.includes(file.type)) {
    throw new Error(typeLabel);
  }
}

export function validateProductReimbursementFile(file: UploadableFile | null | undefined) {
  validateSubmissionAttachmentFile({
    file,
    requiredLabel: 'Product reimbursement document is required.',
    sizeLabel: 'Product reimbursement file must be 10 MB or smaller.',
    typeLabel: 'Only PDF, PNG, JPEG, or WEBP files are allowed for product reimbursement.',
    maxSizeBytes: PRODUCT_REIMBURSEMENT_MAX_FILE_SIZE_BYTES,
    allowedMimeTypes: PRODUCT_REIMBURSEMENT_ALLOWED_MIME_TYPES,
  });
}

export function validateReferencePoFile(file: UploadableFile | null | undefined) {
  validateSubmissionAttachmentFile({
    file,
    requiredLabel: 'Reference PO document is required.',
    sizeLabel: 'Reference PO file must be 10 MB or smaller.',
    typeLabel: 'Only PDF, PNG, JPEG, or WEBP files are allowed for reference PO uploads.',
    maxSizeBytes: REFERENCE_PO_MAX_FILE_SIZE_BYTES,
    allowedMimeTypes: REFERENCE_PO_ALLOWED_MIME_TYPES,
  });
}

export function validateGstScreenshotFile(file: UploadableFile | null | undefined) {
  validateSubmissionAttachmentFile({
    file,
    requiredLabel: 'GST screenshot is required.',
    sizeLabel: 'GST screenshot file must be 10 MB or smaller.',
    typeLabel: 'Only PDF, PNG, JPEG, or WEBP files are allowed for GST screenshot uploads.',
    maxSizeBytes: GST_SCREENSHOT_MAX_FILE_SIZE_BYTES,
    allowedMimeTypes: GST_SCREENSHOT_ALLOWED_MIME_TYPES,
  });
}

async function uploadSubmissionAttachment(params: {
  adminClient: SupabaseClient;
  submissionId: string;
  uploadedBy: string;
  file: UploadableFile;
  documentType: string;
  storageFolder: string;
  validateFile: (file: UploadableFile) => void;
  insertErrorMessage: string;
  uploadErrorMessage: string;
}): Promise<SubmissionAttachmentRecord> {
  const {
    adminClient,
    submissionId,
    uploadedBy,
    file,
    documentType,
    storageFolder,
    validateFile,
    insertErrorMessage,
    uploadErrorMessage,
  } = params;

  validateFile(file);

  const attachmentId = randomUUID();
  const safeFileName = sanitizeFileName(file.name);
  const filePath = `submissions/${submissionId}/${storageFolder}/${attachmentId}-${safeFileName}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await adminClient.storage
    .from('finance-documents')
    .upload(filePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || uploadErrorMessage);
  }

  const metadata: SubmissionAttachmentRecord = {
    id: attachmentId,
    submission_id: submissionId,
    document_type: documentType,
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
    throw new Error(insertError?.message || insertErrorMessage);
  }

  return data as SubmissionAttachmentRecord;
}

async function listSubmissionAttachmentsByType(params: {
  adminClient: SupabaseClient;
  submissionId: string | null | undefined;
  documentType: string;
}) {
  const { adminClient, submissionId, documentType } = params;
  if (!submissionId) return [];

  const { data, error } = await adminClient
    .from('submission_attachments')
    .select('id, submission_id, document_type, file_name, file_path, file_size_bytes, mime_type, uploaded_by, uploaded_at')
    .eq('submission_id', submissionId)
    .eq('document_type', documentType)
    .order('uploaded_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SubmissionAttachmentRecord[];
}

export async function getLatestSubmissionAttachmentByType(params: {
  adminClient: SupabaseClient;
  submissionId: string | null | undefined;
  documentType: string;
}) {
  const rows = await listSubmissionAttachmentsByType(params);
  return rows[0] ?? null;
}

export async function removeSubmissionAttachmentsByType(params: {
  adminClient: SupabaseClient;
  submissionId: string | null | undefined;
  documentType: string;
}) {
  const { adminClient, submissionId, documentType } = params;
  if (!submissionId) return [] as SubmissionAttachmentRecord[];

  const rows = await listSubmissionAttachmentsByType({ adminClient, submissionId, documentType });
  if (rows.length === 0) {
    return [] as SubmissionAttachmentRecord[];
  }

  const filePaths = rows.map((row) => row.file_path).filter(Boolean);
  if (filePaths.length > 0) {
    const { error: storageError } = await adminClient.storage.from('finance-documents').remove(filePaths);
    if (storageError) throw new Error(storageError.message);
  }

  const ids = rows.map((row) => row.id);
  const { error: deleteError } = await adminClient.from('submission_attachments').delete().in('id', ids);
  if (deleteError) throw new Error(deleteError.message);

  return rows;
}

export async function uploadProductReimbursementAttachment(params: {
  adminClient: SupabaseClient;
  submissionId: string;
  uploadedBy: string;
  file: UploadableFile;
}): Promise<SubmissionAttachmentRecord> {
  const { adminClient, submissionId, uploadedBy, file } = params;
  return uploadSubmissionAttachment({
    adminClient,
    submissionId,
    uploadedBy,
    file,
    documentType: PRODUCT_REIMBURSEMENT_DOCUMENT_TYPE,
    storageFolder: 'product-reimbursement',
    validateFile: validateProductReimbursementFile,
    insertErrorMessage: 'Failed to save reimbursement attachment metadata.',
    uploadErrorMessage: 'Failed to upload reimbursement document.',
  });
}

export async function uploadReferencePoAttachment(params: {
  adminClient: SupabaseClient;
  submissionId: string;
  uploadedBy: string;
  file: UploadableFile;
}): Promise<SubmissionAttachmentRecord> {
  const { adminClient, submissionId, uploadedBy, file } = params;
  return uploadSubmissionAttachment({
    adminClient,
    submissionId,
    uploadedBy,
    file,
    documentType: REFERENCE_PO_DOCUMENT_TYPE,
    storageFolder: 'reference-po',
    validateFile: validateReferencePoFile,
    insertErrorMessage: 'Failed to save reference PO attachment metadata.',
    uploadErrorMessage: 'Failed to upload reference PO document.',
  });
}

export async function uploadGstScreenshotAttachment(params: {
  adminClient: SupabaseClient;
  submissionId: string;
  uploadedBy: string;
  file: UploadableFile;
}): Promise<SubmissionAttachmentRecord> {
  const { adminClient, submissionId, uploadedBy, file } = params;
  return uploadSubmissionAttachment({
    adminClient,
    submissionId,
    uploadedBy,
    file,
    documentType: GST_SCREENSHOT_DOCUMENT_TYPE,
    storageFolder: 'gst-screenshot',
    validateFile: validateGstScreenshotFile,
    insertErrorMessage: 'Failed to save GST screenshot metadata.',
    uploadErrorMessage: 'Failed to upload GST screenshot.',
  });
}


export async function getProductReimbursementAttachmentForSubmission(params: {
  adminClient: SupabaseClient;
  submissionId: string | null | undefined;
}): Promise<SubmissionAttachmentRecord | null> {
  return getLatestSubmissionAttachmentByType({
    ...params,
    documentType: PRODUCT_REIMBURSEMENT_DOCUMENT_TYPE,
  });
}

export async function getReferencePoAttachmentForSubmission(params: {
  adminClient: SupabaseClient;
  submissionId: string | null | undefined;
}): Promise<SubmissionAttachmentRecord | null> {
  return getLatestSubmissionAttachmentByType({
    ...params,
    documentType: REFERENCE_PO_DOCUMENT_TYPE,
  });
}

export async function carryForwardProductReimbursementAttachment(params: {
  adminClient: SupabaseClient;
  previousSubmissionId: string | null | undefined;
  newSubmissionId: string;
}): Promise<SubmissionAttachmentRecord | null> {
  const { adminClient, previousSubmissionId, newSubmissionId } = params;
  const previousAttachment = await getProductReimbursementAttachmentForSubmission({
    adminClient,
    submissionId: previousSubmissionId,
  });

  if (!previousAttachment) return null;

  const metadata: SubmissionAttachmentRecord = {
    id: randomUUID(),
    submission_id: newSubmissionId,
    document_type: previousAttachment.document_type,
    file_name: previousAttachment.file_name,
    file_path: previousAttachment.file_path,
    file_size_bytes: previousAttachment.file_size_bytes,
    mime_type: previousAttachment.mime_type,
    uploaded_by: previousAttachment.uploaded_by,
    uploaded_at: previousAttachment.uploaded_at,
  };

  const { data, error } = await adminClient
    .from('submission_attachments')
    .insert(metadata)
    .select('id, submission_id, document_type, file_name, file_path, file_size_bytes, mime_type, uploaded_by, uploaded_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to carry forward reimbursement attachment metadata.');
  }

  return data as SubmissionAttachmentRecord;
}

export async function carryForwardReferencePoAttachment(params: {
  adminClient: SupabaseClient;
  previousSubmissionId: string | null | undefined;
  newSubmissionId: string;
}): Promise<SubmissionAttachmentRecord | null> {
  const { adminClient, previousSubmissionId, newSubmissionId } = params;
  const previousAttachment = await getReferencePoAttachmentForSubmission({
    adminClient,
    submissionId: previousSubmissionId,
  });

  if (!previousAttachment) return null;

  const metadata: SubmissionAttachmentRecord = {
    id: randomUUID(),
    submission_id: newSubmissionId,
    document_type: previousAttachment.document_type,
    file_name: previousAttachment.file_name,
    file_path: previousAttachment.file_path,
    file_size_bytes: previousAttachment.file_size_bytes,
    mime_type: previousAttachment.mime_type,
    uploaded_by: previousAttachment.uploaded_by,
    uploaded_at: previousAttachment.uploaded_at,
  };

  const { data, error } = await adminClient
    .from('submission_attachments')
    .insert(metadata)
    .select('id, submission_id, document_type, file_name, file_path, file_size_bytes, mime_type, uploaded_by, uploaded_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to carry forward reference PO attachment metadata.');
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

export type AttachmentAccessSummary = {
  role: 'employee' | 'team_lead';
  user_id: string;
  name: string | null;
  business_line: string | null;
  viewed: boolean;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  downloaded: boolean;
  first_downloaded_at: string | null;
  last_downloaded_at: string | null;
  download_count: number;
};

export type AttachmentAccessActor = {
  attachmentId: string;
  role: 'employee' | 'team_lead';
  userId: string;
  name: string | null;
  businessLine: string | null;
};

// Aggregates existing activity_log rows (submission_attachment_viewed /
// submission_attachment_downloaded) for many attachments in a single query,
// scoped to the given actors only. Read-only: no new table, no new event is
// written here. Filtering by exact actor_user_id (rather than role) is what
// excludes finance/admin/developer access events from these metrics.
export async function getAttachmentAccessSummaryMap(params: {
  adminClient: SupabaseClient;
  actors: AttachmentAccessActor[];
}): Promise<Map<string, AttachmentAccessSummary>> {
  const { adminClient, actors } = params;
  const map = new Map<string, AttachmentAccessSummary>();
  if (actors.length === 0) return map;

  const attachmentIds = Array.from(new Set(actors.map((actor) => actor.attachmentId)));
  const actorIds = Array.from(new Set(actors.map((actor) => actor.userId)));

  const { data, error } = await adminClient
    .from('activity_log')
    .select('entity_id, actor_user_id, action, created_at')
    .eq('entity_type', 'submission_attachment')
    .in('entity_id', attachmentIds)
    .in('actor_user_id', actorIds)
    .in('action', ['submission_attachment_viewed', 'submission_attachment_downloaded'])
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{ entity_id: string | null; actor_user_id: string | null; action: string; created_at: string }>;

  for (const actor of actors) {
    const matching = rows.filter((row) => row.entity_id === actor.attachmentId && row.actor_user_id === actor.userId);
    const viewedRows = matching.filter((row) => row.action === 'submission_attachment_viewed');
    const downloadedRows = matching.filter((row) => row.action === 'submission_attachment_downloaded');

    map.set(`${actor.attachmentId}:${actor.role}`, {
      role: actor.role,
      user_id: actor.userId,
      name: actor.name,
      business_line: actor.businessLine,
      viewed: viewedRows.length > 0,
      first_viewed_at: viewedRows[0]?.created_at ?? null,
      last_viewed_at: viewedRows[viewedRows.length - 1]?.created_at ?? null,
      view_count: viewedRows.length,
      downloaded: downloadedRows.length > 0,
      first_downloaded_at: downloadedRows[0]?.created_at ?? null,
      last_downloaded_at: downloadedRows[downloadedRows.length - 1]?.created_at ?? null,
      download_count: downloadedRows.length,
    });
  }

  return map;
}
