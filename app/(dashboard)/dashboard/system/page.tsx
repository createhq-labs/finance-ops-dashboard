"use client";

import { KpiCard } from '../../../../components/dashboard/kpi-card';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';

export default function SystemPage() {
  const { user, loading } = useDashboardSession();

  if (loading || !user) return null;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ margin: 0 }}>System Status</h1>
        <p className="text-muted">Developer and admin visibility for sync monitoring, logs, and technical status only.</p>
      </header>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <KpiCard title="Failed Syncs" value="1" hint="Google Sheets mirror retry later" />
        <KpiCard title="Auth Route" value="Healthy" hint="Company-domain login gate active" />
        <KpiCard title="Finance Queue Logs" value="Available" hint="Read-only monitoring" />
      </section>

      <div className="surface" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Developer Scope</h2>
        <p className="text-muted" style={{ marginBottom: 0 }}>
          This page is intentionally separated from finance review. Developer users can inspect failures and technical health here, but do not get finance approval controls.
        </p>
      </div>
    </div>
  );
}
