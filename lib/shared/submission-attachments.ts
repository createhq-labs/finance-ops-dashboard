export const SUBMISSION_ATTACHMENT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const SUBMISSION_ATTACHMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const PRODUCT_REIMBURSEMENT_DOCUMENT_TYPE = 'product_reimbursement';
export const REFERENCE_PO_DOCUMENT_TYPE = 'reference_po';

export const PRODUCT_REIMBURSEMENT_MAX_FILE_SIZE_BYTES = SUBMISSION_ATTACHMENT_MAX_FILE_SIZE_BYTES;
export const PRODUCT_REIMBURSEMENT_ALLOWED_MIME_TYPES = SUBMISSION_ATTACHMENT_ALLOWED_MIME_TYPES;
export const REFERENCE_PO_MAX_FILE_SIZE_BYTES = SUBMISSION_ATTACHMENT_MAX_FILE_SIZE_BYTES;
export const REFERENCE_PO_ALLOWED_MIME_TYPES = SUBMISSION_ATTACHMENT_ALLOWED_MIME_TYPES;

export type ProductReimbursementAllowedMimeType =
  (typeof PRODUCT_REIMBURSEMENT_ALLOWED_MIME_TYPES)[number];

export type ReferencePoAllowedMimeType =
  (typeof REFERENCE_PO_ALLOWED_MIME_TYPES)[number];

export type SubmissionAttachmentSummary = {
  id: string;
  document_type: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  uploaded_at?: string | null;
};

function pickSubmissionAttachmentByType(
  attachments: unknown,
  documentType: string
): SubmissionAttachmentSummary | null {
  if (!Array.isArray(attachments)) return null;

  const match = attachments.find((attachment) => {
    if (!attachment || typeof attachment !== 'object') return false;
    return String((attachment as { document_type?: unknown }).document_type ?? '') === documentType;
  }) as SubmissionAttachmentSummary | undefined;

  return match ?? null;
}

export function pickProductReimbursementAttachment(
  attachments: unknown
): SubmissionAttachmentSummary | null {
  return pickSubmissionAttachmentByType(attachments, PRODUCT_REIMBURSEMENT_DOCUMENT_TYPE);
}

export function pickReferencePoAttachment(
  attachments: unknown
): SubmissionAttachmentSummary | null {
  return pickSubmissionAttachmentByType(attachments, REFERENCE_PO_DOCUMENT_TYPE);
}

export function formatAttachmentSize(bytes: number | null | undefined) {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return '0 KB';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
