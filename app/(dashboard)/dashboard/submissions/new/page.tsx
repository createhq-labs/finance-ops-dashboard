"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '../../../../../components/dashboard/page-header';
import { StatePanel } from '../../../../../components/dashboard/state-panel';
import { InvoiceIntakeForm } from '../../../../../components/forms/invoice-intake-form';
import { useDashboardSession } from '../../../../../components/layout/dashboard-session';
import type { InvoiceIntakeFormValues, InvoiceIntakeSubmissionPayload } from '../../../../../components/forms/types';
import { canSubmitInvoice, getDefaultDashboardPath } from '../../../../../lib/client/dashboard-access';

function cleanPrefillAddress(address: string, parts: Array<string | null | undefined>) {
  const normalizedAddress = String(address || '').trim().replace(/^"+|"+$/g, '');
  if (!normalizedAddress) return '';

  const tokensToRemove = parts
    .filter(Boolean)
    .map((value) => String(value).trim().replace(/^"+|"+$/g, '').toLowerCase());

  const addressParts = normalizedAddress
    .split(',')
    .map((part) => part.trim().replace(/^"+|"+$/g, ''))
    .filter(Boolean);

  while (addressParts.length && tokensToRemove.includes(addressParts[addressParts.length - 1].toLowerCase())) {
    addressParts.pop();
  }

  return addressParts.join(', ') || normalizedAddress;
}

export default function NewSubmissionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resubmitId = searchParams.get('resubmit_id');
  const { user, loading } = useDashboardSession();
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitPi, setSubmitPi] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [prefillValues, setPrefillValues] = useState<Partial<InvoiceIntakeFormValues> | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillError, setPrefillError] = useState('');

  useEffect(() => {
    if (loading || !user) return;
    if (!canSubmitInvoice(user.role)) {
      router.replace(getDefaultDashboardPath(user.role));
    }
  }, [loading, router, user]);

  async function loadResubmitDraft(id: string) {
    setPrefillLoading(true);
    setPrefillError('');
    try {
      const res = await fetch('/api/submissions/my', { method: 'GET', cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) throw new Error(body?.error || 'Unable to load submission for resubmit.');

      const found = (body.submissions ?? []).find((item: { id: string }) => String(item.id) === id) as
        | ({
            id: string;
            business_line?: 'TM' | 'IM' | null;
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
            creator_creators_name?: string | null;
            deliverables?: string | null;
            commercials?: number | string | null;
            campaign_code?: string | null;
            campaign_name?: string | null;
            campaign_brand?: string | null;
            campaign_notes?: string | null;
            integration_metadata?: Record<string, string>;
            intake_line_items?: Array<{
              creator_name?: string | null;
              brand_name?: string | null;
              deliverable_name?: string | null;
              amount?: number | null;
            }>;
          } & Record<string, unknown>)
        | undefined;
      if (!found) throw new Error('Submission not found for resubmit.');

      const meta = (found.integration_metadata ?? {}) as Record<string, string>;
      const lineItems = Array.isArray(found.intake_line_items) ? found.intake_line_items : [];
      const inferredCity = String(meta.city ?? '').trim();
      const inferredState = String(meta.state ?? '').trim();
      const inferredCountry = String(meta.country ?? '').trim();
      const inferredPincode = String(meta.pincode ?? '').trim();
      const inferredAddressLine = cleanPrefillAddress(String(found.address ?? ''), [
        inferredPincode,
        inferredCountry,
        inferredState,
        inferredCity,
      ]);

      const businessLine = ((found.business_line || meta.businessLine) === 'IM' ? 'IM' : 'TM') as InvoiceIntakeFormValues['businessLine'];
      const entryType = (
        businessLine === 'TM'
          ? meta.entryType === 'MC'
            ? 'MC'
            : meta.entryType === 'SC'
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

      const imDeliverables = String(found.deliverables ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      const commissionValue = Number(found.additional_agency_commission ?? 0);
      const commercialsValue = Number(found.commercials ?? 0);

      const nextPrefill: Partial<InvoiceIntakeFormValues> = {
        businessLine,
        entryType,
        entityType: (found.entity_type || meta.entityType) === 'Brand' ? 'Brand' : 'Agency',
        clientType: (found.client_type || meta.clientType) === 'Foreign' ? 'Foreign' : 'Indian',
        agencyBrandName: found.agency_brand_name ?? '',
        agencyBrandTradeName: found.agency_brand_trade_name ?? '',
        billingBrandName: found.brand_name || meta.billingBrandName || '',
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
        scCreator: found.creator_creators_name ?? mcRows[0]?.creator ?? '',
        scBrand: found.brand_name ?? mcRows[0]?.brand ?? '',
        campaignCode: found.campaign_code ?? meta.campaignCode ?? '',
        campaignName: found.campaign_name ?? meta.campaignName ?? '',
        campaignBrand: found.campaign_brand ?? meta.campaignBrand ?? found.brand_name ?? '',
        campaignDeliverable: imDeliverables[0] ?? '',
        campaignExtraDeliverables: imDeliverables.slice(1),
        campaignNotes: found.campaign_notes ?? meta.campaignNotes ?? '',
        imCommercials: commercialsValue > 0 ? String(Math.max(commercialsValue - commissionValue, 0)) : '',
      };

      if (businessLine === 'TM' && entryType === 'SC' && scRows.length > 0) nextPrefill.scDeliverables = scRows;
      if (businessLine === 'TM' && entryType === 'MC' && mcRows.length > 0) nextPrefill.mcRows = mcRows;

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

    setSubmitPi(body?.pi_number || '');
    setSubmitMessage('Your intake has been recorded and sent into the finance review workflow.');
    setSubmitSuccess(true);
    setTimeout(() => router.push('/dashboard/submissions'), 1800);
  }

  if (loading || !user) return null;
  if (!canSubmitInvoice(user.role)) return null;

  return (
    <main className="intake-shell">
      <PageHeader
        eyebrow="CREATE Ledger Intake"
        title={<span className="intake-page-title">New Submission</span>}
        description={<span className="intake-page-copy">Prepare a billing intake for finance review using the CREATE ledger flow adapted for this dashboard.</span>}
      />

      <section className="intake-banner">
        <p className="text-muted" style={{ margin: 0 }}>
          Review all fields carefully before final submit. Once submitted, finance will process this intake in the workflow.
        </p>
      </section>

      {resubmitId ? (
        <section className="intake-banner">
          <p style={{ margin: 0, fontWeight: 600 }}>
            You are editing a previous submission. Submitting will create a new version.
          </p>
        </section>
      ) : null}

      {submitSuccess ? (
        <section className="intake-section" style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
          <div className="intake-section-body" style={{ textAlign: 'center', display: 'grid', gap: 16, padding: 32 }}>
            <div style={{ width: 64, height: 64, borderRadius: 999, margin: '0 auto', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(16,185,129,0.24))', border: '1px solid rgba(34,197,94,0.28)', color: '#16a34a', fontSize: 30, fontWeight: 700 }}>
              ✓
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <h2 className="intake-section-title" style={{ margin: 0 }}>Submission Successful!</h2>
              <p className="text-muted" style={{ margin: 0 }}>{submitMessage}</p>
            </div>
            <div className="surface" style={{ padding: 16 }}>
              <div className="text-muted" style={{ fontSize: 12 }}>PI / Proforma Invoice Number</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{submitPi || 'Generated'}</div>
            </div>
            <button className="btn btn-primary" type="button" disabled>
              Redirecting to Submissions...
            </button>
          </div>
        </section>
      ) : (
        <InvoiceIntakeForm
          submitterName={user.full_name || ''}
          submitterEmail={user.email || ''}
          initialValues={prefillValues}
          previousSubmissionId={resubmitId}
          submitEnabled
          onSubmit={handleCreateSubmit}
        />
      )}
      {prefillLoading ? <StatePanel>Loading previous submission...</StatePanel> : null}
      {prefillError ? <StatePanel tone="danger">{prefillError}</StatePanel> : null}
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
