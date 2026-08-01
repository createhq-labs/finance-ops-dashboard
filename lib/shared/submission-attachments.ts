export const SUBMISSION_ATTACHMENT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const SUBMISSION_ATTACHMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const PRODUCT_REIMBURSEMENT_DOCUMENT_TYPE = 'product_reimbursement';
export const REFERENCE_PO_DOCUMENT_TYPE = 'reference_po';
export const GST_SCREENSHOT_DOCUMENT_TYPE = 'gst_screenshot';

export const GST_SCREENSHOT_UPLOADABLE_FOLLOW_UP_STATUS = 'pending';

export function isGstScreenshotUploadAllowed(followUpStatus: string | null | undefined) {
  return String(followUpStatus ?? '').trim().toLowerCase() === GST_SCREENSHOT_UPLOADABLE_FOLLOW_UP_STATUS;
}

export const PRODUCT_REIMBURSEMENT_MAX_FILE_SIZE_BYTES = SUBMISSION_ATTACHMENT_MAX_FILE_SIZE_BYTES;
export const PRODUCT_REIMBURSEMENT_ALLOWED_MIME_TYPES = SUBMISSION_ATTACHMENT_ALLOWED_MIME_TYPES;
export const REFERENCE_PO_MAX_FILE_SIZE_BYTES = SUBMISSION_ATTACHMENT_MAX_FILE_SIZE_BYTES;
export const REFERENCE_PO_ALLOWED_MIME_TYPES = SUBMISSION_ATTACHMENT_ALLOWED_MIME_TYPES;
export const GST_SCREENSHOT_MAX_FILE_SIZE_BYTES = SUBMISSION_ATTACHMENT_MAX_FILE_SIZE_BYTES;
export const GST_SCREENSHOT_ALLOWED_MIME_TYPES = SUBMISSION_ATTACHMENT_ALLOWED_MIME_TYPES;

export type ProductReimbursementAllowedMimeType =
  (typeof PRODUCT_REIMBURSEMENT_ALLOWED_MIME_TYPES)[number];

export type ReferencePoAllowedMimeType =
  (typeof REFERENCE_PO_ALLOWED_MIME_TYPES)[number];

export type GstScreenshotAllowedMimeType =
  (typeof GST_SCREENSHOT_ALLOWED_MIME_TYPES)[number];

export type SubmissionAttachmentSummary = {
  id: string;
  document_type: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  uploaded_at?: string | null;
};

function getAttachmentUploadedTime(attachment: SubmissionAttachmentSummary) {
  const uploadedAt = attachment.uploaded_at;
  if (!uploadedAt) return Number.NEGATIVE_INFINITY;
  const time = new Date(uploadedAt).getTime();
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

function pickSubmissionAttachmentByType(
  attachments: unknown,
  documentType: string
): SubmissionAttachmentSummary | null {
  if (!Array.isArray(attachments)) return null;

  // Attachments of the same document_type are append-only (a replaced GST
  // screenshot is retained as history), and embedded selects return them in no
  // guaranteed order, so the newest uploaded_at wins rather than the first row.
  let latest: SubmissionAttachmentSummary | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const candidate of attachments) {
    if (!candidate || typeof candidate !== 'object') continue;
    if (String((candidate as { document_type?: unknown }).document_type ?? '') !== documentType) continue;

    const attachment = candidate as SubmissionAttachmentSummary;
    const uploadedTime = getAttachmentUploadedTime(attachment);

    // Strictly-greater comparison keeps the first matching row on ties and when
    // no row carries a usable uploaded_at, preserving the previous behaviour.
    if (latest === null || uploadedTime > latestTime) {
      latest = attachment;
      latestTime = uploadedTime;
    }
  }

  return latest;
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

export function pickGstScreenshotAttachment(
  attachments: unknown
): SubmissionAttachmentSummary | null {
  return pickSubmissionAttachmentByType(attachments, GST_SCREENSHOT_DOCUMENT_TYPE);
}

export function formatAttachmentSize(bytes: number | null | undefined) {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return '0 KB';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
