-- Allow reimbursement-only submissions without GST to skip PI generation.
-- Existing submissions and normal invoice inserts keep using the DB default PI generator.
alter table public.intake_submissions
  alter column proforma_invoice drop not null;
