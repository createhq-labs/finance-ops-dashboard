"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { InvoiceIntakeForm } from '../../../../../components/forms/invoice-intake-form';
import { useDashboardSession } from '../../../../../components/layout/dashboard-session';
import type { InvoiceIntakeFormValues, InvoiceIntakeSubmissionPayload } from '../../../../../components/forms/types';

export default function NewSubmissionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resubmitId = searchParams.get('resubmit_id');
  const { user, loading } = useDashboardSession();
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [prefillValues, setPrefillValues] = useState<Partial<InvoiceIntakeFormValues> | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillError, setPrefillError] = useState('');

  async function loadResubmitDraft(id: string) {
    setPrefillLoading(true);
    setPrefillError('');
    try {
      const res = await fetch('/api/submissions/my', { method: 'GET', cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) throw new Error(body?.error || 'Unable to load submission for resubmit.');

      const found = (body.submissions ?? []).find((item: { id: string }) => String(item.id) === id);
      if (!found) throw new Error('Submission not found for resubmit.');

      const meta = (found.integration_metadata ?? {}) as Record<string, string>;
      const lineItems = Array.isArray(found.intake_line_items) ? found.intake_line_items : [];
      const addressParts = String(found.address ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);

      const inferredAddressLine = addressParts[0] ?? '';
      const inferredCity = meta.city || addressParts[1] || '';
      const inferredState = meta.state || addressParts[2] || '';
      const inferredCountry = meta.country || addressParts[3] || '';
      const inferredPincode = meta.pincode || addressParts[4] || '';

      const businessLine = (meta.businessLine === 'IM' ? 'IM' : 'TM') as InvoiceIntakeFormValues['businessLine'];
      const entryType = (meta.entryType === 'MC' ? 'MC' : 'SC') as InvoiceIntakeFormValues['entryType'];

      const scRows = lineItems
        .map((item: { deliverable_name?: string; amount?: number }) => ({
          deliverable: item.deliverable_name ?? '',
          amount: item.amount ? String(item.amount) : '',
        }))
        .filter((item: { deliverable: string; amount: string }) => item.deliverable || item.amount);

      const mcRows = lineItems
        .map((item: { creator_name?: string; brand_name?: string; deliverable_name?: string; amount?: number }) => ({
          creator: item.creator_name ?? '',
          brand: item.brand_name ?? '',
          deliverable: item.deliverable_name ?? '',
          amount: item.amount ? String(item.amount) : '',
        }))
        .filter((item: { creator: string; brand: string; deliverable: string; amount: string }) => item.creator || item.brand || item.deliverable || item.amount);

      const nextPrefill: Partial<InvoiceIntakeFormValues> = {
        businessLine,
        entryType: businessLine === 'TM' ? entryType : 'SC',
        entityType: meta.entityType === 'Brand' ? 'Brand' : 'Agency',
        clientType: meta.clientType === 'Foreign' ? 'Foreign' : (found.gst_number ? 'Indian' : 'Foreign'),
        agencyBrandName: found.agency_brand_name ?? '',
        agencyBrandTradeName: found.agency_brand_trade_name ?? '',
        billingBrandName: meta.billingBrandName || found.brand_name || '',
        gstNumber: String(found.gst_number ?? ''),
        addressLine: inferredAddressLine,
        city: inferredCity,
        state: inferredState,
        country: inferredCountry,
        pincode: inferredPincode,
        invoiceType: found.invoice_type ?? '',
        billDue: found.bill_due ?? '',
        commission: found.additional_agency_commission ? String(found.additional_agency_commission) : '',
        reimbursementIncluded: Number(found.reimbursement_amount ?? 0) > 0 ? 'yes' : 'no',
        reimbursementAmount: found.reimbursement_amount ? String(found.reimbursement_amount) : '0',
        reimbursementProof: found.reimbursement_receipts ?? '',
        additionalInformation: found.additional_information ?? '',
        scCreator: found.creator_creators_name ?? '',
        scBrand: found.brand_name ?? '',
        campaignBrand: found.brand_name ?? '',
        campaignDeliverable: found.deliverables ?? '',
        imCommercials: found.commercials ? String(found.commercials) : '',
      };

      if (scRows.length > 0) nextPrefill.scDeliverables = scRows;
      if (mcRows.length > 0) nextPrefill.mcRows = mcRows;

      setPrefillValues(nextPrefill);
    } catch (error) {
      setPrefillError(error instanceof Error ? error.message : 'Unable to prefill resubmission.');
    } finally {
      setPrefillLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    if (!resubmitId) return;
    if (prefillValues || prefillLoading || prefillError) return;
    void loadResubmitDraft(resubmitId);
  }, [prefillError, prefillLoading, prefillValues, resubmitId, user]);

  async function handleCreateSubmit(payload: InvoiceIntakeSubmissionPayload) {
    setSubmitMessage('');
    setSubmitSuccess(false);

    const res = await fetch('/api/submissions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.success) {
      const detail = body?.error || body?.message || 'Submission failed.';
      const stage = body?.stage ? ` (${body.stage})` : '';
      throw new Error(`${detail}${stage}`);
    }

    const pi = body?.pi_number ? ` PI: ${body.pi_number}` : '';
    setSubmitMessage(`Submission created.${pi}`);
    setSubmitSuccess(true);
    setTimeout(() => router.push('/dashboard/submissions'), 1400);
  }

  if (loading || !user) return null;

  return (
    <main className="intake-shell">
      <header className="intake-page-header">
        <div>
          <p className="intake-eyebrow">CREATE Ledger Intake</p>
          <h1 className="intake-page-title">New Submission</h1>
          <p className="text-muted intake-page-copy">
            Prepare a billing intake for finance review using the CREATE ledger flow adapted for this dashboard.
          </p>
        </div>
      </header>

      <section className="intake-banner">
        <p className="text-muted" style={{ margin: 0 }}>
          Review all fields carefully before final submit. Once submitted, finance will process this intake in the workflow.
        </p>
      </section>

      <InvoiceIntakeForm
        submitterName={user.full_name || ''}
        submitterEmail={user.email || ''}
        initialValues={prefillValues}
        previousSubmissionId={resubmitId}
        submitEnabled
        onSubmit={handleCreateSubmit}
      />
      {prefillLoading ? <p className="text-muted">Loading previous submission...</p> : null}
      {prefillError ? <p className="text-danger">{prefillError}</p> : null}
      {submitMessage ? <p className={submitSuccess ? 'text-success intake-submit-success' : 'text-success'}>{submitMessage}</p> : null}
      <style jsx>{`
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
