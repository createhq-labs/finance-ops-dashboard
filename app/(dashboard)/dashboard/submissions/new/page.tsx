"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pencil, TriangleAlert } from 'lucide-react';
import { PageHeader } from '../../../../../components/dashboard/page-header';
import { StatePanel } from '../../../../../components/dashboard/state-panel';
import { InvoiceIntakeForm } from '../../../../../components/forms/invoice-intake-form';
import { useDashboardSession } from '../../../../../components/layout/dashboard-session';
import { WorkspaceLoader } from '../../../../../components/layout/workspace-loader';
import type { ExistingInvoiceAttachment, InvoiceIntakeFormSubmitInput, InvoiceIntakeFormValues } from '../../../../../components/forms/types';
import { getPiDisplayMeta } from '../../../../../lib/client/pi-display';
import { pickProductReimbursementAttachment, pickReferencePoAttachment } from '../../../../../lib/shared/submission-attachments';
import { handleAuthTokenRecoveryMessage } from '../../../../../lib/client/auth-recovery';
import { canSubmitInvoice, getDefaultDashboardPath } from '../../../../../lib/client/dashboard-access';
import { parseBillingAddress } from '../../../../../lib/shared/address-utils';

export default function NewSubmissionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resubmitId = searchParams.get('resubmit_id');
  const viewId = searchParams.get('view_id');
  const activeSubmissionId = resubmitId || viewId;
  const isViewMode = Boolean(viewId && !resubmitId);
  const { user, loading } = useDashboardSession();
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitPi, setSubmitPi] = useState({ label: '', description: '' });
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [prefillValues, setPrefillValues] = useState<Partial<InvoiceIntakeFormValues> | null>(null);
  const [loadedSubmission, setLoadedSubmission] = useState<{ id: string; intake_status: string | null; canEdit: boolean } | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillError, setPrefillError] = useState('');
  const [resubmissionNote, setResubmissionNote] = useState('');
  const [showResubmissionNote, setShowResubmissionNote] = useState(false);
  const [existingReimbursementAttachment, setExistingReimbursementAttachment] = useState<ExistingInvoiceAttachment | null>(null);
  const [existingReferencePoAttachment, setExistingReferencePoAttachment] = useState<ExistingInvoiceAttachment | null>(null);

  function toExistingInvoiceAttachment(attachment: {
    id: string;
    document_type: string;
    file_name: string;
    file_size_bytes: number;
    mime_type: string;
  } | null): ExistingInvoiceAttachment | null {
    if (!attachment) return null;
    return {
      id: attachment.id,
      documentType: attachment.document_type,
      fileName: attachment.file_name,
      fileSizeBytes: attachment.file_size_bytes,
      mimeType: attachment.mime_type,
    };
  }

  useEffect(() => {
    if (loading || !user) return;
    if (!canSubmitInvoice(user.role)) {
      router.replace(getDefaultDashboardPath(user.role));
    }
  }, [loading, router, user]);

  async function loadSubmissionDraft(id: string) {
    if (!user) return;
    setPrefillLoading(true);
    setPrefillError('');
    setResubmissionNote('');
    setExistingReimbursementAttachment(null);
    setExistingReferencePoAttachment(null);
    try {
      const routesToTry: Array<{ route: string; canEdit: boolean }> = [];
      if (user.role === 'employee') {
        routesToTry.push({ route: `/api/submissions/my?submission_id=${encodeURIComponent(id)}`, canEdit: true });
      } else if (user.role === 'team_lead') {
        routesToTry.push({ route: `/api/submissions/my?submission_id=${encodeURIComponent(id)}`, canEdit: true });
        routesToTry.push({ route: `/api/submissions/team?submission_id=${encodeURIComponent(id)}`, canEdit: false });
      } else if (isViewMode && (user.role === 'finance' || user.role === 'admin')) {
        routesToTry.push({ route: `/api/submissions/finance?submission_id=${encodeURIComponent(id)}`, canEdit: false });
      } else {
        routesToTry.push({ route: `/api/submissions/my?submission_id=${encodeURIComponent(id)}`, canEdit: true });
      }

      let found: unknown = null;
      let foundCanEdit = true;
      for (const { route, canEdit } of routesToTry) {
        const res = await fetch(route, { method: 'GET', cache: 'no-store' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.success) continue;
        const candidate = (body.submissions ?? []).find((item: { id: string }) => String(item.id) === id);
        if (candidate) {
          found = candidate;
          foundCanEdit = canEdit;
          break;
        }
      }

      const foundRecord = found as
        | ({
            id: string;
            business_line?: 'TM' | 'IM' | null;
            entry_type?: 'SC' | 'MC' | null;
            entity_type?: 'Agency' | 'Brand' | null;
            client_type?: 'Indian' | 'Foreign' | null;
            agency_brand_name?: string | null;
            agency_brand_trade_name?: string | null;
            brand_name?: string | null;
            gst_number?: string | null;
            address?: string | null;
            invoice_type?: string | null;
            bill_due?: string | null;
            additional_agency_commission?: number | string | null;
            reimbursement_amount?: number | string | null;
            reimbursement_receipts?: string | null;
            additional_information?: string | null;
            currency?: string | null;
            creator_creators_name?: string | null;
            deliverables?: string | null;
            commercials?: number | string | null;
            campaign_code?: string | null;
            campaign_name?: string | null;
            campaign_brand?: string | null;
            campaign_notes?: string | null;
            finance_comment?: string | null;
            rejection_note?: string | null;
            submitted_by_name?: string | null;
            submitted_by_email?: string | null;
            submission_attachments?: Array<{
              id: string;
              document_type: string;
              file_name: string;
              file_size_bytes: number;
              mime_type: string;
              uploaded_at?: string | null;
            }>;
            intake_line_items?: Array<{
              creator_name?: string | null;
              brand_name?: string | null;
              deliverable_name?: string | null;
              amount?: number | null;
            }>;
          } & Record<string, unknown>)
        | undefined;
      if (!foundRecord) throw new Error('Submission not found.');
      setLoadedSubmission({ id: String(foundRecord.id ?? id), intake_status: String(foundRecord.intake_status ?? ''), canEdit: foundCanEdit });
      setResubmissionNote(String(foundRecord.finance_comment ?? foundRecord.rejection_note ?? '').trim());
      setExistingReimbursementAttachment(toExistingInvoiceAttachment(pickProductReimbursementAttachment(foundRecord.submission_attachments)));
      setExistingReferencePoAttachment(toExistingInvoiceAttachment(pickReferencePoAttachment(foundRecord.submission_attachments)));

      const lineItems = Array.isArray(foundRecord.intake_line_items) ? foundRecord.intake_line_items : [];
      const parsedAddress = parseBillingAddress(String(foundRecord.address ?? ''), foundRecord.client_type === 'Foreign' ? 'Foreign' : 'Indian');

      const businessLine = (foundRecord.business_line === 'IM' ? 'IM' : 'TM') as InvoiceIntakeFormValues['businessLine'];
      const entryType = (
        businessLine === 'TM'
          ? foundRecord.entry_type === 'MC'
            ? 'MC'
            : foundRecord.entry_type === 'SC'
              ? 'SC'
              : lineItems.length > 1 && lineItems.some((item: { creator_name?: string | null }) => item.creator_name)
                ? 'MC'
                : 'SC'
          : 'SC'
      ) as InvoiceIntakeFormValues['entryType'];

      const scRows = lineItems
        .map((item: { deliverable_name?: string | null; amount?: number | null }) => ({
          deliverable: item.deliverable_name ?? '',
          amount: item.amount ? String(item.amount) : '',
        }))
        .filter((item: { deliverable: string; amount: string }) => item.deliverable || item.amount);

      const mcRows = lineItems
        .map((item: { creator_name?: string | null; brand_name?: string | null; deliverable_name?: string | null; amount?: number | null }) => ({
          creator: item.creator_name ?? '',
          brand: item.brand_name ?? '',
          deliverable: item.deliverable_name ?? '',
          amount: item.amount ? String(item.amount) : '',
        }))
        .filter((item: { creator: string; brand: string; deliverable: string; amount: string }) => item.creator || item.brand || item.deliverable || item.amount);

      const imDeliverables = String(foundRecord.deliverables ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      const commercialsValue = Number(foundRecord.commercials ?? 0);

      const nextPrefill: Partial<InvoiceIntakeFormValues> = {
        businessLine,
        entryType,
        entityType: foundRecord.entity_type === 'Brand' ? 'Brand' : 'Agency',
        clientType: foundRecord.client_type === 'Foreign' ? 'Foreign' : 'Indian',
        agencyBrandName: foundRecord.agency_brand_name ?? '',
        agencyBrandTradeName: foundRecord.agency_brand_trade_name ?? '',
        billingBrandName: foundRecord.brand_name || '',
        gstNumber: String(foundRecord.gst_number ?? ''),
        addressLine: parsedAddress.addressLine,
        city: parsedAddress.city,
        state: parsedAddress.state,
        country: parsedAddress.country,
        pincode: parsedAddress.pincode,
        invoiceType: foundRecord.invoice_type ?? '',
        billDue: foundRecord.bill_due ?? '',
        commission: foundRecord.additional_agency_commission ? String(foundRecord.additional_agency_commission) : '',
        reimbursementIncluded: Number(foundRecord.reimbursement_amount ?? 0) > 0 ? 'yes' : 'no',
        reimbursementAmount: foundRecord.reimbursement_amount ? String(foundRecord.reimbursement_amount) : '0',
        reimbursementProof: foundRecord.reimbursement_receipts ?? '',
        additionalInformation: foundRecord.additional_information ?? '',
        scCreator: foundRecord.creator_creators_name ?? mcRows[0]?.creator ?? '',
        scBrand: foundRecord.brand_name ?? mcRows[0]?.brand ?? '',
        campaignCode: foundRecord.campaign_code ?? '',
        campaignName: foundRecord.campaign_name ?? '',
        campaignBrand: foundRecord.campaign_brand ?? foundRecord.brand_name ?? '',
        campaignDeliverable: imDeliverables[0] ?? '',
        campaignExtraDeliverables: imDeliverables.slice(1),
        campaignNotes: foundRecord.campaign_notes ?? '',
        currency: (String(foundRecord.currency ?? 'INR').toUpperCase() as InvoiceIntakeFormValues["currency"]) || 'INR',
        imCommercials: commercialsValue > 0 ? String(commercialsValue) : '',
      };

      if (user.role === 'team_lead' && !foundCanEdit) {
        const ownerName = String(foundRecord.submitted_by_name ?? '').trim();
        const ownerEmail = String(foundRecord.submitted_by_email ?? '').trim();
        if (ownerName) nextPrefill.submitterName = ownerName;
        if (ownerEmail) nextPrefill.submitterEmail = ownerEmail;
      }

      if (businessLine === 'TM') {
        nextPrefill.scDeliverables = scRows;
        nextPrefill.mcRows = mcRows;
      }

      setPrefillValues(nextPrefill);
    } catch (error) {
      setLoadedSubmission(null);
      setPrefillError(error instanceof Error ? error.message : 'Unable to load submission.');
    } finally {
      setPrefillLoading(false);
    }
  }

  useEffect(() => {
    setPrefillValues(null);
    setLoadedSubmission(null);
    setPrefillError('');
    setResubmissionNote('');
    setShowResubmissionNote(false);
    setExistingReimbursementAttachment(null);
    setExistingReferencePoAttachment(null);
  }, [activeSubmissionId]);

  useEffect(() => {
    if (!user) return;
    if (!activeSubmissionId) return;
    if (prefillValues || prefillLoading) return;
    void loadSubmissionDraft(activeSubmissionId);
  }, [activeSubmissionId, prefillLoading, prefillValues, user]);

  async function handleCreateSubmit(submission: InvoiceIntakeFormSubmitInput) {
    const { payload, files } = submission;
    setSubmitMessage('');
    setSubmitSuccess(false);

    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));
    if (files?.productReimbursementFile) {
      formData.append('product_reimbursement_file', files.productReimbursementFile);
    }
    if (files?.referencePoFile) {
      formData.append('reference_po_file', files.referencePoFile);
    }
    if (submission.existingProductReimbursementAttachment) {
      formData.append('existing_product_reimbursement_attachment', '1');
    }
    if (submission.retainProductReimbursementAttachment) {
      formData.append('retain_product_reimbursement_attachment', '1');
    }
    if (submission.removeProductReimbursementAttachment) {
      formData.append('remove_product_reimbursement_attachment', '1');
    }
    if (submission.retainReferencePoAttachment) {
      formData.append('retain_reference_po_attachment', '1');
    }
    if (submission.removeReferencePoAttachment) {
      formData.append('remove_reference_po_attachment', '1');
    }

    const res = await fetch('/api/submissions/create', {
      method: 'POST',
      body: formData,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.success) {
      const detail = body?.error || body?.message || 'Submission failed.';
      const stage = body?.stage ? ` (${body.stage})` : '';
      const nextMessage = `${detail}${stage}`;
      if (handleAuthTokenRecoveryMessage(nextMessage)) return;
      throw new Error(nextMessage);
    }

    setSubmitPi(
      getPiDisplayMeta({
        pi: body?.pi_number ?? '',
        submittedAt: new Date().toISOString(),
        invoiceType: payload.invoice_type,
        lineItems: payload.line_items,
      })
    );
    setSubmitMessage('Your intake has been recorded and sent into the finance review workflow.');
    setSubmitSuccess(true);
    setTimeout(() => router.push('/dashboard/submissions'), 1800);
  }

  if (loading || !user) return null;
  if (!canSubmitInvoice(user.role)) return null;

  return (
    <main className="intake-shell">
      <PageHeader
        title={
          <span
            className="intake-page-title"
            style={resubmitId ? { color: 'rgb(225 29 72)' } : undefined}
          >
            {isViewMode ? 'Submission View' : resubmitId ? 'Resubmission' : 'New Submission'}
          </span>
        }
        description={
          <span className="intake-page-copy">
            {isViewMode ? 'Read-only submission view for reviewing all intake details.' : 'Prepare a billing intake for finance review using the CREATE ledger workflow.'}
          </span>
        }
        actions={isViewMode ? (
          prefillLoading ? (
            <button
              className="btn btn-primary inline-flex items-center justify-center gap-2"
              style={{ minWidth: 116 }}
              type="button"
              disabled
            >
              <Pencil size={14} strokeWidth={2.2} />
              <span>Edit</span>
            </button>
          ) : loadedSubmission?.canEdit ? (
            <button
              className="btn btn-primary inline-flex items-center justify-center gap-2"
              style={{ minWidth: 116 }}
              type="button"
              onClick={() => router.push('/dashboard/submissions/new?resubmit_id=' + loadedSubmission.id)}
            >
              <Pencil size={14} strokeWidth={2.2} />
              <span>Edit</span>
            </button>
          ) : null
        ) : null}
        className="intake-page-header-compact border-b-0 lg:items-center"
      />
      {!isViewMode ? (
        <section className="intake-banner">
          <p className="text-muted" style={{ margin: 0 }}>
            Review all fields carefully before final submit. Once submitted, finance will process this intake in the workflow.
          </p>
        </section>
      ) : null}

      {resubmitId ? (
        <section className="intake-banner">
          <div style={{ display: 'grid', gap: 6 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>
              You are editing a previous submission. Submitting will create a new version.
            </p>
          </div>
        </section>
      ) : isViewMode ? (
        <section className="intake-banner">
          <p className="text-muted" style={{ margin: 0 }}>
            {loadedSubmission && !loadedSubmission.canEdit && user?.role === 'team_lead'
              ? "Read-only submission view. Team leads can't edit employee submissions."
              : 'Read-only submission view. Use Edit if you need to reopen this intake for resubmission.'}
          </p>
        </section>
      ) : null}

      {submitSuccess ? (
        <section className="intake-section" style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
          <div className="intake-section-body" style={{ textAlign: 'center', display: 'grid', gap: 16, padding: 32 }}>
            <div style={{ width: 64, height: 64, borderRadius: 999, margin: '0 auto', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(16,185,129,0.24))', border: '1px solid rgba(34,197,94,0.28)', color: '#16a34a', fontSize: 30, fontWeight: 700 }}>
              &#10003;
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <h2 className="intake-section-title" style={{ margin: 0 }}>Submission Successful!</h2>
              <p className="text-muted" style={{ margin: 0 }}>{submitMessage}</p>
            </div>
            <div className="surface" style={{ padding: 16 }}>
              <div className="text-muted" style={{ fontSize: 12 }}>PI / Proforma Invoice Number</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{submitPi.label || 'Generated'}</div>
              {submitPi.description ? (
                <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{submitPi.description}</div>
              ) : null}
            </div>
            <button className="btn btn-primary" type="button" disabled>
              Redirecting to Submissions...
            </button>
          </div>
        </section>
      ) : (
        <>
          <InvoiceIntakeForm
            currentUserRole={user.role}
            currentUserBusinessLine={user.business_line ?? null}
            submitterName={prefillValues?.submitterName || user.full_name || ''}
            submitterEmail={prefillValues?.submitterEmail || user.email || ''}
            initialValues={prefillValues}
            previousSubmissionId={activeSubmissionId || undefined}
            existingProductReimbursementAttachment={Boolean(existingReimbursementAttachment)}
            existingProductReimbursementAttachmentMeta={existingReimbursementAttachment}
            existingReferencePoAttachment={existingReferencePoAttachment}
            submitEnabled={!isViewMode}
            viewOnly={isViewMode}
            onSubmit={isViewMode ? undefined : handleCreateSubmit}
          />
          {resubmitId ? (
            <div className="pointer-events-none fixed right-6 top-28 z-30 hidden lg:block">
              <button
                type="button"
                onClick={() => setShowResubmissionNote(true)}
                className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-300/80 bg-rose-500/10 text-lg font-semibold text-rose-700 shadow-sm transition-none hover:bg-rose-500/15 hover:text-rose-800 dark:border-rose-300/40 dark:bg-rose-400/10 dark:text-rose-200 dark:hover:bg-rose-400/15"
                aria-label="Open resubmission note"
                title="Open resubmission note"
              >
                  <TriangleAlert size={18} strokeWidth={2.2} />
                </button>
            </div>
          ) : null}
        </>
      )}
      {prefillLoading ? <WorkspaceLoader variant="section" label="Loading previous submission..." /> : null}
      {prefillError ? <StatePanel tone="danger">{prefillError}</StatePanel> : null}
      {showResubmissionNote ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4 backdrop-blur-[2px] transition-opacity duration-150 ease-out"
          onClick={() => setShowResubmissionNote(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-rose-200/80 bg-card p-4 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)] transition-all duration-150 ease-out dark:border-rose-300/20"
            style={{ transformOrigin: 'center', animation: 'resubmissionNotePop 160ms ease-out' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">Resubmission Note</div>
                <div className="mt-1 text-xs text-muted-foreground">Finance feedback for this resubmission.</div>
              </div>
              <button
                type="button"
                onClick={() => setShowResubmissionNote(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 text-rose-600 transition-none hover:bg-rose-500/10 dark:border-rose-300/20 dark:text-rose-300"
                aria-label="Close resubmission note"
              >
                &times;
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-border/70 bg-muted/20 p-3 text-sm leading-6 text-foreground">
              {resubmissionNote || 'No resubmission note available.'}
            </div>
          </div>
        </div>
      ) : null}
      <style jsx>{`
        @keyframes resubmissionNotePop {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .intake-submit-success {
          animation: intakeSuccessPulse 900ms ease;
        }
        @keyframes intakeSuccessPulse {
          0% {
            opacity: 0;
            transform: translateY(6px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
