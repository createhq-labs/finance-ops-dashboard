alter table public.submission_attachments
  drop constraint if exists submission_attachments_document_type_check;

alter table public.submission_attachments
  add constraint submission_attachments_document_type_check
  check (document_type in ('product_reimbursement', 'reference_po'));
