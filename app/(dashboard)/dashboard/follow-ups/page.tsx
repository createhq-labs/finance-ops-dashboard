"use client";

import { AlertCircle, CheckCircle2, Clock3, Download, FileText, Upload } from 'lucide-react';
import { Fragment, useCallback, useMemo, useState } from 'react';
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
};

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

  function resetAllFilters() {
    setQuery('');
    setStatus('all');
    setType('all');
  }

  const loadFollowUps = useCallback(async () => {
    if (!user) return;

    try {
      setFetching(true);
      setError('');
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
        setRows([]);
        setError(body?.error || 'Failed to load follow-ups.');
        return;
      }
      setRows(Array.isArray(body.follow_ups) ? body.follow_ups : []);
    } catch (nextError) {
      setRows([]);
      setError(nextError instanceof Error ? nextError.message : 'Failed to load follow-ups.');
    } finally {
      setFetching(false);
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
        eyebrow="Operations"
        title="Follow-ups"
        description="Track overdue bill due and GST follow-ups using the same dashboard workflow patterns."
        secondaryDescription="Finance/Admin can upload or replace GST screenshots here while employees and team leads continue using the current notification and download flow."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Pending Follow-ups" value={String(stats.pending)} hint="Still awaiting action" variant="warning" compact icon={<Clock3 className="h-[18px] w-[18px]" />} />
        <KpiCard title="Due Today" value={String(stats.dueToday)} hint="Pending follow-ups due today" variant="cyan" compact icon={<AlertCircle className="h-[18px] w-[18px]" />} />
        <KpiCard title="Overdue" value={String(stats.overdue)} hint="Past the expected due date" variant="danger" compact icon={<AlertCircle className="h-[18px] w-[18px]" />} />
        <KpiCard title="Completed" value={String(stats.completed)} hint="Closed from workflow progress" variant="teal" compact icon={<CheckCircle2 className="h-[18px] w-[18px]" />} />
      </div>

      <SectionCard
        title="Follow-up Queue"
        description="Follow-ups still close automatically from the existing workflow. Finance/Admin can manage GST screenshots here without changing the current page design."
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
                  <tr className="border-b border-border/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
                        <tr className="border-b border-border/50 align-top text-sm text-foreground">
                          <td className="px-3 py-3">
                            <div className="flex items-start gap-3">
                              {isCompleted ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                              ) : row.follow_up_type === 'payment_received_pending' ? (
                                <Clock3 className="mt-0.5 h-4 w-4 text-amber-500" />
                              ) : (
                                <AlertCircle className="mt-0.5 h-4 w-4 text-sky-500" />
                              )}
                              <div>
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
                              <div className="grid gap-2">
                                <div className="flex min-w-0 items-center gap-2 rounded-xl border border-sky-200/70 bg-card px-3 py-2 dark:border-sky-400/20">
                                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-300/20 dark:bg-sky-400/12 dark:text-sky-100">
                                    <FileText size={16} />
                                  </span>
                                  <div className="min-w-0 flex-1 overflow-hidden">
                                    <div className="truncate text-[13px] font-medium text-foreground" title={attachment.file_name}>{attachment.file_name}</div>
                                    <div className="text-[11px] text-muted-foreground">{formatAttachmentSize(attachment.file_size_bytes)}</div>
                                  </div>
                                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={attachmentBusy}
                                      onClick={() => void openAttachment(attachment, 'view')}
                                      className="inline-flex h-7 items-center rounded-md border border-border/70 bg-card px-2 text-[11px] font-medium text-foreground transition-none hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
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
                                      {downloadBusy ? <Clock3 size={12} className="animate-spin" /> : <Download size={12} />}
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
                                        className="inline-flex h-7 items-center rounded-md border border-sky-300/60 bg-sky-100/90 px-2.5 text-[11px] font-medium text-sky-900 transition-none hover:bg-sky-200 dark:border-sky-300/25 dark:bg-sky-400/16 dark:text-sky-50 dark:hover:bg-sky-400/24 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Replace
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  Updated by {row.gst_screenshot_uploaded_by_name || 'Finance/Admin'} ? {formatDate(row.gst_screenshot_uploaded_at)}
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
                              <div className="mt-1 text-xs text-muted-foreground">{row.completion_reason}</div>
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
                                    <div className="text-sm font-semibold text-foreground">GST Screenshot</div>
                                    <div className="text-xs text-muted-foreground">Upload or replace the GST screenshot using the existing attachment flow.</div>
                                  </div>
                                </div>
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
                                />
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
    </div>
  );
}
