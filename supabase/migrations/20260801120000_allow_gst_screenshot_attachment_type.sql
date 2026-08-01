-- Allow GST screenshot attachments.
--
-- The application has been writing document_type = 'gst_screenshot' since the
-- follow-up GST screenshot feature shipped, but the CHECK constraint added by
-- 20260629153000_add_reference_po_attachment_type.sql only permits
-- 'product_reimbursement' and 'reference_po'. Every GST screenshot upload
-- therefore failed on insert. This migration extends the same constraint and
-- preserves both previously allowed values.

alter table public.submission_attachments
  drop constraint if exists submission_attachments_document_type_check;

alter table public.submission_attachments
  add constraint submission_attachments_document_type_check
  check (document_type in ('product_reimbursement', 'reference_po', 'gst_screenshot'));
