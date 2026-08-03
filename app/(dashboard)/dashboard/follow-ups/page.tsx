"use client";

import { AlertCircle, CheckCircle2, Clock3, Download, FileText, History, Pencil, Upload, Users } from 'lucide-react';
import { Fragment, useCallback, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { FinanceAuditCard, FinanceAuditPopover } from '../../../../components/dashboard/finance-audit-popover';
import { KpiCard } from '../../../../components/dashboard/kpi-card';
import { FilterBar } from '../../../../components/dashboard/filter-bar';
import { PageHeader } from '../../../../components/dashboard/page-header';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { StatePanel } from '../../../../components/dashboard/state-panel';
import { AttachmentUploadField } from '../../../../components/forms/invoice-line-items';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { WorkspaceLoader } from '../../../../components/layout/workspace-loader';
import { useDashboardRefresh } from '../../../../lib/client/use-dashboard-refresh';
import { formatAttachmentSize, type SubmissionAttachmentSummary } from '../../../../lib/shared/submission-attachments';

type FollowUpRow = {
  id: string;
  submission_id: string;
  follow_up_type: 'payment_received_pending' | 'gst_pending';
  due_date: string;
  status: 'pending' | 'completed';
  completion_reason: string | null;
  completed_at: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  last_notified_at: string | null;
  next_notification_at: string | null;
  created_at: string;
  updated_at: string;
  assigned_employee_id: string;
  assigned_employee_name: string | null;
  assigned_employee_email: string | null;
  assigned_team_lead_id: string | null;
  assigned_team_lead_name: string | null;
  proforma_invoice: string | null;
  agency_brand_name: string | null;
  bill_due: string | null;
  payment_received_status: string | null;
  creator_invoice_status: string | null;
  payment_made_status: string | null;
  closure_status: string | null;
  submitted_at: string | null;
  gst_screenshot_attachment: SubmissionAttachmentSummary | null;
  gst_screenshot_uploaded_by_name: string | null;
  gst_screenshot_uploaded_at: string | null;
  gst_screenshot_access_summary: { employee: GstAccessSummaryEntry | null; team_lead: GstAccessSummaryEntry | null } | null;
};

type GstAccessSummaryEntry = {
  role: 'employee' | 'team_lead';
  user_id: string;
  name: string | null;
  business_line: string | null;
  viewed: boolean;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  downloaded: boolean;
  first_downloaded_at: string | null;
  last_downloaded_at: string | null;
  download_count: number;
};

function formatAccessAuditSubtitle(entry: GstAccessSummaryEntry | null) {
  if (!entry) return '';
  const roleLabel = entry.role === 'employee' ? 'Employee' : 'Team Lead';
  const name = entry.name || 'Unknown';
  return entry.business_line ? `${name} · ${entry.business_line} ${roleLabel}` : `${name} · ${roleLabel}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDueDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getFollowUpLabel(type: FollowUpRow['follow_up_type']) {
  return type === 'payment_received_pending' ? 'Bill Due' : 'GST Follow-up';
}

function getFollowUpDescription(row: FollowUpRow) {
  if (row.follow_up_type === 'payment_received_pending') {
    return 'Payment is still pending after the bill due date for ' + (row.proforma_invoice || 'this submission') + '.';
  }
  return 'GST is still left in payment received status for ' + (row.proforma_invoice || 'this submission') + '.';
}

function canManageGstScreenshot(role: string | undefined) {
  return role === 'finance' || role === 'admin' || role === 'developer';
}

// Mirrors RefreshReason in lib/client/use-dashboard-refresh.ts, which does not
// export the type. The hook emits 'initial' once, then 'interval' and 'focus';
// 'manual' / 'realtime' / 'queued' are reachable through the same contract.
type FollowUpRefreshReason = 'initial' | 'interval' | 'focus' | 'manual' | 'realtime' | 'queued';

// The single reason that is allowed to replace the table with a loader or clear
// it on error. Everything else - including reasons added to useDashboardRefresh
// later, and callers that pass no reason - is classified as a background
// refresh, which must leave the table and any open GST upload panel mounted.
const INITIAL_LOAD_REFRESH_REASON: FollowUpRefreshReason = 'initial';

// Reason used when a caller reloads outside the hook (the post-upload reload).
const DEFAULT_REFRESH_REASON: FollowUpRefreshReason = 'manual';
export default function FollowUpsPage() {
  const { user, loading } = useDashboardSession();
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [type, setType] = useState<'all' | 'payment_received_pending' | 'gst_pending'>('all');
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [attachmentActionKey, setAttachmentActionKey] = useState<string | null>(null);
  const [gstUploadRowId, setGstUploadRowId] = useState<string | null>(null);
  const [gstUploadFile, setGstUploadFile] = useState<File | null>(null);
  const [gstUploadError, setGstUploadError] = useState('');
  const [gstUploadBusyId, setGstUploadBusyId] = useState<string | null>(null);
  const [gstMetadataAudit, setGstMetadataAudit] = useState<{ rect: DOMRect; updatedBy: string; updatedAt: string } | null>(null);
  const [gstAccessAudit, setGstAccessAudit] = useState<{ rect: DOMRect; summary: { employee: GstAccessSummaryEntry | null; team_lead: GstAccessSummaryEntry | null } } | null>(null);
  const [gstAccessAuditTab, setGstAccessAuditTab] = useState<'employee' | 'team_lead'>('employee');

  function resetAllFilters() {
    setQuery('');
    setStatus('all');
    setType('all');
  }

  const loadFollowUps = useCallback(async (reason: FollowUpRefreshReason = DEFAULT_REFRESH_REASON) => {
    if (!user) return;

    // Only the first load may swap the table for a loader or wipe it for an
    // error. A background refresh must leave the table mounted, otherwise the
    // open GST upload panel (and the file input it owns) is destroyed mid-use.
    const isInitialLoad = reason === INITIAL_LOAD_REFRESH_REASON;

    try {
      if (isInitialLoad) setFetching(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (status !== 'all') params.set('status', status);
      if (type !== 'all') params.set('type', type);

      const response = await fetch('/api/follow-ups?' + params.toString(), {
        method: 'GET',
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.success) {
        if (isInitialLoad) {
          setRows([]);
          setError(body?.error || 'Failed to load follow-ups.');
        }
        return;
      }
      setError('');
      setRows(Array.isArray(body.follow_ups) ? body.follow_ups : []);
    } catch (nextError) {
      if (isInitialLoad) {
        setRows([]);
        setError(nextError instanceof Error ? nextError.message : 'Failed to load follow-ups.');
      }
    } finally {
      if (isInitialLoad) setFetching(false);
    }
  }, [query, status, type, user]);

  useDashboardRefresh({
    enabled: Boolean(user) && !loading,
    refresh: loadFollowUps,
    intervalMs: user?.role === 'team_lead' ? 30000 : 60000,
    refreshOnFocus: true,
  });

  const stats = useMemo(() => {
    const now = Date.now();
    const pending = rows.filter((row) => row.status === 'pending').length;
    const completed = rows.filter((row) => row.status === 'completed').length;
    const overdue = rows.filter((row) => row.status === 'pending' && new Date(row.due_date).getTime() < now).length;
    const dueToday = rows.filter((row) => {
      if (row.status !== 'pending') return false;
      const due = new Date(row.due_date);
      if (Number.isNaN(due.getTime())) return false;
      const today = new Date();
      return due.getDate() === today.getDate() && due.getMonth() === today.getMonth() && due.getFullYear() === today.getFullYear();
    }).length;
    return { pending, dueToday, overdue, completed };
  }, [rows]);

  const canManage = canManageGstScreenshot(user?.role);

  // No fetch: the access summary is already preloaded on the row by the
  // follow-ups list response, so opening the popover has no loading delay.
  const openGstAccessAudit = useCallback((row: FollowUpRow, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!row.gst_screenshot_access_summary) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setGstAccessAuditTab('employee');
    setGstAccessAudit({ rect, summary: row.gst_screenshot_access_summary });
  }, []);

  const openAttachment = useCallback(async (attachment: SubmissionAttachmentSummary | null, mode: 'view' | 'download') => {
    if (!attachment) return;
    const key = `${attachment.id}:${mode}`;
    setAttachmentActionKey(key);
    try {
      const response = await fetch(`/api/submissions/attachments/${attachment.id}/signed-url${mode === 'download' ? '?download=1' : ''}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.success || !body?.url) {
        throw new Error(body?.error || 'Unable to open attachment.');
      }
      window.open(String(body.url), '_blank', 'noopener,noreferrer');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to open attachment.');
    } finally {
      setAttachmentActionKey(null);
    }
  }, []);

  const submitGstScreenshot = useCallback(async (row: FollowUpRow) => {
    if (!gstUploadFile) {
      setGstUploadError('GST screenshot is required.');
      return;
    }

    try {
      setGstUploadBusyId(row.id);
      setGstUploadError('');
      const formData = new FormData();
      formData.append('file', gstUploadFile);
      const response = await fetch(`/api/follow-ups/${row.id}/gst-screenshot`, {
        method: 'POST',
        body: formData,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.success) {
        throw new Error(body?.error || 'Failed to upload GST screenshot.');
      }
      setGstUploadRowId(null);
      setGstUploadFile(null);
      await loadFollowUps();
    } catch (nextError) {
      setGstUploadError(nextError instanceof Error ? nextError.message : 'Failed to upload GST screenshot.');
    } finally {
      setGstUploadBusyId(null);
    }
  }, [gstUploadFile, loadFollowUps]);

  if (loading) {
    return (
      <WorkspaceLoader
        variant="fullscreen"
        label="Loading follow-ups"
        description="Checking access and preparing your follow-up queue..."
      />
    );
  }

  return (
    <div className="grid gap-4">
      <PageHeader
        className="gap-3 border-b-0 pb-1"
        title="Follow-ups"
        description="Track overdue bill due and GST follow-ups using the same dashboard workflow patterns."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Pending Follow-ups" value={String(stats.pending)} hint="Still awaiting action" variant="warning" compact icon={<Clock3 className="h-[18px] w-[18px]" />} />
        <KpiCard title="Due Today" value={String(stats.dueToday)} hint="Pending follow-ups due today" variant="cyan" compact icon={<AlertCircle className="h-[18px] w-[18px]" />} />
        <KpiCard title="Overdue" value={String(stats.overdue)} hint="Past the expected due date" variant="danger" compact icon={<AlertCircle className="h-[18px] w-[18px]" />} />
        <KpiCard title="Completed" value={String(stats.completed)} hint="Closed from workflow progress" variant="teal" compact icon={<CheckCircle2 className="h-[18px] w-[18px]" />} />
      </div>

      <SectionCard
        title="Follow-up Queue"
        description="Monitor outstanding actions and manage GST screenshot attachments."
        actions={(
          <span className="rounded-full border border-sky-300/55 bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/18 dark:text-sky-100">
            {rows.length} visible
          </span>
        )}
        contentClassName="grid gap-4"
      >
        <div className="grid gap-4">
          <FilterBar
            searchPlaceholder="Search PI, employee, or submission"
            searchValue={query}
            primaryFilters={[
              {
                key: 'status',
                label: 'Status',
                value: status,
                options: [
                  { value: 'all', label: 'All statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'completed', label: 'Completed' },
                ],
              },
              {
                key: 'type',
                label: 'Type',
                value: type,
                options: [
                  { value: 'all', label: 'All follow-up types' },
                  { value: 'payment_received_pending', label: 'Bill Due' },
                  { value: 'gst_pending', label: 'GST Follow-up' },
                ],
              },
            ]}
            advancedFilters={[]}
            onSearch={setQuery}
            onPrimaryChange={(key, value) => {
              if (key === 'status') setStatus((value || 'all') as 'all' | 'pending' | 'completed');
              if (key === 'type') setType((value || 'all') as 'all' | 'payment_received_pending' | 'gst_pending');
            }}
            onAdvancedChange={() => undefined}
            onReset={resetAllFilters}
          />

          {fetching ? (
            <WorkspaceLoader variant="section" label="Loading follow-ups..." description="Pulling the current follow-up queue." />
          ) : error ? (
            <StatePanel variant="error" tone="danger" title="Unable to load follow-ups" description={error} />
          ) : rows.length === 0 ? (
            <StatePanel variant="empty" title="No follow-ups found" description="Adjust the filters or wait for new follow-up conditions to be generated." icon={<Clock3 className="h-5 w-5" />} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <table className="min-w-full table-fixed border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b border-border/60 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground [&>th:not(:last-child)]:border-r [&>th:not(:last-child)]:border-border/40">
                    <th className="px-3 py-2">Follow-up</th>
                    <th className="px-3 py-2">Submission</th>
                    <th className="px-3 py-2">GST Screenshot</th>
                    <th className="px-3 py-2">Assigned Employee</th>
                    <th className="px-3 py-2">Team Lead</th>
                    <th className="px-3 py-2">Due Date</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Last Notification</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isCompleted = row.status === 'completed';
                    const statusClass = isCompleted
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300';
                    const attachment = row.gst_screenshot_attachment;
                    const isGstRow = row.follow_up_type === 'gst_pending';
                    const isUploadingThisRow = gstUploadBusyId === row.id;
                    const isEditingThisRow = gstUploadRowId === row.id;
                    const viewBusy = attachmentActionKey === `${attachment?.id}:view`;
                    const downloadBusy = attachmentActionKey === `${attachment?.id}:download`;
                    const attachmentBusy = viewBusy || downloadBusy;

                    return (
                      <Fragment key={row.id}>
                        <tr className="border-b border-border/50 align-top text-center text-sm text-foreground [&>td:not(:last-child)]:border-r [&>td:not(:last-child)]:border-border/40">
                          <td className="px-3 py-3">
                            <div className="flex items-start justify-center gap-3">
                              {isCompleted ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                              ) : row.follow_up_type === 'payment_received_pending' ? (
                                <Clock3 className="mt-0.5 h-4 w-4 text-amber-500" />
                              ) : (
                                <AlertCircle className="mt-0.5 h-4 w-4 text-sky-500" />
                              )}
                              <div className="text-left">
                                <div className="font-medium text-foreground">{getFollowUpLabel(row.follow_up_type)}</div>
                                <div className="mt-1 text-xs text-muted-foreground">{getFollowUpDescription(row)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-foreground">{row.proforma_invoice || 'PI Not Required'}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{row.agency_brand_name || '-'}</div>
                          </td>
                          <td className="px-3 py-3">
                            {!isGstRow ? (
                              <span className="text-xs text-muted-foreground">-</span>
                            ) : attachment ? (
                              <div className="flex items-center justify-center gap-2">
  <div className="w-fit min-w-0 flex-none rounded-xl border border-sky-200/70 bg-card px-3 py-2 dark:border-sky-400/20">
    <div className="flex items-start gap-2">
     <span className="inline-flex h-[54px] w-10 shrink-0 items-center justify-center rounded-lg border border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-300/20 dark:bg-sky-400/12 dark:text-sky-100">
  <FileText size={20} strokeWidth={1.8} />
</span>

      <div className="w-[120px] min-w-0 flex-none">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden">
  <div
    className="min-w-0 truncate text-left text-[13px] font-medium text-foreground"
    title={attachment.file_name}
  >
    {attachment.file_name}
  </div>

  <span className="shrink-0 text-right text-[11px] text-muted-foreground">
    {formatAttachmentSize(attachment.file_size_bytes)}
  </span>
</div>

       <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            disabled={attachmentBusy}
            onClick={() => void openAttachment(attachment, 'view')}
            className="inline-flex h-7 w-fit items-center rounded-md border border-border/70 bg-card px-3 text-[11px] font-medium text-foreground transition-none hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {viewBusy ? 'Opening...' : 'View'}
          </button>
          
          <button
            type="button"
            disabled={attachmentBusy}
            onClick={() => void openAttachment(attachment, 'download')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground transition-none hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Download GST screenshot"
          >
            {downloadBusy ? (
              <Clock3 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
          </button>

          {canManage && row.status === 'pending' ? (
            <button
              type="button"
              disabled={isUploadingThisRow}
              onClick={() => {
                setGstUploadRowId(row.id);
                setGstUploadFile(null);
                setGstUploadError('');
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-sky-300/60 bg-sky-100/90 text-sky-900 transition-none hover:bg-sky-200 dark:border-sky-300/25 dark:bg-sky-400/16 dark:text-sky-50 dark:hover:bg-sky-400/24 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Replace GST screenshot"
              title="Replace GST screenshot"
            >
              <Pencil size={13} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  </div>

  <div className="flex shrink-0 items-center gap-1.5">
    {row.gst_screenshot_uploaded_by_name || row.gst_screenshot_uploaded_at ? (
      <button
        type="button"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          setGstMetadataAudit({
            rect,
            updatedBy: row.gst_screenshot_uploaded_by_name || 'Finance/Admin',
            updatedAt: formatDate(row.gst_screenshot_uploaded_at),
          });
        }}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-foreground transition-none hover:bg-muted/40"
        aria-label="Open attachment metadata audit"
        title="Metadata audit"
      >
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[0.65rem] font-medium leading-none opacity-85">
          i
        </span>
      </button>
    ) : null}

    {row.gst_screenshot_access_summary ? (
      <button
        type="button"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          openGstAccessAudit(row, event);
        }}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-foreground transition-none hover:bg-muted/40"
        aria-label="Open attachment access audit"
        title="Access audit"
      >
        <History className="h-4 w-4" />
      </button>
    ) : null}
  </div>
</div>
                            ) : canManage && row.status === 'pending' ? (
                              <button
                                type="button"
                                disabled={isUploadingThisRow}
                                onClick={() => {
                                  setGstUploadRowId(row.id);
                                  setGstUploadFile(null);
                                  setGstUploadError('');
                                }}
                                className="inline-flex h-8 items-center gap-2 rounded-lg border border-sky-300/60 bg-sky-100/90 px-3 text-[12px] font-medium text-sky-900 transition-none hover:bg-sky-200 dark:border-sky-300/25 dark:bg-sky-400/16 dark:text-sky-50 dark:hover:bg-sky-400/24 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Upload size={14} />
                                Upload screenshot
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">Awaiting finance upload</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-foreground">{row.assigned_employee_name || '-'}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{row.assigned_employee_email || '-'}</div>
                          </td>
                          <td className="px-3 py-3 text-foreground">{row.assigned_team_lead_name || '-'}</td>
                          <td className="px-3 py-3 text-foreground">{formatDueDate(row.due_date)}</td>
                          <td className="px-3 py-3">
                            <span className={'inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ' + statusClass}>
                              {isCompleted ? 'Completed' : 'Pending'}
                            </span>
                            {row.completion_reason ? (
                              <div className="mt-1 text-left text-xs text-muted-foreground">{row.completion_reason}</div>
                            ) : null}
                            {isCompleted && row.completed_by_name ? (
                              <div className="mt-1 text-xs text-muted-foreground">Completed by {row.completed_by_name}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 text-foreground">{formatDate(row.last_notified_at)}</td>
                        </tr>
                        {isEditingThisRow && isGstRow ? (
                          <tr key={`${row.id}:upload`} className="border-b border-border/50 bg-card/50">
                            <td className="px-3 py-3" colSpan={8}>
                              <div className="grid gap-3 rounded-xl border border-border/60 bg-card p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-[13px] font-semibold leading-5 text-foreground">GST Screenshot</div>
                                    <div className="text-xs text-muted-foreground">Upload or replace the GST screenshot using the existing attachment flow.</div>
                                  </div>
                                </div>
                                <div className="w-full max-w-[600px]">
                                  <AttachmentUploadField
                                    fieldKey="gst-screenshot"
                                    file={gstUploadFile}
                                    error={gstUploadError}
                                    onChange={(_, file) => {
                                      setGstUploadFile(file);
                                      setGstUploadError('');
                                    }}
                                    titleText="Attach GST screenshot"
                                    helperText="PDF, PNG, JPG, or WEBP. Max 10 MB."
                                    compact
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={isUploadingThisRow}
                                    onClick={() => void submitGstScreenshot(row)}
                                    className="btn btn-primary"
                                  >
                                    {isUploadingThisRow ? 'Uploading...' : attachment ? 'Replace screenshot' : 'Upload screenshot'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isUploadingThisRow}
                                    onClick={() => {
                                      setGstUploadRowId(null);
                                      setGstUploadFile(null);
                                      setGstUploadError('');
                                    }}
                                    className="btn"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>

      {gstMetadataAudit ? (
        <FinanceAuditPopover
          rect={gstMetadataAudit.rect}
          title="Attachment Metadata Audit"
          subtitle={gstMetadataAudit.updatedBy}
          onClose={() => setGstMetadataAudit(null)}
        >
          <FinanceAuditCard label="Updated By" value={gstMetadataAudit.updatedBy} />
          <FinanceAuditCard label="Updated At" value={gstMetadataAudit.updatedAt} />
        </FinanceAuditPopover>
      ) : null}

      {gstAccessAudit ? (
        (() => {
          const entry = gstAccessAuditTab === 'employee' ? gstAccessAudit.summary.employee : gstAccessAudit.summary.team_lead;
          return (
            <FinanceAuditPopover
              rect={gstAccessAudit.rect}
              title="Attachment Access Audit"
              subtitle={formatAccessAuditSubtitle(entry)}
              onClose={() => setGstAccessAudit(null)}
              toggle={
                gstAccessAudit.summary.team_lead
                  ? {
                      icon: <Users className="h-3.5 w-3.5" />,
                      active: gstAccessAuditTab === 'team_lead',
                      onClick: () => setGstAccessAuditTab((current) => (current === 'team_lead' ? 'employee' : 'team_lead')),
                      ariaLabel: 'Toggle team lead access audit',
                    }
                  : undefined
              }
            >
              {!entry ? (
                <div className="text-xs text-muted-foreground">No access data available.</div>
              ) : (
                <>
                  <div className="rounded-xl border border-border/60 bg-muted/4 px-3 py-2.5">
                    <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground dark:text-sky-300">View History</div>
                    {entry.viewed ? (
                      <div className="mt-1 grid gap-0.5">
                        <div className="text-[12px]  leading-5 text-foreground">First viewed: {formatDate(entry.first_viewed_at)}</div>
                        <div className="text-[12px] leading-5 text-foreground">Last viewed: {formatDate(entry.last_viewed_at)}</div>
                        <div className="text-[12px] leading-5 text-foreground">Total views: {entry.view_count}</div>
                      </div>
                    ) : (
                      <div className="mt-1 text-[13px] font-semibold text-foreground">Not viewed</div>
                    )}
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/4 px-3 py-2.5">
                    <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground dark:text-sky-300">Download History</div>
                    {entry.downloaded ? (
                      <div className="mt-1 grid gap-0.5">
                        <div className="text-[12px] leading-5 text-foreground">First downloaded: {formatDate(entry.first_downloaded_at)}</div>
                        <div className="text-[12px] leading-5 text-foreground">Last downloaded: {formatDate(entry.last_downloaded_at)}</div>
                        <div className="text-[12px] leading-5 text-foreground">Total downloads: {entry.download_count}</div>
                      </div>
                    ) : (
                      <div className="mt-1 text-[13px] font-semibold leading-5 text-foreground">Not downloaded</div>
                    )}
                  </div>
                </>
              )}
            </FinanceAuditPopover>
          );
        })()
      ) : null}
    </div>
  );
}
