"use client";

import { InvoiceIntakeForm } from '../../../../../components/forms/invoice-intake-form';
import { useDashboardSession } from '../../../../../components/layout/dashboard-session';

export default function NewSubmissionPage() {
  const { user, loading } = useDashboardSession();

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
          Final submission is still intentionally disabled until the existing create endpoint is connected to this form flow.
        </p>
      </section>

      <InvoiceIntakeForm submitterName={user.full_name || ''} submitterEmail={user.email || ''} submitEnabled={false} />
    </main>
  );
}
