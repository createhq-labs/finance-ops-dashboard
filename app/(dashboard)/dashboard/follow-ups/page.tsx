"use client";

import { useCallback, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Search } from 'lucide-react';
import { KpiCard } from '../../../../components/dashboard/kpi-card';
import { PageHeader } from '../../../../components/dashboard/page-header';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { StatePanel } from '../../../../components/dashboard/state-panel';
import { SearchableSelect } from '../../../../components/forms/searchable-select';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { WorkspaceLoader } from '../../../../components/layout/workspace-loader';
import { useDashboardRefresh } from '../../../../lib/client/use-dashboard-refresh';

type FollowUpRow = {
  id: string;
  submission_id: string;
  follow_up_type: 'payment_received_pending' | 'gst_pending';
  due_date: string;
  status: 'pending' | 'completed';
  completion_reason: string | null;
  completed_at: string | null;
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
};

const STATUS_OPTIONS = ['All statuses', 'Pending', 'Completed'] as const;
const TYPE_OPTIONS = ['All follow-up types', 'Payment Received pending', 'GST pending'] as const;

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
  return type === 'payment_received_pending' ? 'Payment Received' : 'GST Pending';
}

function getFollowUpDescription(row: FollowUpRow) {
  if (row.follow_up_type === 'payment_received_pending') {
    return 'Payment received is still pending for ' + (row.proforma_invoice || 'this submission') + '.';
  }
  return 'GST details/documents are still pending for ' + (row.proforma_invoice || 'this submission') + '.';
}

function getStatusValue(label: string): 'all' | 'pending' | 'completed' {
  if (label === 'Pending') return 'pending';
  if (label === 'Completed') return 'completed';
  return 'all';
}

function getTypeValue(label: string): 'all' | 'payment_received_pending' | 'gst_pending' {
  if (label === 'Payment Received pending') return 'payment_received_pending';
  if (label === 'GST pending') return 'gst_pending';
  return 'all';
}

export default function FollowUpsPage() {
  const { user, loading } = useDashboardSession();
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [type, setType] = useState<'all' | 'payment_received_pending' | 'gst_pending'>('all');
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

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
        description="Track overdue payment and GST follow-ups using the same dashboard workflow patterns."
        secondaryDescription="Notifications continue through the current notification system for assigned employees and team leads."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Pending Follow-ups" value={String(stats.pending)} hint="Still awaiting action" variant="warning" compact icon={<Clock3 className="h-[18px] w-[18px]" />} />
        <KpiCard title="Due Today" value={String(stats.dueToday)} hint="Pending follow-ups due today" variant="cyan" compact icon={<AlertCircle className="h-[18px] w-[18px]" />} />
        <KpiCard title="Overdue" value={String(stats.overdue)} hint="Past the expected due date" variant="danger" compact icon={<AlertCircle className="h-[18px] w-[18px]" />} />
        <KpiCard title="Completed" value={String(stats.completed)} hint="Closed from workflow progress" variant="teal" compact icon={<CheckCircle2 className="h-[18px] w-[18px]" />} />
      </div>

      <SectionCard
        title="Follow-up Queue"
        description="This page is read-only. Follow-ups close automatically once the required workflow step is completed."
        actions={(
          <span className="rounded-full border border-sky-300/55 bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/18 dark:text-sky-100">
            {rows.length} visible
          </span>
        )}
        contentClassName="grid gap-4"
      >
        <div className="grid gap-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_220px]">
            <label className="relative block">
              <span className="sr-only">Search follow-ups</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-10 w-full rounded-xl border border-border/70 bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-accent"
                placeholder="Search PI, employee, or submission"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <SearchableSelect
              value={status === 'all' ? 'All statuses' : status === 'pending' ? 'Pending' : 'Completed'}
              options={[...STATUS_OPTIONS]}
              onChange={(next) => setStatus(getStatusValue(next))}
              placeholder="All statuses"
              dataField="followUpStatus"
            />

            <SearchableSelect
              value={type === 'all' ? 'All follow-up types' : type === 'payment_received_pending' ? 'Payment Received pending' : 'GST pending'}
              options={[...TYPE_OPTIONS]}
              onChange={(next) => setType(getTypeValue(next))}
              placeholder="All follow-up types"
              dataField="followUpType"
            />
          </div>

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
                    return (
                      <tr key={row.id} className="border-b border-border/50 align-top text-sm text-foreground">
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
                        </td>
                        <td className="px-3 py-3 text-foreground">{formatDate(row.last_notified_at)}</td>
                      </tr>
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
