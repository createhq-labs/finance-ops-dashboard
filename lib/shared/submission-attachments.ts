export const PRODUCT_REIMBURSEMENT_DOCUMENT_TYPE = 'product_reimbursement';
export const PRODUCT_REIMBURSEMENT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const PRODUCT_REIMBURSEMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type ProductReimbursementAllowedMimeType =
  (typeof PRODUCT_REIMBURSEMENT_ALLOWED_MIME_TYPES)[number];

export type SubmissionAttachmentSummary = {
  id: string;
  document_type: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  uploaded_at?: string | null;
};

export function pickProductReimbursementAttachment(
  attachments: unknown
): SubmissionAttachmentSummary | null {
  if (!Array.isArray(attachments)) return null;

  const match = attachments.find((attachment) => {
    if (!attachment || typeof attachment !== 'object') return false;
    return (
      String((attachment as { document_type?: unknown }).document_type ?? '') ===
      PRODUCT_REIMBURSEMENT_DOCUMENT_TYPE
    );
  }) as SubmissionAttachmentSummary | undefined;

  return match ?? null;
}

export function formatAttachmentSize(bytes: number | null | undefined) {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return '0 KB';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
