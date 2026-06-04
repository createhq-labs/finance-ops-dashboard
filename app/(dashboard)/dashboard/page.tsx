"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { KpiCard } from '../../../components/dashboard/kpi-card';
import { PageHeader } from '../../../components/dashboard/page-header';
import { SectionCard } from '../../../components/dashboard/section-card';
import { StatePanel } from '../../../components/dashboard/state-panel';
import { SubmissionDrawer } from '../../../components/dashboard/submission-drawer';
import { type SubmissionRow } from '../../../components/dashboard/submission-table';
import { useDashboardSession } from '../../../components/layout/dashboard-session';
import { canResubmitSubmission, canSubmitInvoice, getDrawerViewerRole, getInvoiceIntakePath, getOverviewTitle, isEmployeeRole, isTeamLeadRole } from '../../../lib/client/dashboard-access';

type MySubmissionApiRow = {
  id: string;
  proforma_invoice: string | null;
  agency_brand_name: string | null;
  agency_brand_trade_name: string | null;
  gst_number: string | null;
  address: string | null;
  bill_due: string | null;
  invoice_type: string | null;
  deliverables: string | null;
  creator_creators_name: string | null;
  brand_name: string | null;
  commercials: number | string | null;
  additional_agency_commission: number | string | null;
  reimbursement_amount: number | string | null;
  reimbursement_receipts: string | null;
  additional_information: string | null;
  finance_comment?: string | null;
  creator_invoice_status?: string | null;
  payment_received_status?: string | null;
  payment_made_status?: string | null;
  closure_status?: string | null;
  intake_status: SubmissionRow['intake_status'];
  invoice_status: string | null;
  submitted_at: string | null;
  rejection_note: string | null;
};

function normalizeOverviewStatus(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function titleCaseStatus(value: string | null | undefined) {
  const normalized = normalizeOverviewStatus(value);
  if (!normalized) return 'Unknown';
  return normalized
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatMoneyCompact(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value);
}

function normalizeBusinessLine(value: string | null | undefined) {
  const normalized = normalizeOverviewStatus(value);
  if (normalized === 'tm' || normalized === 'talent_management') return 'TM';
  if (normalized === 'im' || normalized === 'influencer_marketing') return 'IM';
  return 'Other';
}

function CompactMetricCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl p-[2px] transition duration-300 hover:-translate-y-1 hover:rotate-[-0.35deg]">
      <div
        className="absolute inset-[-64%] opacity-0 transition duration-500 group-hover:opacity-100"
        style={{
          background: 'conic-gradient(from 0deg, transparent 0deg, transparent 76deg, rgba(255,255,255,0.96) 92deg, rgba(53,213,255,0.96) 108deg, transparent 126deg, transparent 360deg)',
          animation: 'overviewKpiOrbit 1.8s linear infinite',
        }}
      />
      <div
        className="relative transition duration-500 group-hover:-translate-y-1.5 group-hover:rotate-[-0.6deg] group-hover:shadow-[0_18px_38px_rgba(8,15,40,0.18)] group-hover:brightness-[1.06]"
        style={{
        borderRadius: 14,
        padding: '14px 16px',
        minHeight: 92,
        color: '#fff',
        background: 'linear-gradient(135deg, #11aee3 0%, #10c7df 58%, #45d3ef 100%)',
        boxShadow: '0 14px 34px -26px rgba(15, 104, 168, 0.7)',
        display: 'grid',
        alignContent: 'space-between',
        overflow: 'hidden',
        position: 'relative',
        transition: 'filter 180ms ease, box-shadow 180ms ease',
      }}
    >
      <div style={{ position: 'absolute', right: -24, top: -28, width: 86, height: 86, borderRadius: 999, background: 'rgba(255,255,255,0.22)' }} />
      <div style={{ position: 'absolute', left: 22, bottom: -52, width: 116, height: 116, borderRadius: 999, background: 'rgba(255,255,255,0.12)' }} />
      <div style={{ position: 'relative', display: 'grid', alignContent: 'space-between', minHeight: 64 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.9 }}>{title}</div>
      <div>
        <div style={{ fontSize: 28, lineHeight: 1, fontWeight: 800 }}>{value}</div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.88 }}>{hint}</div>
      </div>
      </div>
      </div>
      <style jsx>{`
        @keyframes overviewKpiOrbit {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

function StatusChip({ label, tone = 'cyan' }: { label: string; tone?: 'cyan' | 'green' | 'amber' | 'orange' | 'rose' | 'slate' }) {
  const palette = {
    cyan: ['rgba(14, 165, 233, 0.12)', '#0369a1', 'rgba(14, 165, 233, 0.25)'],
    green: ['rgba(34, 197, 94, 0.12)', '#047857', 'rgba(34, 197, 94, 0.25)'],
    amber: ['rgba(245, 158, 11, 0.14)', '#92400e', 'rgba(245, 158, 11, 0.28)'],
    orange: ['rgba(249, 115, 22, 0.14)', '#9a3412', 'rgba(249, 115, 22, 0.28)'],
    rose: ['rgba(244, 63, 94, 0.12)', '#be123c', 'rgba(244, 63, 94, 0.25)'],
    slate: ['rgba(100, 116, 139, 0.12)', '#475569', 'rgba(100, 116, 139, 0.25)'],
  }[tone];
  return (
    <span style={{ display: 'inline-flex', borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700, background: palette[0], color: palette[1], border: `1px solid ${palette[2]}` }}>
      {label}
    </span>
  );
}

function overviewTone(status: string | null | undefined): 'cyan' | 'green' | 'amber' | 'orange' | 'rose' | 'slate' {
  const normalized = normalizeOverviewStatus(status);
  if (normalized === 'accepted' || normalized === 'closed' || normalized === 'paid' || normalized === 'full') return 'green';
  if (normalized === 'invoice_created') return 'cyan';
  if (normalized === 'rejected' || normalized === 'partial' || normalized.includes('advance') || normalized.includes('gst')) return 'orange';
  if (normalized.includes('not_') || normalized === 'issues') return 'rose';
  if (normalized === 'cancelled') return 'slate';
  return 'amber';
}

function PremiumOverviewCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="group relative overflow-visible rounded-2xl border border-cyan-100/80 bg-white p-5 shadow-[0_18px_48px_-40px_rgba(15,104,168,0.45)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_58px_-42px_rgba(15,104,168,0.62)] dark:border-cyan-400/14 dark:bg-[#07111d]"
      style={{ minHeight: '100%' }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_18%_0%,rgba(53,213,255,0.16),transparent_38%),linear-gradient(90deg,rgba(14,165,233,0.08),transparent)] opacity-90" />
      <div className="pointer-events-none absolute -right-14 -top-16 h-36 w-36 rounded-full bg-cyan-300/12 transition duration-300 group-hover:scale-110" />
      <div className="relative">
        <div className="mb-4">
          <h2 className="text-base font-bold tracking-[-0.02em] text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

function AnimatedDonutChart({
  segments,
  centerValue,
  centerLabel,
  valueFormatter = formatMoneyCompact,
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  valueFormatter?: (value: number) => string;
}) {
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<DonutSegment | null>(null);
  const [selected, setSelected] = useState<DonutSegment | null>(null);
  const visibleSegments = segments.filter((segment) => segment.value > 0);
  const total = visibleSegments.reduce((sum, segment) => sum + segment.value, 0);
  const activeSegment = hovered || selected;
  const radius = 39;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, [segments]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 190px) minmax(0, 1fr)', gap: 24, alignItems: 'center' }}>
      <div style={{ position: 'relative', width: 184, maxWidth: '100%', aspectRatio: '1 / 1' }} onMouseLeave={() => setHovered(null)}>
        <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', filter: 'drop-shadow(0 14px 20px rgba(34, 211, 238, 0.14))' }}>
          <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(103,232,249,0.14)" strokeWidth="14" />
          {total > 0
            ? visibleSegments.map((segment) => {
              const length = (segment.value / total) * circumference;
                const gap = Math.min(2.4, Math.max(0, length * 0.065));
                const dashLength = Math.max(0, length - gap);
                const dash = ready ? `${dashLength} ${circumference - dashLength}` : `0 ${circumference}`;
                const currentOffset = -offset;
                offset += length;
                return (
                  <circle
                    key={segment.label}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={activeSegment?.label === segment.label ? 17 : 14}
                    strokeDasharray={dash}
                    strokeDashoffset={currentOffset}
                    strokeLinecap="butt"
                    opacity={hovered && hovered.label !== segment.label ? 0.34 : 1}
                    onMouseEnter={() => setHovered(segment)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setSelected((current) => (current?.label === segment.label ? null : segment))}
                    style={{ cursor: 'pointer', filter: activeSegment?.label === segment.label ? 'brightness(1.08)' : 'none', transition: 'stroke-dasharray 850ms cubic-bezier(.2,.8,.2,1), stroke-width 140ms ease, opacity 140ms ease, filter 140ms ease' }}
                  />
                );
              })
            : null}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 'clamp(1.25rem, 2.4vw, 1.75rem)', letterSpacing: '-0.06em', color: 'var(--foreground)' }}>{centerValue}</div>
            <div className="text-muted" style={{ marginTop: 2, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{centerLabel}</div>
          </div>
        </div>
        {activeSegment ? (
          <div className="absolute left-full top-1/2 z-10 ml-4 min-w-44 -translate-y-1/2 rounded-2xl border border-cyan-100 bg-white px-4 py-3 text-sm text-slate-900 shadow-[0_22px_60px_-26px_rgba(15,104,168,0.32)] dark:border-cyan-400/22 dark:bg-[#07111d] dark:text-white">
            <div style={{ fontWeight: 800 }}>{activeSegment.label}</div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 9, color: 'var(--muted-foreground)' }}>
              <span style={{ width: 11, height: 11, borderRadius: 999, background: activeSegment.color }} />
              <span style={{ color: 'var(--foreground)', fontWeight: 700 }}>{valueFormatter(activeSegment.value)}</span>
              <strong style={{ marginLeft: 'auto', color: '#06b6d4' }}>{Math.round((activeSegment.value / total) * 100)}%</strong>
            </div>
          </div>
        ) : null}
      </div>
      <div style={{ display: 'grid', gap: 9 }}>
        {total === 0 ? (
          <div className="text-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>No data available yet.</div>
        ) : (
          segments.map((segment) => (
            <div
              key={segment.label}
              onMouseEnter={() => setHovered(segment)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setSelected((current) => (current?.label === segment.label ? null : segment))}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', fontSize: 13, opacity: segment.value > 0 ? 1 : 0.55, cursor: 'pointer' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: segment.color, boxShadow: `0 0 0 4px ${segment.color}18` }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{segment.label}</span>
              </span>
              <strong style={{ whiteSpace: 'nowrap' }}>{valueFormatter(segment.value)}</strong>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function WorkflowFunnel({ steps }: { steps: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...steps.map((step) => step.count));
  return (
    <PremiumOverviewCard title="Workflow Funnel" description="Submitted to closed, with bottlenecks visible at a glance.">
      <div style={{ display: 'grid', gap: 12 }}>
        {steps.map((step) => (
          <div key={step.label} style={{ display: 'grid', gap: 7 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 44px', gap: 14, fontSize: 13, fontWeight: 800, alignItems: 'center' }}>
              <span>{step.label}</span>
              <span style={{ justifySelf: 'start', color: '#0284c7' }}>{step.count}</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: 'rgba(14, 165, 233, 0.10)', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(15, 104, 168, 0.08)' }}>
              <div style={{ width: `${Math.max(8, (step.count / max) * 100)}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #0ea5e9, #22d3ee, #67e8f9)', transition: 'width 700ms ease' }} />
            </div>
          </div>
        ))}
      </div>
    </PremiumOverviewCard>
  );
}

function BusinessLineSummary({ tm, im }: { tm: number; im: number }) {
  const total = tm + im;
  return (
    <PremiumOverviewCard title="Business Line Split" description="TM vs IM distribution for visible intake.">
      <AnimatedDonutChart
        centerValue={String(total)}
        centerLabel="Visible"
        valueFormatter={(value) => String(value)}
        segments={[
          { label: 'Talent Management', value: tm, color: '#38bdf8' },
          { label: 'Influencer Marketing', value: im, color: '#4ade80' },
        ]}
      />
    </PremiumOverviewCard>
  );
}

function PaymentSummary({
  totalValue,
  paidValue,
  pendingValue,
  invoiceValue,
  reviewValue,
}: {
  totalValue: number;
  paidValue: number;
  pendingValue: number;
  invoiceValue: number;
  reviewValue: number;
}) {
  const segments = [
    { label: 'Paid', value: paidValue, color: '#4ade80' },
    { label: 'Pending Payment', value: pendingValue, color: '#fbbf24' },
    { label: 'Invoice Created', value: invoiceValue, color: '#22d3ee' },
    { label: 'Awaiting Review', value: reviewValue, color: '#60a5fa' },
  ];

  return (
    <PremiumOverviewCard title="Payment Summary" description="Where your submitted value currently sits.">
      <AnimatedDonutChart segments={segments} centerValue={formatMoneyCompact(totalValue)} centerLabel="Total" />
    </PremiumOverviewCard>
  );
}

function SubmissionJourney({ steps }: { steps: Array<{ label: string; count: number; description?: string; tooltipLines?: string[] }> }) {
  const max = Math.max(1, ...steps.map((step) => step.count));
  return (
    <PremiumOverviewCard title="Submission Journey" description="A compact view of where your submissions are.">
      <div style={{ position: 'relative', paddingTop: 34, paddingBottom: 34 }}>
        <div style={{ position: 'absolute', left: 28, right: 28, top: '50%', height: 3, transform: 'translateY(-50%)', borderRadius: 999, background: 'linear-gradient(90deg, rgba(34,211,238,0.18), rgba(59,130,246,0.16), rgba(34,211,238,0.18))' }} />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`, gap: 12, alignItems: 'center' }}>
          {steps.map((step, index) => (
            <div key={step.label} className="group/step relative" style={{ display: 'grid', justifyItems: 'center', gap: 10, minWidth: 0 }}>
              {index % 2 === 0 ? <div style={{ minHeight: 34 }} /> : <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2, textAlign: 'center' }}>{step.label}</div>}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, #0284c7, #22d3ee)',
                  boxShadow: '0 12px 24px -16px rgba(14, 165, 233, 0.75)',
                  transform: `scale(${0.92 + Math.min(0.12, step.count / max / 8)})`,
                  transition: 'transform 180ms ease, box-shadow 180ms ease',
                }}
              >
                {step.count}
              </div>
              {index % 2 === 1 ? <div style={{ minHeight: 34 }} /> : <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2, textAlign: 'center' }}>{step.label}</div>}
              <div
                className="pointer-events-none absolute z-20 w-60 rounded-2xl border border-cyan-100 bg-white px-4 py-3 text-xs opacity-0 shadow-[0_18px_50px_-30px_rgba(15,104,168,0.36)] transition duration-150 group-hover/step:opacity-100 dark:border-cyan-400/24 dark:bg-[#07111d]"
                style={{
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bottom: index % 2 === 0 ? 'calc(100% + 8px)' : 'auto',
                  top: index % 2 === 1 ? 'calc(100% + 8px)' : 'auto',
                }}
              >
                <div style={{ fontWeight: 800, color: 'var(--foreground)' }}>{step.label}</div>
                <div className="text-muted" style={{ marginTop: 4, display: 'grid', gap: 3 }}>
                  {(step.tooltipLines || [`${step.count} ${step.description || 'submissions'}`]).map((line) => (
                    <span
                      key={line}
                      style={{
                        color: line.includes('%') || line.includes('Latest:') || line.includes('₹') ? '#0284c7' : 'var(--muted-foreground)',
                        fontWeight: line.includes('%') || line.includes('₹') ? 700 : 500,
                      }}
                    >
                      {line}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PremiumOverviewCard>
  );
}

type FinanceOverviewApiRow = MySubmissionApiRow & {
  email_address?: string | null;
  campaign_code?: string | null;
  campaign_name?: string | null;
  campaign_brand?: string | null;
  campaign_notes?: string | null;
  previous_submission_id?: string | null;
  business_line?: 'TM' | 'IM' | null;
  entity_type?: 'Agency' | 'Brand' | null;
  client_type?: 'Indian' | 'Foreign' | null;
  agency_name?: string | null;
  agency_trade_name?: string | null;
  brand_trade_name?: string | null;
  integration_metadata?: SubmissionRow['integration_metadata'];
  intake_line_items?: SubmissionRow['intake_line_items'];
  sync_status?: SubmissionRow['sync_status'];
  submitted_by_name?: string | null;
  submitted_by_email?: string | null;
};

export default function DashboardHomePage() {
  const { user, loading } = useDashboardSession();
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAllEmployeeActions, setShowAllEmployeeActions] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsError, setRowsError] = useState('');
  const [rows, setRows] = useState<SubmissionRow[]>([]);

  useEffect(() => {
    let active = true;
    if (!user) return;

    setRowsLoading(true);
    setRowsError('');
    const isOperationalRole = user.role === 'finance' || user.role === 'admin';
    fetch(isOperationalRole ? '/api/submissions/finance' : '/api/submissions/my', { method: 'GET', cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to load overview data.');
        }
        const mapped = ((json.submissions ?? []) as FinanceOverviewApiRow[]).map((item): SubmissionRow => ({
          id: String(item.id),
          pi: item.proforma_invoice || '-',
          entity: item.agency_brand_name || '-',
          amount: Number(item.commercials ?? 0),
          owner_name: item.submitted_by_name || user.full_name || undefined,
          submitter_email: item.submitted_by_email || item.email_address || undefined,
          intake_status: item.intake_status,
          invoice_status: item.invoice_status || '-',
          sync_status: item.sync_status || 'pending_sheet_sync',
          submitted_at: item.submitted_at || new Date().toISOString(),
          rejection_note: item.rejection_note || null,
          trade_name: item.agency_brand_trade_name || null,
          gst_number: item.gst_number || null,
          address: item.address || null,
          bill_due: item.bill_due || null,
          invoice_type: item.invoice_type || null,
          creator_creators_name: item.creator_creators_name || null,
          brand_name: item.brand_name || null,
          finance_comment: item.finance_comment || undefined,
          creator_invoice_received: normalizeOverviewStatus(item.creator_invoice_status) || undefined,
          payment_received: normalizeOverviewStatus(item.payment_received_status) || undefined,
          payment_made: normalizeOverviewStatus(item.payment_made_status) || undefined,
          closed_status: normalizeOverviewStatus(item.closure_status) || undefined,
          campaign_code: item.campaign_code || null,
          campaign_name: item.campaign_name || null,
          campaign_brand: item.campaign_brand || null,
          campaign_notes: item.campaign_notes || null,
          deliverables: item.deliverables || null,
          additional_agency_commission: Number(item.additional_agency_commission ?? 0),
          reimbursement_amount: Number(item.reimbursement_amount ?? 0),
          reimbursement_receipts: item.reimbursement_receipts || null,
          additional_information: item.additional_information || null,
          previous_submission_id: item.previous_submission_id || null,
          business_line: item.business_line || null,
          entity_type: item.entity_type || null,
          client_type: item.client_type || null,
          agency_name: item.agency_name || null,
          agency_trade_name: item.agency_trade_name || null,
          brand_trade_name: item.brand_trade_name || null,
          integration_metadata: item.integration_metadata || null,
          intake_line_items: item.intake_line_items || [],
        }));
        if (active) setRows(mapped);
      })
      .catch((error) => {
        if (active) setRowsError(error instanceof Error ? error.message : 'Failed to load overview data.');
      })
      .finally(() => {
        if (active) setRowsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const visibleRows = useMemo(() => [...rows].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()), [rows]);
  const employeeRecentRows = useMemo(() => visibleRows.slice(0, 5), [visibleRows]);
  const financeRecentRows = useMemo(() => visibleRows.slice(0, 6), [visibleRows]);

  const row = useMemo(() => visibleRows.find((entry) => entry.id === openId) || null, [openId, visibleRows]);

  if (loading || !user) return null;
  const isEmployee = isEmployeeRole(user.role);
  const isTeamLead = isTeamLeadRole(user.role);
  const isDeveloper = user.role === 'developer';

  if (rowsLoading) return <StatePanel>Loading overview...</StatePanel>;
  if (rowsError) return <StatePanel tone="danger">{rowsError}</StatePanel>;

  if (isEmployee) {
    const submittedCount = visibleRows.filter((entry) => entry.intake_status === 'submitted').length;
    const acceptedCount = visibleRows.filter((entry) => entry.intake_status === 'accepted').length;
    const rejectedCount = visibleRows.filter((entry) => entry.intake_status === 'rejected').length;
    const paidCount = visibleRows.filter((entry) => {
      const paymentMade = normalizeOverviewStatus(entry.payment_made);
      const paymentReceived = normalizeOverviewStatus(entry.payment_received);
      return paymentMade === 'paid' || paymentMade === 'full' || paymentReceived === 'full' || paymentReceived === 'received';
    }).length;
    const employeeActionRows = visibleRows.filter((entry) => entry.intake_status === 'rejected');
    const totalSubmittedValue = visibleRows.reduce((sum, entry) => sum + entry.amount, 0);
    const paidValue = visibleRows.reduce((sum, entry) => {
      const paymentMade = normalizeOverviewStatus(entry.payment_made);
      const paymentReceived = normalizeOverviewStatus(entry.payment_received);
      return paymentMade === 'paid' || paymentMade === 'full' || paymentReceived === 'full' || paymentReceived === 'received'
        ? sum + entry.amount
        : sum;
    }, 0);
    const awaitingReviewValue = visibleRows.reduce((sum, entry) => (entry.intake_status === 'submitted' ? sum + entry.amount : sum), 0);
    const invoiceCreatedValue = visibleRows.reduce((sum, entry) => {
      const paymentMade = normalizeOverviewStatus(entry.payment_made);
      const paymentReceived = normalizeOverviewStatus(entry.payment_received);
      const isPaid = paymentMade === 'paid' || paymentMade === 'full' || paymentReceived === 'full' || paymentReceived === 'received';
      return !isPaid && normalizeOverviewStatus(entry.invoice_status) === 'invoice_created' ? sum + entry.amount : sum;
    }, 0);
    const pendingValue = Math.max(0, totalSubmittedValue - paidValue - awaitingReviewValue - invoiceCreatedValue);
    const invoiceCreatedCount = visibleRows.filter((entry) => normalizeOverviewStatus(entry.invoice_status) === 'invoice_created').length;
    const latestSubmitted = visibleRows.find((entry) => entry.intake_status === 'submitted');
    const totalSubmissionCount = visibleRows.length;
    const percentOfTotal = (count: number) => (totalSubmissionCount > 0 ? `${Math.round((count / totalSubmissionCount) * 100)}%` : '');

    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <PageHeader
          title={getOverviewTitle(user.role)}
          description="Only your submissions, statuses, rejection notes, and next actions appear here."
          actions={canSubmitInvoice(user.role) ? (
            <Link href={getInvoiceIntakePath()} className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Submit Invoice
            </Link>
          ) : null}
        />

        <section style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <CompactMetricCard title="My Submitted" value={String(submittedCount)} hint="Awaiting check" />
          <CompactMetricCard title="My Checked" value={String(acceptedCount)} hint="No mistakes found" />
          <CompactMetricCard title="My Resubmissions" value={String(rejectedCount)} hint="Needs correction" />
          <CompactMetricCard title="My Paid" value={String(paidCount)} hint="Payment complete" />
        </section>

        <PremiumOverviewCard title="Items Needing Action" description="Submissions returned by finance for correction.">
          {employeeActionRows.length === 0 ? (
            <div className="text-muted">No correction requests right now.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span className="text-muted" style={{ fontSize: 13 }}>
                  {employeeActionRows.length} item{employeeActionRows.length > 1 ? 's' : ''} need attention
                </span>
                <button className="btn" type="button" onClick={() => setShowAllEmployeeActions((current) => !current)}>
                  {showAllEmployeeActions ? 'Collapse' : 'Expand'}
                </button>
              </div>
              <div style={{ display: 'grid', gap: 10, maxHeight: showAllEmployeeActions ? 320 : undefined, overflowY: showAllEmployeeActions ? 'auto' : 'visible', paddingRight: showAllEmployeeActions ? 4 : 0 }}>
              {(showAllEmployeeActions ? employeeActionRows : employeeActionRows.slice(0, 2)).map((entry) => (
                <div key={`employee-action-${entry.id}`} className="surface" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', border: '1px solid var(--border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong>{entry.pi}</strong>
                      <StatusChip label="Resubmission" tone="orange" />
                    </div>
                    <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>{entry.rejection_note || 'Finance requested corrections.'}</div>
                  </div>
                  <button className="btn" type="button" onClick={() => setOpenId(entry.id)}>Open</button>
                </div>
              ))}
              </div>
            </div>
          )}
        </PremiumOverviewCard>

        <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <PaymentSummary
            totalValue={totalSubmittedValue}
            paidValue={paidValue}
            pendingValue={pendingValue}
            invoiceValue={invoiceCreatedValue}
            reviewValue={awaitingReviewValue}
          />
          <SubmissionJourney
            steps={[
              {
                label: 'Submitted',
                count: submittedCount,
                description: 'created',
                tooltipLines: [
                  `${submittedCount} submissions created`,
                  totalSubmittedValue > 0 ? `${formatMoneyCompact(totalSubmittedValue)} total submitted value` : '',
                  latestSubmitted ? `Latest: ${latestSubmitted.pi} on ${formatDateTime(latestSubmitted.submitted_at)}` : '',
                ].filter(Boolean),
              },
              {
                label: 'Checked',
                count: acceptedCount,
                description: 'reviewed',
                tooltipLines: [
                  `${acceptedCount} reviewed`,
                  percentOfTotal(acceptedCount) ? `${percentOfTotal(acceptedCount)} of your submissions checked` : '',
                ].filter(Boolean),
              },
              {
                label: 'Invoice Created',
                count: invoiceCreatedCount,
                description: 'invoice stage',
                tooltipLines: [
                  `${invoiceCreatedCount} in invoice stage`,
                  percentOfTotal(invoiceCreatedCount) ? `${percentOfTotal(invoiceCreatedCount)} moved to invoice stage` : '',
                ].filter(Boolean),
              },
              {
                label: 'Paid',
                count: paidCount,
                description: 'completed',
                tooltipLines: [
                  `${paidCount} completed`,
                  percentOfTotal(paidCount) ? `${percentOfTotal(paidCount)} paid` : '',
                  paidValue > 0 ? `${formatMoneyCompact(paidValue)} paid amount` : '',
                ].filter(Boolean),
              },
            ]}
          />
        </section>

        <PremiumOverviewCard title="Recent Updates" description="Latest submission changes and recent submissions.">
          <div>
            {visibleRows.length === 0 ? (
              <div className="text-muted">No recent updates yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {employeeRecentRows.map((entry) => (
                  <div
                    key={`recent-${entry.id}`}
                    className="surface"
                    style={{ padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{entry.pi}</div>
                      <div style={{ marginTop: 6 }}>
                        <StatusChip label={titleCaseStatus(entry.intake_status)} tone={overviewTone(entry.intake_status)} />
                      </div>
                      <div className="text-muted" style={{ fontSize: 13 }}>
                        {formatDateTime(entry.submitted_at)}
                        {entry.invoice_status ? ` · ${titleCaseStatus(entry.invoice_status)}` : ''}
                      </div>
                      {entry.intake_status === 'rejected' && entry.rejection_note ? (
                        <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
                          {entry.rejection_note}
                        </div>
                      ) : null}
                    </div>
                    <button className="btn" type="button" onClick={() => setOpenId(entry.id)}>
                      {canResubmitSubmission(user.role, entry) ? 'Resubmit' : 'View'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PremiumOverviewCard>

        <SubmissionDrawer open={Boolean(row)} onClose={() => setOpenId(null)} row={row} viewer={getDrawerViewerRole(user.role)} />
      </div>
    );
  }

  if (isTeamLead) {
    const pendingCount = visibleRows.filter((entry) => entry.intake_status === 'submitted').length;
    const acceptedCount = visibleRows.filter((entry) => entry.intake_status === 'accepted').length;
    const rejectedCount = visibleRows.filter((entry) => entry.intake_status === 'rejected').length;

    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <PageHeader
          title={getOverviewTitle(user.role)}
          description="Team leads see their own work plus their team pipeline, not company-wide finance metrics."
          secondaryDescription="Finance-wide role data is still under development; full overview metrics will appear after that wiring is complete."
          actions={canSubmitInvoice(user.role) ? (
            <Link href={getInvoiceIntakePath()} className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Submit Invoice
            </Link>
          ) : null}
        />

        <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <KpiCard title="Team Pending" value={String(pendingCount)} hint="Awaiting finance review" />
          <KpiCard title="Team Accepted" value={String(acceptedCount)} hint="Moved forward by finance" />
          <KpiCard title="Team Rejected" value={String(rejectedCount)} hint="Needs fixes from creators" />
        </section>

        <SectionCard title="Recent Team Updates" description="Latest team movements without dropping into the full operating sheet.">
          {visibleRows.length === 0 ? (
            <div className="text-muted">No team updates yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
              {visibleRows.slice(0, 6).map((entry) => (
                <div
                  key={`team-${entry.id}`}
                  className="surface"
                  style={{ padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{entry.pi}</div>
                    <div className="text-muted" style={{ fontSize: 13 }}>
                      {entry.owner_name || 'Unknown owner'} · {titleCaseStatus(entry.intake_status)}
                    </div>
                  </div>
                  <button className="btn" type="button" onClick={() => setOpenId(entry.id)}>View</button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SubmissionDrawer open={Boolean(row)} onClose={() => setOpenId(null)} row={row} viewer={getDrawerViewerRole(user.role)} />
      </div>
    );
  }

  if (isDeveloper) {
    const failedSyncs = visibleRows.filter((entry) => entry.sync_status === 'failed').length;

    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <PageHeader
          title={getOverviewTitle(user.role)}
          description="Developer access is limited to technical visibility, sync health, and debugging context."
          secondaryDescription="Finance-role overview data is not fully developed yet and will be shown after implementation is completed."
        />

        <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <KpiCard title="Failed Syncs" value={String(failedSyncs)} hint="Needs technical investigation" />
          <KpiCard title="Auth Session Route" value="Healthy" hint="/api/auth/session responding" />
          <KpiCard title="Submission Create Route" value="Healthy" hint="/api/submissions/create compiled" />
        </section>

        <SectionCard title="Current Technical Scope">
          <p className="text-muted" style={{ marginBottom: 0 }}>
            This role can inspect sync state and logs, but cannot approve finance submissions or edit finance payment fields.
          </p>
        </SectionCard>
      </div>
    );
  }

  const totalValue = visibleRows.reduce((sum, entry) => sum + entry.amount, 0);
  const pendingCount = visibleRows.filter((entry) => entry.intake_status === 'submitted').length;
  const pendingPaymentsCount = visibleRows.filter((entry) => {
    const paymentMade = normalizeOverviewStatus(entry.payment_made);
    const closedStatus = normalizeOverviewStatus(entry.closed_status);
    return entry.intake_status === 'accepted' && closedStatus !== 'closed' && paymentMade !== 'paid' && paymentMade !== 'full';
  }).length;
  const rejectedCount = visibleRows.filter((entry) => entry.intake_status === 'rejected').length;
  const invoicesCreatedCount = visibleRows.filter((entry) => normalizeOverviewStatus(entry.invoice_status) === 'invoice_created').length;
  const closedThisMonthCount = visibleRows.filter((entry) => {
    const date = new Date(entry.submitted_at);
    const now = new Date();
    return (
      normalizeOverviewStatus(entry.closed_status) === 'closed' &&
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }).length;
  const topActionRows = visibleRows
    .filter((entry) => {
      const paymentMade = normalizeOverviewStatus(entry.payment_made);
      const closure = normalizeOverviewStatus(entry.closed_status);
      return entry.intake_status === 'submitted' || entry.intake_status === 'rejected' || (entry.intake_status === 'accepted' && closure !== 'closed' && paymentMade !== 'paid' && paymentMade !== 'full');
    })
    .slice(0, 10);
  const checkedCount = visibleRows.filter((entry) => entry.intake_status === 'accepted').length;
  const paidCount = visibleRows.filter((entry) => {
    const paymentMade = normalizeOverviewStatus(entry.payment_made);
    const paymentReceived = normalizeOverviewStatus(entry.payment_received);
    return paymentMade === 'paid' || paymentMade === 'full' || paymentReceived === 'full' || paymentReceived === 'received';
  }).length;
  const tmCount = visibleRows.filter((entry) => normalizeBusinessLine(entry.business_line || entry.integration_metadata?.businessLine) === 'TM').length;
  const imCount = visibleRows.filter((entry) => normalizeBusinessLine(entry.business_line || entry.integration_metadata?.businessLine) === 'IM').length;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title={getOverviewTitle(user.role)}
        description={undefined}
        secondaryDescription={undefined}
        actions={canSubmitInvoice(user.role) ? (
          <Link href={getInvoiceIntakePath()} className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Submit Invoice
          </Link>
        ) : null}
      />

      <section style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <CompactMetricCard title="Pending Review" value={String(pendingCount)} hint="Needs check" />
        <CompactMetricCard title="Pending Payments" value={String(pendingPaymentsCount)} hint="Follow-up queue" />
        <CompactMetricCard title="Resubmissions" value={String(rejectedCount)} hint="Returned items" />
        <CompactMetricCard title="Invoices Created" value={String(invoicesCreatedCount)} hint="Invoice stage" />
        <CompactMetricCard title="Closed This Month" value={String(closedThisMonthCount)} hint="Completed" />
        <CompactMetricCard
          title="Total Intake Value"
          value={new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0, notation: 'compact' }).format(totalValue)}
          hint="Visible intake"
        />
      </section>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <WorkflowFunnel
          steps={[
            { label: 'Submitted', count: pendingCount },
            { label: 'Checked', count: checkedCount },
            { label: 'Invoice Created', count: invoicesCreatedCount },
            { label: 'Paid', count: paidCount },
            { label: 'Closed', count: closedThisMonthCount },
          ]}
        />
        <BusinessLineSummary tm={tmCount} im={imCount} />
      </section>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <PremiumOverviewCard title="Recent Activity" description="Latest operational movement across the visible finance queue.">
          {financeRecentRows.length === 0 ? (
            <div className="text-muted">No recent activity yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
              {financeRecentRows.map((entry) => (
                <div key={`activity-${entry.id}`} className="surface" style={{ padding: 12, display: 'grid', gap: 6, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong>{entry.pi}</strong>
                      <StatusChip label={titleCaseStatus(entry.intake_status)} tone={overviewTone(entry.intake_status)} />
                    </div>
                    <Link className="btn" href={`/dashboard/finance?submission_id=${entry.id}`} style={{ textDecoration: 'none' }}>
                      Open
                    </Link>
                  </div>
                  <div className="text-muted" style={{ fontSize: 13 }}>
            {entry.owner_name || 'Unknown owner'} - {formatDateTime(entry.submitted_at)}
            {entry.invoice_status ? ` - ${titleCaseStatus(entry.invoice_status)}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </PremiumOverviewCard>

        <PremiumOverviewCard title="Top 10 Needing Action" description="Prioritize pending checks, payment follow-up, and resubmission requests.">
          {topActionRows.length === 0 ? (
            <div className="text-muted">Nothing urgent in the current visible queue.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
              {topActionRows.map((entry) => (
                <div
                  key={`action-${entry.id}`}
                  className="surface"
          style={{ padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', border: '1px solid var(--border)' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong>{entry.pi}</strong>
                      <StatusChip label={titleCaseStatus(entry.intake_status)} tone={overviewTone(entry.intake_status)} />
                      <StatusChip
                        label={entry.intake_status === 'rejected' ? 'High Priority' : entry.intake_status === 'submitted' ? 'Review' : 'Follow Up'}
                        tone={entry.intake_status === 'rejected' ? 'rose' : entry.intake_status === 'submitted' ? 'amber' : 'cyan'}
                      />
                    </div>
                    <div className="text-muted" style={{ fontSize: 13 }}>
              {entry.entity} - {titleCaseStatus(entry.intake_status)}
                    </div>
                  </div>
          <Link className="btn" href={`/dashboard/finance?submission_id=${entry.id}`} style={{ textDecoration: 'none' }}>
            Open
          </Link>
                </div>
              ))}
            </div>
          )}
        </PremiumOverviewCard>
      </section>

      <SubmissionDrawer open={Boolean(row)} onClose={() => setOpenId(null)} row={row} viewer={getDrawerViewerRole(user.role)} />
    </div>
  );
}
