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
import { getPiDisplayMeta } from '../../../lib/client/pi-display';
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
  finance_notes?: string | null;
  finance_comment?: string | null;
  creator_invoice_status?: string | null;
  payment_received_status?: string | null;
  payment_made_status?: string | null;
  closure_status?: string | null;
  business_line?: 'TM' | 'IM' | null;
  entry_type?: 'SC' | 'MC' | null;
  entity_type?: 'Agency' | 'Brand' | null;
  client_type?: 'Indian' | 'Foreign' | null;
  agency_name?: string | null;
  agency_trade_name?: string | null;
  brand_trade_name?: string | null;
  campaign_code?: string | null;
  campaign_name?: string | null;
  campaign_brand?: string | null;
  campaign_notes?: string | null;
  previous_submission_id?: string | null;
  intake_line_items?: SubmissionRow['intake_line_items'];
  submitted_by_name?: string | null;
  submitted_by_email?: string | null;
  sync_status?: SubmissionRow['sync_status'];
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

function getOverviewPiMeta(row: SubmissionRow) {
  return getPiDisplayMeta({
    pi: row.pi,
    submittedAt: row.submitted_at,
    invoiceType: row.invoice_type,
    lineItems: row.intake_line_items,
  });
}

function CompactMetricCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  const normalizedTitle = title.toLowerCase();
  const metricIcon = normalizedTitle.includes('payment')
    ? (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 7h20" />
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M16 15h2" />
        <path d="M6 13h4" />
      </svg>
    )
    : normalizedTitle.includes('paid')
    ? (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 14h.01" />
        <path d="M12 14h4" />
      </svg>
    )
    : normalizedTitle.includes('resubmission')
      ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7h10a4 4 0 1 1 0 8H8" />
          <path d="m3 11 4-4-4-4" />
        </svg>
      )
      : normalizedTitle.includes('invoice')
        ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z" />
            <path d="M14 2v6h6" />
          </svg>
        )
        : normalizedTitle.includes('closed')
          ? (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 11V7a4 4 0 1 1 8 0v4" />
              <rect x="5" y="11" width="14" height="10" rx="2" />
            </svg>
          )
          : normalizedTitle.includes('checked')
            ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )
            : (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
            );

  return (
    <div className="group rounded-2xl border border-border/60 bg-card p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition duration-150 hover:border-primary/15 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]">
      <div className="flex min-h-[92px] flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-3">
          <p className="pr-3 text-[14px] font-medium leading-5 text-foreground">
            {title}
          </p>
          <div className="shrink-0 pt-0.5 text-sky-500/75 dark:text-sky-300/75">
            {metricIcon}
          </div>
        </div>

        <div>
          <p className="break-words text-[clamp(1.75rem,2.1vw,2.35rem)] font-bold leading-none tracking-[-0.06em] text-foreground">
            {value}
          </p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ label, tone = 'cyan' }: { label: string; tone?: 'cyan' | 'green' | 'amber' | 'orange' | 'rose' | 'slate' }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
        {
          cyan: 'border-sky-200/70 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200',
          green: 'border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200',
          amber: 'border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200',
          orange: 'border-orange-200/70 bg-orange-50 text-orange-700 dark:border-orange-400/20 dark:bg-orange-400/10 dark:text-orange-200',
          rose: 'border-rose-200/70 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200',
          slate: 'border-slate-200/70 bg-slate-50 text-slate-600 dark:border-slate-400/20 dark:bg-slate-400/10 dark:text-slate-200',
        }[tone]
      }`}
    >
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
    <section className="min-h-full rounded-xl border border-border/70 bg-card p-3.5 shadow-sm">
      <div className="mb-2.5">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function OverviewListRow({
  title,
  meta,
  note,
  primaryChip,
  secondaryChip,
  action,
}: {
  title: ReactNode;
  meta?: ReactNode;
  note?: ReactNode;
  primaryChip?: ReactNode;
  secondaryChip?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate text-sm font-semibold text-foreground">
            {title}
          </div>
          {primaryChip}
          {secondaryChip}
        </div>

        {meta ? (
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {meta}
          </div>
        ) : null}

        {note ? (
          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {note}
          </div>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function renderResubmissionNote(note?: string | null) {
  const text = String(note || '').trim();
  if (!text) return undefined;
  return (
    <>
      <span className="text-rose-600 dark:text-rose-400">Resubmission Note:</span> {text}
    </>
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
  const activeSegment = hovered || selected || visibleSegments[0] || segments[0] || null;
  const radius = 39;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, [segments]);

  return (
    <div className="grid gap-3">
      <div className="flex justify-center">
        <div
          className="relative flex aspect-square w-[150px] max-w-full items-center justify-center"
          onMouseLeave={() => setHovered(null)}
        >
          <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth="14" />
            {total > 0
              ? visibleSegments.map((segment) => {
                  const length = (segment.value / total) * circumference;
                  const dash = ready ? `${length} ${circumference - length}` : `0 ${circumference}`;
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
                      strokeWidth={activeSegment?.label === segment.label ? 16 : 14}
                      strokeDasharray={dash}
                      strokeDashoffset={currentOffset}
                      strokeLinecap="butt"
                      onMouseEnter={() => setHovered(segment)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => setSelected((current) => (current?.label === segment.label ? null : segment))}
                      style={{
                        cursor: 'pointer',
                        filter: hovered?.label === segment.label ? 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.15))' : 'none',
                        transition: 'stroke-dasharray 850ms cubic-bezier(.2,.8,.2,1), stroke-width 160ms ease, opacity 160ms ease',
                      }}
                    />
                  );
                })
              : null}
          </svg>

          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 'clamp(1.35rem, 2.2vw, 1.8rem)', letterSpacing: '-0.06em', color: 'var(--foreground)' }}>
                {centerValue}
              </div>
              <div className="text-muted" style={{ marginTop: 2, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                {centerLabel}
              </div>
            </div>
          </div>
        </div>
      </div>

      {total === 0 ? (
          <div className="text-center text-sm text-muted-foreground">No data available yet.</div>
        ) : (
          <>
            {activeSegment ? (
              <div className="text-center text-sm text-muted-foreground">
                <strong className="text-foreground">{valueFormatter(activeSegment.value)}</strong>{' '}
                {activeSegment.label.toLowerCase()}
                {total > 0 ? (
                <>
                  {' '}· <span className="font-semibold text-sky-500 dark:text-sky-300">{Math.round((activeSegment.value / total) * 100)}%</span>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
            {segments.map((segment) => (
              <button
                key={segment.label}
                type="button"
                onMouseEnter={() => setHovered(segment)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected((current) => (current?.label === segment.label ? null : segment))}
                className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-foreground"
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: segment.color,
                  }}
                />
                <span>{segment.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function WorkflowFunnel({ steps }: { steps: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...steps.map((step) => step.count));

  return (
    <PremiumOverviewCard title="Workflow Pipeline">
      <div className="grid gap-3 pt-1">
        {steps.map((step) => {
          const width = `${(step.count / max) * 100}%`;
          return (
            <div
              key={step.label}
              className="grid items-center gap-4"
              style={{ gridTemplateColumns: '168px minmax(0, 1fr) 40px' }}
            >
              <div className="text-[15px] font-medium leading-6 text-foreground">
                {step.label}
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800/70">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#22d3ee,#2563eb)] transition-all duration-300"
                  style={{ width }}
                />
              </div>
              <div className="text-right text-[15px] font-semibold tabular-nums leading-6 text-foreground">
                {step.count}
              </div>
            </div>
          );
        })}
      </div>
    </PremiumOverviewCard>
  );
}

function BusinessLineSummary({
  tm,
  im,
}: {
  tm: number;
  im: number;
}) {
  const total = tm + im;
  return (
    <PremiumOverviewCard title="Business Line Split">
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

function SubmissionJourney({ steps }: { steps: Array<{ label: string; count: number; description?: string; tooltipLines?: string[] }> }) {
  const max = Math.max(1, ...steps.map((step) => step.count));
  return (
    <PremiumOverviewCard title="Submission Journey" description="A compact view of where your submissions are.">
      <div style={{ position: 'relative', height: 440, overflowY: 'auto', paddingTop: 12, paddingBottom: 12, paddingRight: 6 }}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 42,
            bottom: 54,
            width: 3,
            borderRadius: 999,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(180deg, rgba(34,211,238,0.18), rgba(59,130,246,0.16), rgba(34,211,238,0.18))',
          }}
        />
        <div style={{ display: 'grid', gap: 34 }}>
          {steps.map((step, index) => (
            <div
              key={step.label}
              className="group/step relative"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 44px 1fr',
                alignItems: 'center',
                gap: 12,
                minWidth: 0,
                minHeight: 72,
              }}
            >
              <div style={{ minWidth: 0 }}>
                {index % 2 === 1 ? (
                  <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.2, textAlign: 'right' }}>{step.label}</div>
                ) : null}
              </div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, #0284c7, #22d3ee)',
                  boxShadow: '0 12px 24px -16px rgba(14, 165, 233, 0.75)',
                  transform: `scale(${0.92 + Math.min(0.12, step.count / max / 8)})`,
                  transition: 'transform 180ms ease, box-shadow 180ms ease',
                  justifySelf: 'center',
                }}
              >
                {step.count}
              </div>
              <div style={{ minWidth: 0 }}>
                {index % 2 === 0 ? (
                  <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.2 }}>{step.label}</div>
                ) : null}
              </div>
              <div
                className="pointer-events-none absolute z-20 w-44 rounded-2xl border border-cyan-100 bg-white px-3.5 py-2.5 text-xs opacity-0 shadow-[0_18px_50px_-30px_rgba(15,104,168,0.36)] transition duration-150 group-hover/step:opacity-100 dark:border-cyan-400/24 dark:bg-[#07111d]"
                style={{
                  left: index % 2 === 0 ? 'calc(50% + 34px)' : 'auto',
                  right: index % 2 === 1 ? 'calc(50% + 34px)' : 'auto',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              >
                <div style={{ fontWeight: 800, color: 'var(--foreground)' }}>{step.label}</div>
                <div className="text-muted" style={{ marginTop: 4, display: 'grid', gap: 3 }}>
                  {[`${step.count} items`].map((line) => (
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
  entry_type?: SubmissionRow['entry_type'];
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
          pi: item.proforma_invoice ?? '',
          entity: item.agency_brand_name || '-',
          amount: Number(item.commercials ?? 0),
          owner_name: item.submitted_by_name || user.full_name || undefined,
          submitter_email: item.submitted_by_email || item.email_address || undefined,
          intake_status: item.intake_status,
          invoice_status: item.invoice_status || '-',
          sync_status: item.sync_status || 'pending_sheet_sync',
          submitted_at: item.submitted_at || new Date().toISOString(),
          rejection_note: item.rejection_note || item.finance_comment || null,
          finance_notes: item.finance_notes || null,
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
          entry_type: item.entry_type || null,
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
    const paidValue = visibleRows.reduce((sum, entry) => {
      const paymentMade = normalizeOverviewStatus(entry.payment_made);
      const paymentReceived = normalizeOverviewStatus(entry.payment_received);
      return paymentMade === 'paid' || paymentMade === 'full' || paymentReceived === 'full' || paymentReceived === 'received'
        ? sum + entry.amount
        : sum;
    }, 0);
    const employeeActionRows = visibleRows.filter((entry) => entry.intake_status === 'rejected');
    const invoiceCreatedCount = visibleRows.filter((entry) => normalizeOverviewStatus(entry.invoice_status) === 'invoice_created').length;
    const latestSubmitted = visibleRows.find((entry) => entry.intake_status === 'submitted');
    const totalSubmissionCount = visibleRows.length;
    const percentOfTotal = (count: number) => (totalSubmissionCount > 0 ? `${Math.round((count / totalSubmissionCount) * 100)}%` : '');

    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <PageHeader
          title={getOverviewTitle(user.role)}
          description="Track your submissions, statuses, resubmission notes, and next actions in one place."
          className="gap-4 border-b-0 pb-4"
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
            <div className="text-sm text-muted-foreground">No correction requests right now.</div>
          ) : (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3 border-b border-border/50 pb-1.5">
                <span className="text-xs text-muted-foreground">
                  {employeeActionRows.length} item{employeeActionRows.length > 1 ? 's' : ''} need attention
                </span>
                <button className="btn" type="button" onClick={() => setShowAllEmployeeActions((current) => !current)}>
                  {showAllEmployeeActions ? 'Collapse' : 'Expand'}
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto pr-1">
                {(showAllEmployeeActions ? employeeActionRows : employeeActionRows.slice(0, 1)).map((entry) => (
                  <OverviewListRow
                    key={`employee-action-${entry.id}`}
                    title={getOverviewPiMeta(entry).label}
                    primaryChip={<StatusChip label="Resubmission" tone="orange" />}
                    note={renderResubmissionNote(entry.finance_comment || entry.rejection_note || 'Finance requested corrections.')}
                    action={
                      <button className="btn" type="button" onClick={() => setOpenId(entry.id)}>
                        Open
                      </button>
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </PremiumOverviewCard>

        <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 3fr) minmax(320px, 2fr)' }}>
          <PremiumOverviewCard title="Recent Updates" description="Latest submission changes and recent submissions.">
            {visibleRows.length === 0 ? (
              <div style={{ height: 440 }} className="text-sm text-muted-foreground">No recent updates yet.</div>
            ) : (
              <div className="overflow-y-auto pr-1" style={{ height: 440 }}>
                {visibleRows.map((entry) => (
                  <OverviewListRow
                    key={`recent-${entry.id}`}
                    title={getOverviewPiMeta(entry).label}
                    primaryChip={
                      <StatusChip
                        label={entry.intake_status === 'rejected' ? 'Resubmission' : titleCaseStatus(entry.intake_status)}
                        tone={overviewTone(entry.intake_status)}
                      />
                    }
                    meta={
                      <>
                        {formatDateTime(entry.submitted_at)}
                        {entry.invoice_status ? ` · ${titleCaseStatus(entry.invoice_status)}` : ''}
                      </>
                    }
                    note={
                      entry.intake_status === 'rejected'
                        ? renderResubmissionNote(entry.finance_comment || entry.rejection_note || undefined)
                        : undefined
                    }
                    action={
                      canResubmitSubmission(user.role, entry) ? (
                        <Link
                          href={`${getInvoiceIntakePath()}?resubmit_id=${entry.id}`}
                          className="btn"
                          style={{
                            textDecoration: 'none',
                            borderColor: 'rgb(251 113 133 / 0.75)',
                            color: 'rgb(190 24 93)',
                          }}
                        >
                          Resubmit
                        </Link>
                      ) : (
                        <button className="btn" type="button" onClick={() => setOpenId(entry.id)}>
                          View
                        </button>
                      )
                    }
                  />
                ))}
              </div>
            )}
          </PremiumOverviewCard>
          <SubmissionJourney
            steps={[
              {
                label: 'Submitted',
                count: submittedCount,
                description: 'created',
                tooltipLines: [
                  `${submittedCount} submissions created`,
                  latestSubmitted ? `Latest: ${getOverviewPiMeta(latestSubmitted).label} on ${formatDateTime(latestSubmitted.submitted_at)}` : '',
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

        <SubmissionDrawer open={Boolean(row)} onClose={() => setOpenId(null)} row={row} viewer={getDrawerViewerRole(user.role)} />
      </div>
    );
  }

  if (isTeamLead) {
    const pendingCount = visibleRows.filter((entry) => entry.intake_status === 'submitted').length;
    const acceptedCount = visibleRows.filter((entry) => entry.intake_status === 'accepted').length;
    const rejectedCount = visibleRows.filter((entry) => entry.intake_status === 'rejected').length;

    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <PageHeader
          title={getOverviewTitle(user.role)}
          description="Monitor your work and your team's submission pipeline in one place."
          secondaryDescription="Company-wide finance metrics will appear here once the full finance overview is wired."
          className="gap-4 pb-4"
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
                    <div style={{ fontWeight: 600 }} title={getOverviewPiMeta(entry).title}>{getOverviewPiMeta(entry).label}</div>
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
      <div style={{ display: 'grid', gap: 12 }}>
        <PageHeader
          title={getOverviewTitle(user.role)}
          description="Monitor technical visibility, sync health, and debugging context from one view."
          secondaryDescription="Finance-role overview metrics will appear here after implementation is completed."
          className="gap-4 pb-4"
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
  const tmCount = visibleRows.filter((entry) => normalizeBusinessLine(entry.business_line) === 'TM').length;
  const imCount = visibleRows.filter((entry) => normalizeBusinessLine(entry.business_line) === 'IM').length;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <PageHeader
        title={getOverviewTitle(user.role)}
        description="Monitor intake volume, payment progress, and the finance review pipeline from one view."
        secondaryDescription={undefined}
        className="gap-3 border-b-0 pb-1"
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
      </section>

        <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
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

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <PremiumOverviewCard title="Recent Activity" description="Latest operational movement across the visible finance queue.">
          {financeRecentRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No recent activity yet.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto pr-1">
              {financeRecentRows.map((entry) => (
                <OverviewListRow
                  key={`activity-${entry.id}`}
                  title={getOverviewPiMeta(entry).label}
                  primaryChip={<StatusChip label={titleCaseStatus(entry.intake_status)} tone={overviewTone(entry.intake_status)} />}
                  meta={
                    <>
                      {entry.owner_name || 'Unknown owner'} · {formatDateTime(entry.submitted_at)}
                      {entry.invoice_status ? ` · ${titleCaseStatus(entry.invoice_status)}` : ''}
                    </>
                  }
                  action={
                    <Link className="btn" href={`/dashboard/finance?submission_id=${entry.id}`} style={{ textDecoration: 'none' }}>
                      Open
                    </Link>
                  }
                />
              ))}
            </div>
          )}
        </PremiumOverviewCard>

        <PremiumOverviewCard title="Top 10 Needing Action" description="Prioritize pending checks, payment follow-up, and resubmission requests.">
          {topActionRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nothing urgent in the current visible queue.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto pr-1">
              {topActionRows.map((entry) => (
                <OverviewListRow
                  key={`action-${entry.id}`}
                  title={getOverviewPiMeta(entry).label}
                  primaryChip={<StatusChip label={titleCaseStatus(entry.intake_status)} tone={overviewTone(entry.intake_status)} />}
                  secondaryChip={
                    entry.intake_status === 'submitted' ? (
                      <StatusChip label="Review" tone="amber" />
                    ) : entry.intake_status === 'accepted' ? (
                      <StatusChip label="Follow Up" tone="cyan" />
                    ) : undefined
                  }
                  meta={`${entry.entity} · ${titleCaseStatus(entry.intake_status)}`}
                  action={
                    <Link className="btn" href={`/dashboard/finance?submission_id=${entry.id}`} style={{ textDecoration: 'none' }}>
                      Open
                    </Link>
                  }
                />
              ))}
            </div>
          )}
        </PremiumOverviewCard>
      </section>

      <SubmissionDrawer open={Boolean(row)} onClose={() => setOpenId(null)} row={row} viewer={getDrawerViewerRole(user.role)} />
    </div>
  );
}
