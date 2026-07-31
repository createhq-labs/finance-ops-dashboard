"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardRefresh } from '../../../lib/client/use-dashboard-refresh';
import { KpiCard } from '../../../components/dashboard/kpi-card';
import { PageHeader } from '../../../components/dashboard/page-header';
import { SectionCard } from '../../../components/dashboard/section-card';
import { StatePanel } from '../../../components/dashboard/state-panel';
import { type SubmissionRow } from '../../../components/dashboard/submission-table';
import { AnalyticsMetricCard, AnalyticsPanel, DonutChart, GaugeGrid, LineAreaChart, TimelineList, WorkflowBars } from '../../../components/dashboard/analytics-visuals';
import { useDashboardSession } from '../../../components/layout/dashboard-session';
import { WorkspaceLoader } from '../../../components/layout/workspace-loader';
import { getLineRevenue, getRevenueSeries } from '../../../lib/client/admin-stats';
import { getPiDisplayMeta } from '../../../lib/client/pi-display';
import { formatInvoiceStatus } from '../../../lib/client/finance-status';
import { canSubmitInvoice, getInvoiceIntakePath, getOverviewTitle, isEmployeeRole, isTeamLeadRole } from '../../../lib/client/dashboard-access';

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
  currency?: string | null;
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
  if (normalized === 'rejected') return 'Resubmission Requested';
  if (normalized === 'declined') return 'Rejected';
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
  <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card px-3.5 py-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-border/90 hover:shadow-[0_8px_20px_rgba(15,23,42,0.09),0_2px_6px_rgba(15,23,42,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_8px_20px_rgba(0,0,0,0.3)]">
    <div className="absolute inset-y-0 left-0 w-[3px] bg-sky-400 opacity-70 transition-opacity duration-200 group-hover:opacity-100 dark:bg-sky-500" />

    <div className="flex flex-col gap-2 pl-2.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium leading-snug text-muted-foreground">
          {title}
        </p>

        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 ring-1 ring-inset ring-transparent transition-all duration-200 group-hover:ring-sky-200 dark:bg-sky-500/[0.12] dark:group-hover:ring-sky-500/30">
          <span className="flex items-center justify-center text-sky-500 transition-transform duration-200 group-hover:-translate-y-px group-hover:scale-110 dark:text-sky-400">
            {metricIcon}
          </span>
        </div>
      </div>

      <div>
        <p className="break-words text-[clamp(1.45rem,1.8vw,1.9rem)] font-bold leading-none tracking-tight text-foreground tabular-nums">
          {value}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground/75">
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
          cyan: 'border-sky-200/70 bg-sky-50 text-sky-700 dark:border-sky-400/35 dark:bg-sky-500/20 dark:text-sky-100',
green: 'border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-500/20 dark:text-emerald-100',
amber: 'border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-400/35 dark:bg-amber-500/20 dark:text-amber-100',
orange: 'border-orange-200/70 bg-orange-50 text-orange-700 dark:border-orange-400/35 dark:bg-orange-500/20 dark:text-orange-100',
rose: 'border-rose-200/70 bg-rose-50 text-rose-700 dark:border-rose-400/35 dark:bg-rose-500/20 dark:text-rose-100',
slate: 'border-slate-200/70 bg-slate-50 text-slate-600 dark:border-slate-400/35 dark:bg-slate-500/20 dark:text-slate-100',
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

function hasResubmissionSuccessor(entryId: string, rows: Array<{ previous_submission_id?: string | null }>) {
  return rows.some((row) => row.previous_submission_id === entryId);
}

function isCompletedResubmissionUpdate(entry: { previous_submission_id?: string | null; version_status?: string | null }) {
  return Boolean(entry.previous_submission_id) || entry.version_status === 'resubmitted';
}

function isCompletedActionHistoryEntry(
  entry: { id: string; intake_status?: string | null; previous_submission_id?: string | null; version_status?: string | null },
  rows: Array<{ id: string; previous_submission_id?: string | null }>
) {
  return (
    (entry.intake_status === 'rejected' && hasResubmissionSuccessor(entry.id, rows)) ||
    isCompletedResubmissionUpdate(entry)
  );
}

function getLifecycleRootId(
  entryId: string,
  parentMap: Map<string, string | null | undefined>
) {
  let currentId = entryId;
  const seen = new Set<string>();

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const parentId = parentMap.get(currentId);
    if (!parentId) return currentId;
    currentId = parentId;
  }

  return entryId;
}

function getLatestLifecycleRows<T extends { id: string; previous_submission_id?: string | null }>(rows: T[]) {
  const parentMap = new Map(rows.map((row) => [row.id, row.previous_submission_id]));
  const latestByRoot = new Map<string, T>();

  for (const row of rows) {
    const rootId = getLifecycleRootId(row.id, parentMap);
    if (!latestByRoot.has(rootId)) {
      latestByRoot.set(rootId, row);
    }
  }

  return Array.from(latestByRoot.values());
}

function PremiumOverviewCard({
  title,
  description,
  children,
  variant = 'neutral',
  headerAction,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  variant?: 'cyan' | 'violet' | 'navy' | 'teal' | 'warning' | 'danger' | 'neutral';
  headerAction?: ReactNode;
}) {
  const tokens: Record<string, { bar: string; titleColor: string }> = {
    cyan:    { bar: 'bg-sky-400 dark:bg-sky-500',      titleColor: 'text-sky-700 dark:text-sky-400' },
    violet:  { bar: 'bg-violet-400 dark:bg-violet-500', titleColor: 'text-violet-700 dark:text-violet-400' },
    navy:    { bar: 'bg-blue-500 dark:bg-blue-400',     titleColor: 'text-blue-700 dark:text-blue-400' },
    teal:    { bar: 'bg-teal-400 dark:bg-teal-500',     titleColor: 'text-teal-700 dark:text-teal-400' },
    warning: { bar: 'bg-amber-400 dark:bg-amber-400',   titleColor: 'text-amber-700 dark:text-amber-400' },
    danger:  { bar: 'bg-rose-400 dark:bg-rose-500',     titleColor: 'text-rose-600 dark:text-rose-400' },
    neutral: { bar: 'bg-slate-300 dark:bg-slate-600',   titleColor: 'text-foreground' },
  };

  const t = tokens[variant];

  return (
    <section className="relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]">

      {/* Accent bar */}
      <div
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-[3px] ${t.bar}`}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/50 py-2.5 pl-4 pr-3.5">
        <div className="min-w-0 flex items-baseline gap-2">
          <h2 className={`shrink-0 text-[13.5px] font-semibold leading-tight tracking-tight ${t.titleColor}`}>
            {title}
          </h2>
          {description ? (
            <p className="truncate text-[12px] leading-none text-muted-foreground/55">
              {description}
            </p>
          ) : null}
        </div>
        {headerAction ? (
          <div className="shrink-0 flex items-center">{headerAction}</div>
        ) : null}
      </div>

      {/* Content */}
      <div className="p-4 pl-4">
        {children}
      </div>

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
  const max = Math.max(1, ...steps.map((s) => s.count));
  const W = 500;
  const H = 160;
  const padL = 26;
  const padR = 26;
  const padT = 20;
  const padB = 30;
  const colors = ['#0ea5e9', '#3b82f6', '#8b5cf6', '#14b8a6', '#f94848ff'];

  const logScale = (v: number) => (v === 0 ? 0 : Math.log1p(v) / Math.log1p(max));

  const points = steps.map((s, i) => ({
    x: padL + (i / (steps.length - 1)) * (W - padL - padR),
    y: padT + (1 - logScale(s.count)) * (H - padT - padB),
    count: s.count,
    label: s.label,
    color: colors[i],
    pct: i === 0 ? 100 : Math.round((s.count / steps[0].count) * 100),
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  const areaPoints =
    `${points[0].x},${H - padB} ` +
    points.map((p) => `${p.x},${p.y}`).join(' ') +
    ` ${points[points.length - 1].x},${H - padB}`;

  return (
    <PremiumOverviewCard title="Workflow Pipeline">
      <div className="relative w-full" style={{ paddingBottom: '38%' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="wf-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#05b0ffff" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#08affcff" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* baseline */}
          <line
            x1={padL} y1={H - padB}
            x2={W - padR} y2={H - padB}
            stroke="currentColor" strokeOpacity="0.08" strokeWidth="1"
          />

          {/* vertical grid lines per stage */}
          {points.map((p, i) => (
            <line
              key={i}
              x1={p.x} y1={padT}
              x2={p.x} y2={H - padB}
              stroke="currentColor" strokeOpacity="0.06" strokeWidth="1"
              strokeDasharray="3 3"
            />
          ))}

          {/* filled area under line */}
          <polygon points={areaPoints} fill="url(#wf-area)" />

          {/* connecting line */}
          <polyline
            points={polyline}
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* drop annotation between stages */}
          {points.slice(1).map((p, i) => {
            const prev = points[i];
            const mx = (prev.x + p.x) / 2;
            const my = (prev.y + p.y) / 2 - 10;
            const dropped = prev.count - p.count;
            if (dropped <= 0) return null;
            return (
              <text
                key={i}
                x={mx} y={my}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="currentColor"
                fillOpacity="0.35"
                fontFamily="inherit"
              >
                ↓{dropped}
              </text>
            );
          })}

          {/* dots + labels */}
          {points.map((p, i) => (
            <g key={steps[i].label}>
              {/* outer ring */}
              <circle cx={p.x} cy={p.y} r="7" fill="white" stroke={p.color} strokeWidth="1.5" />
              {/* inner fill */}
              <circle cx={p.x} cy={p.y} r="3.5" fill={p.color} />

              {/* count above dot */}
              <text
                x={p.x}
                y={p.y - 13}
                textAnchor="middle"
                fontSize="13"
                fontWeight="600"
                fill={p.color}
                fontFamily="inherit"
              >
                {p.count}
              </text>

              {/* stage label below baseline */}
              <text
                x={p.x}
                y={H - padB + 20}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="currentColor"
                fillOpacity="0.45"
                fontFamily="inherit"
              >
                {steps[i].label}
              </text>

              {/* conversion % below label (skip first) */}
              
                <text
                  x={p.x}
                  y={H - padB + 33}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="currentColor"
                  fillOpacity="0.35"
                  fontFamily="inherit"
                >
                  {p.pct}%
                </text>
      
            </g>
          ))}
        </svg>
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

type TeamLeadMemberApiRow = {
  employee_id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  created_by: string;
};

type TeamLeadOverviewApiRow = FinanceOverviewApiRow & {
  invoice_number?: string | null;
  debit_note_number?: string | null;
  sync_status?: SubmissionRow['sync_status'];
  submitted_by_name?: string | null;
  submitted_by_email?: string | null;
};

type AdminUserApiRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role: 'employee' | 'team_lead' | 'finance' | 'admin' | 'developer';
  status: 'active' | 'inactive';
  business_line: 'IM' | 'TM' | null;
  team_lead_id?: string | null;
};

type MasterDataSummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

function mapTeamLeadOverviewRow(item: TeamLeadOverviewApiRow): SubmissionRow {
  return {
    id: String(item.id),
    pi: item.proforma_invoice ?? '',
    entity: item.agency_brand_name || '-',
    amount: Number(item.commercials ?? 0),
    currency: item.currency || 'INR',
    owner_name:
      [item.submitted_by_name, item.submitted_by_email]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join('\n') || '-',
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
    invoice_number: item.invoice_number || null,
    debit_note_number: item.debit_note_number || null,
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
  };
}

export default function DashboardHomePage() {
  const router = useRouter();
  const { user, loading } = useDashboardSession();
  const [showAllEmployeeActions, setShowAllEmployeeActions] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsError, setRowsError] = useState('');
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [teamRows, setTeamRows] = useState<SubmissionRow[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamLeadMemberApiRow[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUserApiRow[]>([]);
  const [masterDataSummary, setMasterDataSummary] = useState<MasterDataSummary>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  useDashboardRefresh({
    enabled: Boolean(user),
    refresh: async () => {
      if (!user) return;

      setRowsLoading(true);
      setRowsError('');
      const isOperationalRole = user.role === 'finance' || user.role === 'admin';

      try {
        const res = await fetch(isOperationalRole ? '/api/submissions/finance' : '/api/submissions/my', { method: 'GET', cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to load overview data.');
        }
        const mapped = ((json.submissions ?? []) as FinanceOverviewApiRow[]).map((item): SubmissionRow => ({
          id: String(item.id),
          pi: item.proforma_invoice ?? '',
          entity: item.agency_brand_name || '-',
          amount: Number(item.commercials ?? 0),
          currency: item.currency || 'INR',
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
        setRows(mapped);
      } catch (error) {
        setRowsError(error instanceof Error ? error.message : 'Failed to load overview data.');
      } finally {
        setRowsLoading(false);
      }
    },
    intervalMs: user?.role === 'team_lead' ? 30000 : user?.role === 'employee' ? 60000 : undefined,
    refreshOnFocus: user?.role === 'team_lead' || user?.role === 'employee',
  });

  useEffect(() => {
    if (user?.role === 'team_lead') return;
    setTeamRows([]);
    setTeamMembers([]);
    setTeamError('');
    setTeamLoading(false);
  }, [user]);

  useDashboardRefresh({
    enabled: user?.role === 'team_lead',
    refresh: async () => {
      setTeamLoading(true);
      setTeamError('');

      try {
        const [teamRes, membersRes] = await Promise.all([
          fetch('/api/submissions/team', { method: 'GET', cache: 'no-store' }),
          fetch('/api/team/members', { method: 'GET', cache: 'no-store' }),
        ]);
        const teamJson = await teamRes.json().catch(() => ({}));
        const membersJson = await membersRes.json().catch(() => ({}));

        if (!teamRes.ok || !teamJson?.success) {
          throw new Error(teamJson?.error || 'Failed to load team submissions.');
        }
        if (!membersRes.ok || !membersJson?.success) {
          throw new Error(membersJson?.error || 'Failed to load team members.');
        }

        setTeamRows(((teamJson.submissions ?? []) as TeamLeadOverviewApiRow[]).map(mapTeamLeadOverviewRow));
        setTeamMembers(Array.isArray(membersJson.members) ? membersJson.members : []);
      } catch (error) {
        setTeamError(error instanceof Error ? error.message : 'Failed to load team data.');
      } finally {
        setTeamLoading(false);
      }
    },
    intervalMs: 30000,
    refreshOnFocus: true,
  });

  useEffect(() => {
    if (user?.role === 'admin') return;
    setAdminUsers([]);
    setMasterDataSummary({ total: 0, pending: 0, approved: 0, rejected: 0 });
    setAdminLoading(false);
    setAdminError('');
  }, [user]);

  useDashboardRefresh({
    enabled: user?.role === 'admin',
    refresh: async () => {
      setAdminLoading(true);
      setAdminError('');

      try {
        const [usersRes, reviewsRes] = await Promise.all([
          fetch('/api/users', { method: 'GET', cache: 'no-store' }),
          fetch('/api/master-data/reviews', { method: 'GET', cache: 'no-store' }),
        ]);
        const usersJson = await usersRes.json().catch(() => ({}));
        const reviewsJson = await reviewsRes.json().catch(() => ({}));

        if (!usersRes.ok || !usersJson?.success) {
          throw new Error(usersJson?.error || 'Failed to load admin users.');
        }
        if (!reviewsRes.ok || !reviewsJson?.success) {
          throw new Error(reviewsJson?.error || 'Failed to load master data summary.');
        }

        setAdminUsers(Array.isArray(usersJson.users) ? usersJson.users : []);
        setMasterDataSummary(
          reviewsJson.summary ?? { total: 0, pending: 0, approved: 0, rejected: 0 }
        );
      } catch (error) {
        setAdminError(error instanceof Error ? error.message : 'Failed to load admin overview.');
      } finally {
        setAdminLoading(false);
      }
    },
  });

  const visibleRows = useMemo(() => [...rows].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()), [rows]);
  const financeRecentRows = useMemo(() => visibleRows.slice(0, 6), [visibleRows]);
  const teamVisibleRows = useMemo(
    () => [...teamRows].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()),
    [teamRows]
  );

  if (loading || !user) return null;
  const isEmployee = isEmployeeRole(user.role);
  const isTeamLead = isTeamLeadRole(user.role);
  const isAdmin = user.role === 'admin';
  const isDeveloper = user.role === 'developer';

  if (rowsLoading || (isTeamLead && teamLoading) || (isAdmin && adminLoading)) {
    return <WorkspaceLoader variant="section" label="Loading overview..." />;
  }
  if (rowsError || (isTeamLead && teamError) || (isAdmin && adminError)) return <StatePanel tone="danger">{rowsError || teamError || adminError}</StatePanel>;

  if (isEmployee) {
    const originalSubmissionRows = visibleRows.filter((entry) => !entry.previous_submission_id);
    const latestLifecycleRows = getLatestLifecycleRows(visibleRows);
    const submittedCount = originalSubmissionRows.length;
    const acceptedCount = latestLifecycleRows.filter((entry) => entry.intake_status === 'accepted').length;
    const rejectedCount = visibleRows.filter((entry) => Boolean(entry.previous_submission_id)).length;
    const paidCount = latestLifecycleRows.filter((entry) => {
      const paymentMade = normalizeOverviewStatus(entry.payment_made);
      const paymentReceived = normalizeOverviewStatus(entry.payment_received);
      return paymentMade === 'paid' || paymentMade === 'full' || paymentReceived === 'full' || paymentReceived === 'received';
    }).length;
    const paidValue = latestLifecycleRows.reduce((sum, entry) => {
      const paymentMade = normalizeOverviewStatus(entry.payment_made);
      const paymentReceived = normalizeOverviewStatus(entry.payment_received);
      return paymentMade === 'paid' || paymentMade === 'full' || paymentReceived === 'full' || paymentReceived === 'received'
        ? sum + entry.amount
        : sum;
    }, 0);
    const employeeActionRows = visibleRows.filter((entry) => entry.intake_status === 'rejected' && !hasResubmissionSuccessor(entry.id, visibleRows));
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

        <PremiumOverviewCard
          title="Items Needing Action"
          description="Submissions returned by finance for correction."
          headerAction={employeeActionRows.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-full border border-rose-200/80 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/12 dark:text-rose-200">
                {employeeActionRows.length} item{employeeActionRows.length > 1 ? 's' : ''} need attention
              </span>
              <button
                className="inline-flex h-6 items-center rounded-md border border-border/60 px-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                type="button"
                onClick={() => setShowAllEmployeeActions((current) => !current)}
              >
                {showAllEmployeeActions ? 'Collapse' : 'Expand'}
              </button>
            </div>
          ) : null}
        >
          {employeeActionRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No correction requests right now.</div>
          ) : (
            <div>
              <div className="max-h-72 overflow-y-auto pr-1">
                {(showAllEmployeeActions ? employeeActionRows : employeeActionRows.slice(0, 1)).map((entry) => (
                  <OverviewListRow
                    key={`employee-action-${entry.id}`}
                    title={getOverviewPiMeta(entry).label}
                    primaryChip={<StatusChip label="Resubmission Requested" tone="orange" />}
                    note={renderResubmissionNote(entry.finance_comment || entry.rejection_note || 'Finance requested corrections.')}
                    action={
                      <button className="btn" type="button" onClick={() => router.push(getInvoiceIntakePath() + '?view_id=' + entry.id)}>
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
                        label={
                          isCompletedActionHistoryEntry(entry, visibleRows)
                            ? 'Resubmission Completed'
                            : entry.intake_status === 'rejected'
                              ? 'Resubmission Requested'
                              : titleCaseStatus(entry.intake_status)
                        }
                        tone={isCompletedActionHistoryEntry(entry, visibleRows) ? 'green' : overviewTone(entry.intake_status)}
                      />
                    }
                    meta={
                      <>
                        {formatDateTime(entry.submitted_at)}
                        {entry.invoice_status ? ` · ${formatInvoiceStatus(entry.invoice_status)}` : ''}
                      </>
                    }
                    note={
                      entry.intake_status === 'rejected'
                        ? renderResubmissionNote(entry.finance_comment || entry.rejection_note || undefined)
                        : undefined
                    }
                    action={
                      ((user.role === 'employee' || user.role === 'team_lead') && entry.intake_status === 'rejected' && !isCompletedActionHistoryEntry(entry, visibleRows)) ? (
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
                        <button className="btn" type="button" onClick={() => router.push(getInvoiceIntakePath() + '?view_id=' + entry.id)}>
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

      </div>
    );
  }

  if (isTeamLead) {
    const mySubmissionCount = visibleRows.length;
    const teamSubmissionCount = teamVisibleRows.length;
    const teamMembersCount = teamMembers.length;
    const pendingOrReviewCount = teamVisibleRows.filter((entry) => {
      const intakeStatus = normalizeOverviewStatus(entry.intake_status);
      const closedStatus = normalizeOverviewStatus(entry.closed_status);
      return intakeStatus === 'submitted' || (intakeStatus === 'accepted' && closedStatus !== 'closed');
    }).length;
    const resubmissionRequestedCount = teamVisibleRows.filter((entry) => normalizeOverviewStatus(entry.intake_status) === 'rejected').length;
    const closedTeamCount = teamVisibleRows.filter((entry) => normalizeOverviewStatus(entry.closed_status) === 'closed').length;

    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <PageHeader
          title={getOverviewTitle(user.role)}
          description="Monitor your submissions and your mapped team submissions in one place."
          className="gap-2 pb-2"
          actions={canSubmitInvoice(user.role) ? (
            <Link href={getInvoiceIntakePath()} className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Submit Invoice
            </Link>
          ) : null}
        />

        <section style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <KpiCard title="My Submissions" value={String(mySubmissionCount)} hint="Your own records" compact />
          <KpiCard title="Team Members" value={String(teamMembersCount)} hint="Mapped employees" compact />
          <KpiCard title="Team Submissions" value={String(teamSubmissionCount)} hint="Visible team records" compact />
          <KpiCard title="Pending / In Review" value={String(pendingOrReviewCount)} hint="Waiting on finance" compact />
          <KpiCard title="Resubmission Requested" value={String(resubmissionRequestedCount)} hint="Needs employee fixes" compact />
          <KpiCard title="Closed" value={String(closedTeamCount)} hint="Completed items" compact />
        </section>

        <PremiumOverviewCard title="Recent Team Activity" description="Latest mapped employee submissions.">
          {teamVisibleRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No team submissions yet.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto pr-1">
              {teamVisibleRows.slice(0, 6).map((entry) => (
                <OverviewListRow
                  key={`team-${entry.id}`}
                  title={getOverviewPiMeta(entry).label}
                  primaryChip={<StatusChip label={titleCaseStatus(entry.intake_status)} tone={overviewTone(entry.intake_status)} />}
                  meta={
                    <>
                      {entry.owner_name || 'Unknown owner'} · {formatDateTime(entry.submitted_at)}
                      {entry.invoice_status ? ` · ${formatInvoiceStatus(entry.invoice_status)}` : ''}
                    </>
                  }
                  note={
                    entry.intake_status === 'rejected'
                      ? renderResubmissionNote(entry.finance_comment || entry.rejection_note || undefined)
                      : undefined
                  }
                  action={
                    <button className="btn" type="button" onClick={() => router.push(getInvoiceIntakePath() + '?view_id=' + entry.id)}>
                      View
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </PremiumOverviewCard>

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

  if (isAdmin) {
    const submissionsThisMonth = visibleRows.filter((entry) => {
      const submittedAt = new Date(entry.submitted_at);
      const now = new Date();
      return submittedAt.getFullYear() === now.getFullYear() && submittedAt.getMonth() === now.getMonth();
    }).length;
    const closedThisMonthCount = visibleRows.filter((entry) => {
      const date = new Date(entry.submitted_at);
      const now = new Date();
      return (
        normalizeOverviewStatus(entry.closed_status) === 'closed' &&
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );
    }).length;
    const pendingFinanceCount = visibleRows.filter((entry) => {
      const paymentMade = normalizeOverviewStatus(entry.payment_made);
      const closure = normalizeOverviewStatus(entry.closed_status);
      return entry.intake_status === 'submitted' || (entry.intake_status === 'accepted' && closure !== 'closed' && paymentMade !== 'paid' && paymentMade !== 'full');
    }).length;
    const totalPiRevenue = getLineRevenue(visibleRows, null, 'pi');
    const totalTiRevenue = getLineRevenue(visibleRows, null, 'ti');
    const imPiRevenue = getLineRevenue(visibleRows, 'IM', 'pi');
    const tmPiRevenue = getLineRevenue(visibleRows, 'TM', 'pi');
    const imTiRevenue = getLineRevenue(visibleRows, 'IM', 'ti');
    const tmTiRevenue = getLineRevenue(visibleRows, 'TM', 'ti');
    const activeEmployees = adminUsers.filter((entry) => entry.role === 'employee' && entry.status === 'active').length;
    const activeTeamLeads = adminUsers.filter((entry) => entry.role === 'team_lead' && entry.status === 'active').length;
    const activeFinanceUsers = adminUsers.filter((entry) => entry.role === 'finance' && entry.status === 'active').length;
    const revenueSeries = getRevenueSeries(visibleRows);
    const revenuePoints = revenueSeries.map((point) => ({ label: point.label, values: { pi: point.pi, ti: point.ti } }));
    const revenueSpark = revenueSeries.map((point) => point.pi + point.ti);
    const currentRevenue = revenueSpark[revenueSpark.length - 1] ?? 0;
    const previousRevenue = revenueSpark[revenueSpark.length - 2] ?? 0;
    const revenueTrend = previousRevenue > 0 && currentRevenue > 0 ? `${currentRevenue >= previousRevenue ? '+' : ''}${(((currentRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1)}% MoM` : null;
    const imRevenueTotal = imPiRevenue + imTiRevenue;
    const tmRevenueTotal = tmPiRevenue + tmTiRevenue;
    const totalSubmissions = visibleRows.length;
    const reviewedCount = visibleRows.filter((entry) => Boolean(entry.reviewed_at) || entry.intake_status !== 'submitted').length;
    const closedCount = visibleRows.filter((entry) => normalizeOverviewStatus(entry.closed_status) === 'closed').length;
    const pendingPaymentsCount = visibleRows.filter((entry) => {
      const paymentMade = normalizeOverviewStatus(entry.payment_made);
      const closedStatus = normalizeOverviewStatus(entry.closed_status);
      return entry.intake_status === 'accepted' && closedStatus !== 'closed' && paymentMade !== 'paid' && paymentMade !== 'full';
    }).length;
    const rejectedCount = visibleRows.filter((entry) => entry.intake_status === 'rejected').length;
    const workflowRows = [
      { label: 'Submitted', value: totalSubmissions, tone: 'navy' as const, note: `${totalSubmissions > 0 ? Math.round((totalSubmissions / totalSubmissions) * 100) : 0}% of intake` },
      { label: 'Finance review', value: reviewedCount, tone: 'violet' as const, note: `${totalSubmissions > 0 ? Math.round((reviewedCount / totalSubmissions) * 100) : 0}% reviewed` },
      { label: 'Master data', value: masterDataSummary.total, tone: 'cyan' as const, note: `${masterDataSummary.pending} pending approval` },
      { label: 'Closed', value: closedCount, tone: 'teal' as const, note: `${totalSubmissions > 0 ? Math.round((closedCount / totalSubmissions) * 100) : 0}% completed` },
    ];
    const pendingWorkloadRows = [
      { label: 'Finance', value: pendingFinanceCount, tone: 'amber' as const, note: 'needs review' },
      { label: 'Master data', value: masterDataSummary.pending, tone: 'rose' as const, note: 'awaiting approval' },
      { label: 'Payment', value: pendingPaymentsCount, tone: 'violet' as const, note: 'in progress' },
      { label: 'Resubs', value: rejectedCount, tone: 'cyan' as const, note: 'needs employee action' },
    ];
    const companyHealthGauges = [
      {
        label: 'Employees',
        subtitle: `${activeEmployees} of ${Math.max(1, adminUsers.filter((entry) => entry.role === 'employee').length)} active`,
        value: adminUsers.filter((entry) => entry.role === 'employee').length > 0 ? activeEmployees / adminUsers.filter((entry) => entry.role === 'employee').length : 0,
        detail: 'Active access',
        tone: 'green' as const,
      },
      {
        label: 'Finance',
        subtitle: `${activeFinanceUsers} active users`,
        value: totalSubmissions > 0 ? reviewedCount / totalSubmissions : 0,
        detail: 'Review coverage',
        tone: 'amber' as const,
      },
      {
        label: 'Master data',
        subtitle: `${masterDataSummary.approved} approved`,
        value: masterDataSummary.total > 0 ? masterDataSummary.approved / masterDataSummary.total : 0,
        detail: `${masterDataSummary.pending} pending`,
        tone: 'navy' as const,
      },
    ];
    const recentActivityItems: Array<{ title: string; subtitle: string; meta: string; tone: 'rose' | 'green' | 'cyan'; action: ReactNode }> = financeRecentRows.map((entry) => ({
      title: entry.intake_status === 'rejected' ? 'Resubmission requested' : entry.intake_status === 'accepted' ? 'Submission approved' : 'Submission received',
      subtitle: `${entry.owner_name || 'Unknown owner'} · ${getOverviewPiMeta(entry).label}`,
      meta: formatDateTime(entry.submitted_at),
      tone: entry.intake_status === 'rejected' ? 'rose' : entry.intake_status === 'accepted' ? 'green' : 'cyan',
      action: <Link className="btn" href={`/dashboard/finance?submission_id=${entry.id}`} style={{ textDecoration: 'none' }}>Open</Link>,
    }));

    return (
      <div className="grid gap-5">
        <PageHeader
          title="Admin Operations Overview"
          description="Live operations dashboard — what needs attention right now"
          className="gap-3 border-b-0 pb-2"
          actions={
            financeRecentRows[0]?.submitted_at ? (
              <span className="text-sm font-medium text-muted-foreground">
                Last synced: {formatDateTime(financeRecentRows[0].submitted_at)}
              </span>
            ) : null
          }
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnalyticsMetricCard title="Total PI revenue" value={formatMoneyCompact(totalPiRevenue)} trend={revenueTrend} tone="cyan" />
          <AnalyticsMetricCard title="Total TI revenue" value={formatMoneyCompact(totalTiRevenue)} trend={revenueTrend} tone="cyan" />
          <AnalyticsMetricCard title="IM PI revenue" value={formatMoneyCompact(imPiRevenue)} tone="cyan" />
          <AnalyticsMetricCard title="TM PI revenue" value={formatMoneyCompact(tmPiRevenue)} tone="cyan" />
          <AnalyticsMetricCard title="IM TI revenue" value={formatMoneyCompact(imTiRevenue)} tone="cyan" />
          <AnalyticsMetricCard title="TM TI revenue" value={formatMoneyCompact(tmTiRevenue)} tone="cyan" />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AnalyticsMetricCard title="Pending Finance" value={String(pendingFinanceCount)} hint="needs review" tone="amber" />
          <AnalyticsMetricCard title="Master Data Pending" value={String(masterDataSummary.pending)} hint="awaiting approval" tone="rose" />
          <AnalyticsMetricCard title="Submissions This Month" value={String(submissionsThisMonth)} hint="current intake" tone="green" />
          <AnalyticsMetricCard title="Closed This Month" value={String(closedThisMonthCount)} hint="workflow complete" tone="teal" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
          <AnalyticsPanel title="Workflow funnel" subtitle="Operational flow from intake to completion.">
            <WorkflowBars rows={workflowRows} />
          </AnalyticsPanel>
          <AnalyticsPanel title="IM vs TM revenue split" subtitle="Combined PI and TI contribution by business line.">
            <DonutChart
              centerLabel="total"
              centerValue={formatMoneyCompact(imRevenueTotal + tmRevenueTotal)}
              segments={[
                { label: 'IM', value: imRevenueTotal, color: '#6366f1', note: formatMoneyCompact(imRevenueTotal) },
                { label: 'TM', value: tmRevenueTotal, color: '#06b6d4', note: formatMoneyCompact(tmRevenueTotal) },
              ]}
            />
          </AnalyticsPanel>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <AnalyticsPanel title="Revenue trend — last 6 months" subtitle="PI and TI totals across recent months.">
            <LineAreaChart
              points={revenuePoints}
              series={[
                { key: 'pi', label: 'PI revenue', color: '#6366f1', fill: '#6366f1' },
                { key: 'ti', label: 'TI revenue', color: '#06b6d4', fill: '#06b6d4' },
              ]}
              valueFormatter={(value) => formatMoneyCompact(value)}
            />
          </AnalyticsPanel>
          <AnalyticsPanel title="Pending workload" subtitle="Queues that still need attention.">
            <WorkflowBars rows={pendingWorkloadRows} />
          </AnalyticsPanel>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
          <AnalyticsPanel title="Company health" subtitle={`Active employees, finance coverage, and master data readiness. ${activeTeamLeads} active team leads.`}>
            <GaugeGrid items={companyHealthGauges} />
          </AnalyticsPanel>
          <AnalyticsPanel title="Recent activity" subtitle="Latest company submissions and workflow movement.">
            <TimelineList
              items={recentActivityItems}
              emptyLabel="No recent activity yet. Submission, finance, master data, and user events will appear here once activity begins."
            />
          </AnalyticsPanel>
        </section>

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
        <CompactMetricCard title="Resubmissions Pending" value={String(rejectedCount)} hint="Returned items" />
        <CompactMetricCard title="Invoice Stage" value={String(invoicesCreatedCount)} hint="Currently in invoice stage" />
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
        <PremiumOverviewCard title="Recent Activity" description="">
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
                      {entry.invoice_status ? ` · ${formatInvoiceStatus(entry.invoice_status)}` : ''}
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

        <PremiumOverviewCard title="Top 10 Needing Action" description="">
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

    </div>
  );
}
