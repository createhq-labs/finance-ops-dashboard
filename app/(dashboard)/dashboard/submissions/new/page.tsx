"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { InvoiceIntakeForm } from '../../../../../components/forms/invoice-intake-form';
import { useDashboardSession } from '../../../../../components/layout/dashboard-session';
import type { InvoiceIntakeSubmissionPayload } from '../../../../../components/forms/types';

export default function NewSubmissionPage() {
  const router = useRouter();
  const { user, loading } = useDashboardSession();
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  if (loading || !user) return null;

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
        submitEnabled
        onSubmit={handleCreateSubmit}
      />
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
