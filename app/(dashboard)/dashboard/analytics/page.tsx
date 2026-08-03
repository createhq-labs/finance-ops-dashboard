'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../../../components/dashboard/page-header';
import {
  AgingBuckets,
  AnalyticsMetricCard as BaseAnalyticsMetricCard,
  AnalyticsPanel as BaseAnalyticsPanel,
  DonutChart as BaseDonutChart,
  DotStatusList,
  GaugeGrid as BaseGaugeGrid,
  GroupedBarChart as BaseGroupedBarChart,
  LineAreaChart as BaseLineAreaChart,
  RankedProgressList as BaseRankedProgressList,
  StackedBarChart as BaseStackedBarChart,
  StackedWorkloadRows,
  TimelineList,
  WorkflowBars as BaseWorkflowBars,
} from '../../../../components/dashboard/analytics-visuals';
import { StatePanel } from '../../../../components/dashboard/state-panel';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { WorkspaceLoader } from '../../../../components/layout/workspace-loader';
import { canViewAnalyticsPage, getDefaultDashboardPath } from '../../../../lib/client/dashboard-access';
import { getLineRevenue, getRevenueSeries, getRevenueAmount, isPiInvoiceType, isTiInvoiceType } from '../../../../lib/client/admin-stats';

type AnalyticsSubmissionRow = {
  id: string;
  submitted_by: string | null;
  reviewed_by: string | null;
  reviewed_at?: string | null;
  invoice_type: string | null;
  business_line: 'IM' | 'TM' | null;
  submitted_at: string | null;
  intake_status: 'submitted' | 'rejected' | 'accepted';
  closure_status: string | null;
  finance_comment: string | null;
  rejection_note: string | null;
  commercials: number | string | null;
};

type AnalyticsUserRow = {
  id: string;
  full_name: string;
  email: string;
  role: 'employee' | 'team_lead' | 'finance' | 'admin' | 'developer';
  status: 'active' | 'inactive';
  team_lead_id: string | null;
  business_line: 'IM' | 'TM' | null;
};

type MasterDataReviewItem = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  type: 'agency' | 'brand' | 'creator';
  created_at: string;
};

type MasterDataSummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

type AnalyticsTab = 'overview' | 'revenue' | 'employees' | 'team_leads' | 'finance' | 'operations';

type ApiResponse = {
  success: boolean;
  submissions?: AnalyticsSubmissionRow[];
  users?: AnalyticsUserRow[];
  items?: MasterDataReviewItem[];
  summary?: MasterDataSummary;
  error?: string;
};

type MonthlyBucket = {
  key: string;
  label: string;
  pi: number;
  ti: number;
  imPi: number;
  tmPi: number;
  imTi: number;
  tmTi: number;
  submitted: number;
  closed: number;
  reviewed: number;
  pending: number;
  resubmissions: number;
  reopened: number;
};

const TABS: Array<{ value: AnalyticsTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'employees', label: 'Employees' },
  { value: 'team_leads', label: 'Team leads' },
  { value: 'finance', label: 'Finance' },
  { value: 'operations', label: 'Operations' },
];

const IM_COLOR = '#6366f1';
const TM_COLOR = '#06b6d4';
const TM_TI_COLOR = '#67e8f9';
const PI_COLOR = '#6366f1';
const TI_COLOR = '#06b6d4';

const AnalyticsPanel = (props: Parameters<typeof BaseAnalyticsPanel>[0]) => <BaseAnalyticsPanel {...props} density="compact" />;
const AnalyticsMetricCard = (props: Parameters<typeof BaseAnalyticsMetricCard>[0]) => <BaseAnalyticsMetricCard {...props} density="compact" />;
const LineAreaChart = (props: Parameters<typeof BaseLineAreaChart>[0]) => <BaseLineAreaChart {...props} density="compact" />;
const GroupedBarChart = (props: Parameters<typeof BaseGroupedBarChart>[0]) => <BaseGroupedBarChart {...props} density="compact" />;
const StackedBarChart = (props: Parameters<typeof BaseStackedBarChart>[0]) => <BaseStackedBarChart {...props} density="compact" />;
const DonutChart = (props: Parameters<typeof BaseDonutChart>[0]) => <BaseDonutChart {...props} density="compact" />;
const RankedProgressList = (props: Parameters<typeof BaseRankedProgressList>[0]) => <BaseRankedProgressList {...props} density="compact" />;
const GaugeGrid = (props: Parameters<typeof BaseGaugeGrid>[0]) => <BaseGaugeGrid {...props} density="compact" />;
const WorkflowBars = (props: Parameters<typeof BaseWorkflowBars>[0]) => <BaseWorkflowBars {...props} density="compact" />;

function safeNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value);
}

function formatDays(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}d`;
}

function formatRate(value: number) {
  return `${Math.round(value * 100)}%`;
}

function average(numbers: number[]) {
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function getMonthTrendLabel(values: number[], suffix = '% MoM') {
  if (values.length < 2) return null;
  const current = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2] ?? 0;
  if (previous <= 0 || current <= 0) return null;
  const diff = ((current - previous) / previous) * 100;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}${suffix}`;
}

function getCountDeltaLabel(values: number[]) {
  if (values.length < 2) return null;
  const current = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2] ?? 0;
  const diff = current - previous;
  if (diff === 0) return null;
  return `${diff > 0 ? '+' : ''}${diff}`;
}

function ageInDays(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function buildMonthlyBuckets(rows: AnalyticsSubmissionRow[], months = 6) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);
  const buckets = new Map<string, MonthlyBucket>();

  for (let offset = 0; offset < months; offset += 1) {
    const cursor = new Date(start.getFullYear(), start.getMonth() + offset, 1);
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, {
      key,
      label: cursor.toLocaleDateString('en-IN', { month: 'short' }),
      pi: 0,
      ti: 0,
      imPi: 0,
      tmPi: 0,
      imTi: 0,
      tmTi: 0,
      submitted: 0,
      closed: 0,
      reviewed: 0,
      pending: 0,
      resubmissions: 0,
      reopened: 0,
    });
  }

  for (const row of rows) {
    if (!row.submitted_at) continue;
    const submittedAt = new Date(row.submitted_at);
    if (Number.isNaN(submittedAt.getTime()) || submittedAt < start) continue;
    const key = `${submittedAt.getFullYear()}-${String(submittedAt.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;

    const amount = getRevenueAmount(row);
    const line = row.business_line ?? 'UNASSIGNED';
    const closure = normalizeStatus(row.closure_status);

    bucket.submitted += 1;
    if (closure === 'closed') bucket.closed += 1;
    if (row.reviewed_by) bucket.reviewed += 1;
    if (row.intake_status === 'submitted') bucket.pending += 1;
    if (row.intake_status === 'rejected') bucket.resubmissions += 1;

    if (isPiInvoiceType(row.invoice_type)) {
      bucket.pi += amount;
      if (line === 'IM') bucket.imPi += amount;
      if (line === 'TM') bucket.tmPi += amount;
    }
    if (isTiInvoiceType(row.invoice_type)) {
      bucket.ti += amount;
      if (line === 'IM') bucket.imTi += amount;
      if (line === 'TM') bucket.tmTi += amount;
    }
  }

  return Array.from(buckets.values());
}

function buildTabButtonClass(active: boolean) {
  return active
    ? 'inline-flex items-center justify-center rounded-full border border-slate-900 bg-slate-900 px-7 py-3 text-base font-semibold text-white shadow-sm dark:border-white dark:bg-white dark:text-slate-950'
    : 'inline-flex items-center justify-center rounded-full border border-border bg-card px-7 py-3 text-base font-medium text-muted-foreground transition-colors hover:text-foreground';
}

export default function AnalyticsPage() {
  const { user, loading } = useDashboardSession();
  const [tab, setTab] = useState<AnalyticsTab>('overview');
  const [submissions, setSubmissions] = useState<AnalyticsSubmissionRow[]>([]);
  const [users, setUsers] = useState<AnalyticsUserRow[]>([]);
  const [masterDataItems, setMasterDataItems] = useState<MasterDataReviewItem[]>([]);
  const [masterDataSummary, setMasterDataSummary] = useState<MasterDataSummary>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || !user) return;
    if (!canViewAnalyticsPage(user.role)) {
      window.location.replace(getDefaultDashboardPath(user.role));
    }
  }, [loading, user]);

  useEffect(() => {
    let active = true;
    if (!user || !canViewAnalyticsPage(user.role)) return;

    setPageLoading(true);
    setError('');

    Promise.all([
      fetch('/api/submissions/finance', { cache: 'no-store' }),
      fetch('/api/users', { cache: 'no-store' }),
      fetch('/api/master-data/reviews', { cache: 'no-store' }),
    ])
      .then(async ([submissionsRes, usersRes, masterDataRes]) => {
        const submissionsJson = (await submissionsRes.json().catch(() => ({}))) as ApiResponse;
        const usersJson = (await usersRes.json().catch(() => ({}))) as ApiResponse;
        const masterDataJson = (await masterDataRes.json().catch(() => ({}))) as ApiResponse;

        if (!submissionsRes.ok || !submissionsJson.success) throw new Error(submissionsJson.error || 'Failed to load submissions.');
        if (!usersRes.ok || !usersJson.success) throw new Error(usersJson.error || 'Failed to load users.');
        if (!masterDataRes.ok || !masterDataJson.success) throw new Error(masterDataJson.error || 'Failed to load master data reviews.');

        if (!active) return;
        setSubmissions(Array.isArray(submissionsJson.submissions) ? submissionsJson.submissions : []);
        setUsers(Array.isArray(usersJson.users) ? usersJson.users : []);
        setMasterDataItems(Array.isArray(masterDataJson.items) ? masterDataJson.items : []);
        setMasterDataSummary(masterDataJson.summary ?? { total: 0, pending: 0, approved: 0, rejected: 0 });
      })
      .catch((nextError) => {
        if (active) setError(nextError instanceof Error ? nextError.message : 'Failed to load analytics.');
      })
      .finally(() => {
        if (active) setPageLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const visibleRows = useMemo(
    () => [...submissions].sort((left, right) => new Date(right.submitted_at || '').getTime() - new Date(left.submitted_at || '').getTime()),
    [submissions]
  );
  const userNameById = useMemo(() => new Map(users.map((entry) => [entry.id, entry.full_name || entry.email])), [users]);
  const monthlyBuckets = useMemo(() => buildMonthlyBuckets(visibleRows), [visibleRows]);
  const revenueSeries = useMemo(() => getRevenueSeries(visibleRows), [visibleRows]);

  const overviewMetrics = useMemo(() => {
    const totalPiRevenue = getLineRevenue(visibleRows, null, 'pi');
    const totalTiRevenue = getLineRevenue(visibleRows, null, 'ti');
    const imPiRevenue = getLineRevenue(visibleRows, 'IM', 'pi');
    const tmPiRevenue = getLineRevenue(visibleRows, 'TM', 'pi');
    const imTiRevenue = getLineRevenue(visibleRows, 'IM', 'ti');
    const tmTiRevenue = getLineRevenue(visibleRows, 'TM', 'ti');
    const currentMonth = monthlyBuckets[monthlyBuckets.length - 1];

    return {
      totalPiRevenue,
      totalTiRevenue,
      imPiRevenue,
      tmPiRevenue,
      imTiRevenue,
      tmTiRevenue,
      submissionsThisMonth: currentMonth?.submitted ?? 0,
      closedThisMonth: currentMonth?.closed ?? 0,
      pendingFinance: visibleRows.filter((entry) => entry.intake_status === 'submitted').length,
      pendingMasterData: masterDataSummary.pending,
      revenueTrend: revenueSeries.map((point) => point.pi + point.ti),
      piTrend: revenueSeries.map((point) => point.pi),
      tiTrend: revenueSeries.map((point) => point.ti),
      submissionTrend: monthlyBuckets.map((point) => point.submitted),
      closedTrend: monthlyBuckets.map((point) => point.closed),
    };
  }, [masterDataSummary.pending, monthlyBuckets, revenueSeries, visibleRows]);

  const employeeRows = useMemo(() => {
    return users
      .filter((entry) => entry.role === 'employee')
      .map((employee) => {
        const personalRows = visibleRows.filter((row) => row.submitted_by === employee.id);
        const resubmissions = personalRows.filter((row) => row.intake_status === 'rejected').length;
        const piRevenue = personalRows.filter((row) => isPiInvoiceType(row.invoice_type)).reduce((sum, row) => sum + safeNumber(row.commercials), 0);
        const tiRevenue = personalRows.filter((row) => isTiInvoiceType(row.invoice_type)).reduce((sum, row) => sum + safeNumber(row.commercials), 0);
        const closedCount = personalRows.filter((row) => normalizeStatus(row.closure_status) === 'closed').length;
        return {
          ...employee,
          submissions: personalRows.length,
          resubmissions,
          resubmissionRate: personalRows.length > 0 ? resubmissions / personalRows.length : 0,
          totalRevenue: piRevenue + tiRevenue,
          piRevenue,
          tiRevenue,
          closedCount,
        };
      })
      .sort((left, right) => right.submissions - left.submissions || right.totalRevenue - left.totalRevenue);
  }, [users, visibleRows]);

  const teamLeadRows = useMemo(() => {
    return users
      .filter((entry) => entry.role === 'team_lead')
      .map((lead) => {
        const teamMembers = users.filter((member) => member.team_lead_id === lead.id && member.role === 'employee');
        const memberIds = new Set(teamMembers.map((member) => member.id));
        const teamRows = visibleRows.filter((row) => memberIds.has(row.submitted_by || ''));
        const closedCount = teamRows.filter((row) => normalizeStatus(row.closure_status) === 'closed').length;
        const pendingCount = teamRows.filter((row) => normalizeStatus(row.closure_status) !== 'closed').length;
        const piRevenue = teamRows.filter((row) => isPiInvoiceType(row.invoice_type)).reduce((sum, row) => sum + safeNumber(row.commercials), 0);
        const tiRevenue = teamRows.filter((row) => isTiInvoiceType(row.invoice_type)).reduce((sum, row) => sum + safeNumber(row.commercials), 0);
        const resubmissions = teamRows.filter((row) => row.intake_status === 'rejected').length;
        return {
          ...lead,
          teamMembers: teamMembers.length,
          teamSubmissions: teamRows.length,
          closedCount,
          pendingCount,
          piRevenue,
          tiRevenue,
          completionRate: teamRows.length > 0 ? closedCount / teamRows.length : 0,
          resubmissionRate: teamRows.length > 0 ? resubmissions / teamRows.length : 0,
        };
      })
      .sort((left, right) => right.teamSubmissions - left.teamSubmissions || right.closedCount - left.closedCount);
  }, [users, visibleRows]);

  const financeSummary = useMemo(() => {
    const reviewedRows = visibleRows.filter((row) => row.reviewed_by);
    const avgReviewDays = average(
      reviewedRows
        .map((row) => {
          if (!row.reviewed_at || !row.submitted_at) return null;
          const reviewedAt = new Date(row.reviewed_at).getTime();
          const submittedAt = new Date(row.submitted_at).getTime();
          if (!Number.isFinite(reviewedAt) || !Number.isFinite(submittedAt) || reviewedAt < submittedAt) return null;
          return (reviewedAt - submittedAt) / (1000 * 60 * 60 * 24);
        })
        .filter((value): value is number => value !== null)
    );

    const financeUsers = users.filter((entry) => entry.role === 'finance');
    const userRows = financeUsers
      .map((financeUser) => {
        const touchedRows = visibleRows.filter((row) => row.reviewed_by === financeUser.id);
        const completed = touchedRows.filter((row) => normalizeStatus(row.closure_status) === 'closed').length;
        const pending = touchedRows.filter((row) => normalizeStatus(row.closure_status) !== 'closed').length;
        const personalReviewTimes = touchedRows
          .map((row) => {
            if (!row.reviewed_at || !row.submitted_at) return null;
            const reviewedAt = new Date(row.reviewed_at).getTime();
            const submittedAt = new Date(row.submitted_at).getTime();
            if (!Number.isFinite(reviewedAt) || !Number.isFinite(submittedAt) || reviewedAt < submittedAt) return null;
            return (reviewedAt - submittedAt) / (1000 * 60 * 60 * 24);
          })
          .filter((value): value is number => value !== null);
        return {
          ...financeUser,
          touched: touchedRows.length,
          completed,
          pending,
          avgReviewDays: average(personalReviewTimes),
        };
      })
      .sort((left, right) => right.touched - left.touched);

    return {
      reviewedCount: reviewedRows.length,
      pendingCount: visibleRows.filter((row) => row.intake_status === 'submitted').length,
      closedCount: visibleRows.filter((row) => normalizeStatus(row.closure_status) === 'closed').length,
      avgReviewDays,
      userRows,
    };
  }, [users, visibleRows]);

  const operationsSummary = useMemo(() => {
    const openRows = visibleRows.filter((row) => normalizeStatus(row.closure_status) !== 'closed');
    const aging = {
      zeroToThree: openRows.filter((row) => {
        const age = ageInDays(row.submitted_at);
        return age !== null && age < 3;
      }).length,
      threeToSeven: openRows.filter((row) => {
        const age = ageInDays(row.submitted_at);
        return age !== null && age >= 3 && age < 7;
      }).length,
      sevenToFifteen: openRows.filter((row) => {
        const age = ageInDays(row.submitted_at);
        return age !== null && age >= 7 && age < 15;
      }).length,
      fifteenPlus: openRows.filter((row) => {
        const age = ageInDays(row.submitted_at);
        return age !== null && age >= 15;
      }).length,
    };

    const followUpRows = employeeRows
      .map((entry) => {
        const personalRows = openRows.filter((row) => row.submitted_by === entry.id);
        const overdue = personalRows.filter((row) => {
          const age = ageInDays(row.submitted_at);
          return age !== null && age >= 7;
        }).length;
        const dueSoon = personalRows.filter((row) => {
          const age = ageInDays(row.submitted_at);
          return age !== null && age >= 3 && age < 7;
        }).length;
        const onTime = personalRows.filter((row) => {
          const age = ageInDays(row.submitted_at);
          return age !== null && age < 3;
        }).length;
        return {
          label: entry.full_name,
          overdue,
          dueSoon,
          onTime,
          total: overdue + dueSoon + onTime,
        };
      })
      .filter((entry) => entry.total > 0)
      .sort((left, right) => right.total - left.total)
      .slice(0, 5);

    const financeReviewAges = openRows.filter((row) => row.intake_status === 'submitted').map((row) => ageInDays(row.submitted_at)).filter((value): value is number => value !== null);
    const paymentAges = openRows.filter((row) => row.intake_status === 'accepted').map((row) => ageInDays(row.submitted_at)).filter((value): value is number => value !== null);
    const resubmissionAges = openRows.filter((row) => row.intake_status === 'rejected').map((row) => ageInDays(row.submitted_at)).filter((value): value is number => value !== null);
    const masterDataAges = masterDataItems.filter((item) => item.status === 'pending').map((item) => ageInDays(item.created_at)).filter((value): value is number => value !== null);

    return {
      aging,
      followUpRows,
      queueAgeDays: {
        finance: average(financeReviewAges) ?? 0,
        masterData: average(masterDataAges) ?? 0,
        payment: average(paymentAges) ?? 0,
        resubmission: average(resubmissionAges) ?? 0,
      },
    };
  }, [employeeRows, masterDataItems, visibleRows]);

  const recentActivityItems = useMemo<Array<{ title: string; subtitle: string; meta: string; tone: 'rose' | 'green' | 'cyan' }>>(() => {
    return visibleRows.slice(0, 5).map((entry) => ({
      title: `${entry.id.slice(0, 8)} · ${entry.intake_status === 'rejected' ? 'Resubmission requested' : entry.intake_status === 'accepted' ? 'Submission approved' : 'Submission received'}`,
      subtitle: `${userNameById.get(entry.submitted_by || '') || entry.submitted_by || 'Unknown'} · ${entry.business_line || 'Unassigned'}`,
      meta: entry.submitted_at ? new Date(entry.submitted_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '',
      tone: entry.intake_status === 'rejected' ? 'rose' : entry.intake_status === 'accepted' ? 'green' : 'cyan',
    }));
  }, [userNameById, visibleRows]);

  const revenuePoints = useMemo(
    () => revenueSeries.map((point) => ({ label: point.label, values: { pi: point.pi, ti: point.ti } })),
    [revenueSeries]
  );

  const imTmComparisonPoints = useMemo(
    () => monthlyBuckets.map((point) => ({ label: point.label, values: { im: point.imPi + point.imTi, tm: point.tmPi + point.tmTi } })),
    [monthlyBuckets]
  );

  const stackedRevenuePoints = useMemo(
    () => monthlyBuckets.map((point) => ({ label: point.label, values: { imPi: point.imPi, tmPi: point.tmPi, imTi: point.imTi, tmTi: point.tmTi } })),
    [monthlyBuckets]
  );

  const employeeDistributionPoints = useMemo(
    () => employeeRows.slice(0, 8).map((entry) => ({ label: entry.full_name.split(' ')[0] || entry.full_name, values: { submissions: entry.submissions } })),
    [employeeRows]
  );

  const teamSubmissionPoints = useMemo(
    () => teamLeadRows.slice(0, 6).map((entry) => ({ label: entry.full_name.split(' ')[0] || entry.full_name, values: { submitted: entry.teamSubmissions, closed: entry.closedCount } })),
    [teamLeadRows]
  );

  const teamRevenuePoints = useMemo(
    () => teamLeadRows.slice(0, 6).map((entry) => ({ label: entry.full_name.split(' ')[0] || entry.full_name, values: { pi: entry.piRevenue, ti: entry.tiRevenue } })),
    [teamLeadRows]
  );

  const financeThroughputPoints = useMemo(
    () => monthlyBuckets.map((point) => ({ label: point.label, values: { completed: point.reviewed, pending: point.pending } })),
    [monthlyBuckets]
  );

  const closedTrendPoints = useMemo(
    () => monthlyBuckets.map((point) => ({ label: point.label, values: { closed: point.closed } })),
    [monthlyBuckets]
  );

  const resubmissionTrendPoints = useMemo(
    () => monthlyBuckets.map((point) => ({ label: point.label, values: { resubmissions: point.resubmissions, reopened: point.reopened } })),
    [monthlyBuckets]
  );

  if (loading || !user) return null;
  if (pageLoading) return <WorkspaceLoader variant="section" label="Loading analytics..." />;
  if (error) return <StatePanel tone="danger">{error}</StatePanel>;

  const analyticsOverviewGrid = (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <AnalyticsMetricCard title="Total PI revenue" value={formatCompactCurrency(overviewMetrics.totalPiRevenue)} trend={getMonthTrendLabel(overviewMetrics.piTrend)} tone="navy" sparkline={overviewMetrics.piTrend} />
        <AnalyticsMetricCard title="Total TI revenue" value={formatCompactCurrency(overviewMetrics.totalTiRevenue)} trend={getMonthTrendLabel(overviewMetrics.tiTrend)} tone="cyan" sparkline={overviewMetrics.tiTrend} />
        <AnalyticsMetricCard title="Pending finance" value={String(overviewMetrics.pendingFinance)} hint="needs review" tone="amber" />
        <AnalyticsMetricCard title="IM PI revenue" value={formatCompactCurrency(overviewMetrics.imPiRevenue)} trend={getMonthTrendLabel(monthlyBuckets.map((entry) => entry.imPi), '%')} tone="cyan" />
        <AnalyticsMetricCard title="TM PI revenue" value={formatCompactCurrency(overviewMetrics.tmPiRevenue)} trend={getMonthTrendLabel(monthlyBuckets.map((entry) => entry.tmPi), '%')} tone="navy" />
        <AnalyticsMetricCard title="Master data pending" value={String(overviewMetrics.pendingMasterData)} hint="awaiting approval" tone="amber" />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <AnalyticsMetricCard title="IM TI revenue" value={formatCompactCurrency(overviewMetrics.imTiRevenue)} trend={getMonthTrendLabel(monthlyBuckets.map((entry) => entry.imTi), '%')} tone="teal" />
        <AnalyticsMetricCard title="TM TI revenue" value={formatCompactCurrency(overviewMetrics.tmTiRevenue)} trend={getMonthTrendLabel(monthlyBuckets.map((entry) => entry.tmTi), '%')} tone="teal" />
        <AnalyticsMetricCard title="Submissions this month" value={String(overviewMetrics.submissionsThisMonth)} hint="current intake" trend={getCountDeltaLabel(overviewMetrics.submissionTrend)} tone="green" sparkline={overviewMetrics.submissionTrend} />
        <AnalyticsMetricCard title="Closed this month" value={String(overviewMetrics.closedThisMonth)} hint="completed" trend={getCountDeltaLabel(overviewMetrics.closedTrend)} tone="green" sparkline={overviewMetrics.closedTrend} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <AnalyticsPanel title="Revenue trend — 6 months" subtitle="PI and TI revenue over the latest six monthly buckets.">
          <LineAreaChart
            points={revenuePoints}
            series={[
              { key: 'pi', label: 'PI revenue', color: PI_COLOR, fill: '#6366f1' },
              { key: 'ti', label: 'TI revenue', color: TI_COLOR, fill: '#06b6d4' },
            ]}
            valueFormatter={(value) => formatCompactCurrency(value)}
          />
        </AnalyticsPanel>
        <AnalyticsPanel title="IM vs TM split" subtitle="Combined PI + TI contribution by business line.">
          <DonutChart
            centerLabel="total"
            centerValue={formatCompactCurrency(overviewMetrics.imPiRevenue + overviewMetrics.tmPiRevenue + overviewMetrics.imTiRevenue + overviewMetrics.tmTiRevenue)}
            segments={[
              { label: 'IM', value: overviewMetrics.imPiRevenue + overviewMetrics.imTiRevenue, color: IM_COLOR, note: formatCompactCurrency(overviewMetrics.imPiRevenue + overviewMetrics.imTiRevenue) },
              { label: 'TM', value: overviewMetrics.tmPiRevenue + overviewMetrics.tmTiRevenue, color: TM_COLOR, note: formatCompactCurrency(overviewMetrics.tmPiRevenue + overviewMetrics.tmTiRevenue) },
            ]}
          />
        </AnalyticsPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)_minmax(320px,0.85fr)]">
        <AnalyticsPanel title="Top employees" subtitle="Ranked by submission count and revenue contribution.">
          <RankedProgressList
            items={employeeRows.slice(0, 5).map((entry) => ({
              label: entry.full_name,
              sublabel: entry.business_line || 'Unassigned',
              value: entry.submissions,
              displayValue: `${entry.submissions} subs`,
              accent: formatCompactCurrency(entry.totalRevenue),
              color: entry.business_line === 'TM' ? `linear-gradient(90deg, ${TM_COLOR}, #67e8f9)` : `linear-gradient(90deg, ${IM_COLOR}, #8b5cf6)`,
            }))}
            emptyLabel="No employee submissions yet."
          />
        </AnalyticsPanel>

        <AnalyticsPanel title="Finance throughput" subtitle="Current review completion and active review pace.">
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-emerald-200/80 bg-emerald-50/80 px-4 py-4 text-center dark:border-emerald-500/35 dark:bg-emerald-500/10">
                <div className="text-[2.4rem] font-bold leading-none text-emerald-700 dark:text-emerald-300">{financeSummary.reviewedCount}</div>
                <div className="mt-2 text-base font-medium text-emerald-700/90 dark:text-emerald-200">completed</div>
              </div>
              <div className="rounded-[22px] border border-amber-200/80 bg-amber-50/80 px-4 py-4 text-center dark:border-amber-500/35 dark:bg-amber-500/10">
                <div className="text-[2.4rem] font-bold leading-none text-amber-700 dark:text-amber-300">{financeSummary.pendingCount}</div>
                <div className="mt-2 text-base font-medium text-amber-700/90 dark:text-amber-200">pending</div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Avg review time: <span className="font-semibold text-foreground">{financeSummary.avgReviewDays === null ? '—' : `${financeSummary.avgReviewDays.toFixed(1)} days`}</span></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {financeSummary.userRows.slice(0, 2).map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-border/60 px-3.5 py-3">
                  <div className="text-sm font-semibold text-foreground">{entry.full_name}</div>
                  <div className="mt-1 text-lg font-bold text-foreground">{formatDays(entry.avgReviewDays)}</div>
                  <div className="text-xs text-muted-foreground">{entry.touched} touched</div>
                </div>
              ))}
            </div>
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel title="Team leads" subtitle="Completion view across mapped teams.">
          <RankedProgressList
            items={teamLeadRows.slice(0, 4).map((entry) => ({
              label: entry.full_name,
              sublabel: entry.business_line || 'Unassigned',
              value: Math.round(entry.completionRate * 100),
              displayValue: `${Math.round(entry.completionRate * 100)}%`,
              accent: `${entry.teamMembers} members`,
              color: entry.business_line === 'TM' ? `linear-gradient(90deg, ${TM_COLOR}, #67e8f9)` : `linear-gradient(90deg, ${IM_COLOR}, #8b5cf6)`,
            }))}
            emptyLabel="No mapped team leads yet."
          />
        </AnalyticsPanel>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <AnalyticsMetricCard title="Active employees" value={String(users.filter((entry) => entry.role === 'employee' && entry.status === 'active').length)} hint="employee access" tone="slate" />
        <AnalyticsMetricCard title="Active team leads" value={String(users.filter((entry) => entry.role === 'team_lead' && entry.status === 'active').length)} hint="mapped lead access" tone="slate" />
        <AnalyticsMetricCard title="Active finance users" value={String(users.filter((entry) => entry.role === 'finance' && entry.status === 'active').length)} hint="finance access" tone="slate" />
        <AnalyticsMetricCard title="Master data approved" value={String(masterDataSummary.approved)} hint="reusable values" tone="slate" />
      </section>
    </div>
  );

  return (
    <div className="grid gap-5">
      <PageHeader
        className="gap-3 border-b-0 pb-1"
        title="Analytics"
        description="Role-based company insights across revenue, operations, employees, and finance."
      />

      <div className="flex flex-wrap gap-2.5">
        {TABS.map((entry) => (
          <button key={entry.value} type="button" onClick={() => setTab(entry.value)} className={buildTabButtonClass(tab === entry.value)}>
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? analyticsOverviewGrid : null}

      {tab === 'revenue' ? (
        <div className="grid gap-5">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AnalyticsMetricCard title="Total PI revenue" value={formatCompactCurrency(overviewMetrics.totalPiRevenue)} trend={getMonthTrendLabel(overviewMetrics.piTrend)} tone="navy" sparkline={overviewMetrics.piTrend} />
            <AnalyticsMetricCard title="Total TI revenue" value={formatCompactCurrency(overviewMetrics.totalTiRevenue)} trend={getMonthTrendLabel(overviewMetrics.tiTrend)} tone="cyan" sparkline={overviewMetrics.tiTrend} />
            <AnalyticsMetricCard title="Submissions this month" value={String(overviewMetrics.submissionsThisMonth)} trend={getCountDeltaLabel(overviewMetrics.submissionTrend)} tone="green" sparkline={overviewMetrics.submissionTrend} />
            <AnalyticsMetricCard title="Closed this month" value={String(overviewMetrics.closedThisMonth)} trend={getCountDeltaLabel(overviewMetrics.closedTrend)} tone="amber" sparkline={overviewMetrics.closedTrend} />
          </section>

          <AnalyticsPanel title="Revenue trend — PI and TI (6 months)">
            <LineAreaChart
              points={revenuePoints}
              series={[
                { key: 'pi', label: 'PI revenue', color: PI_COLOR, fill: '#6366f1' },
                { key: 'ti', label: 'TI revenue', color: TI_COLOR, fill: '#06b6d4' },
              ]}
              valueFormatter={(value) => formatCompactCurrency(value)}
            />
          </AnalyticsPanel>

          <section className="grid gap-5 xl:grid-cols-2">
            <AnalyticsPanel title="IM vs TM — monthly comparison">
              <GroupedBarChart
                points={imTmComparisonPoints}
                series={[
                  { key: 'im', label: 'IM', color: IM_COLOR },
                  { key: 'tm', label: 'TM', color: TM_COLOR },
                ]}
              />
            </AnalyticsPanel>
            <AnalyticsPanel title="Revenue distribution">
              <DonutChart
                centerLabel="mix"
                centerValue={formatCompactCurrency(overviewMetrics.totalPiRevenue + overviewMetrics.totalTiRevenue)}
                segments={[
                  { label: 'IM PI', value: overviewMetrics.imPiRevenue, color: IM_COLOR },
                  { label: 'TM PI', value: overviewMetrics.tmPiRevenue, color: '#8b5cf6' },
                  { label: 'IM TI', value: overviewMetrics.imTiRevenue, color: TM_COLOR },
                  { label: 'TM TI', value: overviewMetrics.tmTiRevenue, color: TM_TI_COLOR },
                ]}
              />
            </AnalyticsPanel>
          </section>

          <AnalyticsPanel title="Monthly revenue breakdown (stacked)">
            <StackedBarChart
              points={stackedRevenuePoints}
              series={[
                { key: 'imPi', label: 'IM PI', color: IM_COLOR },
                { key: 'tmPi', label: 'TM PI', color: '#8b5cf6' },
                { key: 'imTi', label: 'IM TI', color: TM_COLOR },
                { key: 'tmTi', label: 'TM TI', color: TM_TI_COLOR },
              ]}
            />
          </AnalyticsPanel>
        </div>
      ) : null}

      {tab === 'employees' ? (
        <div className="grid gap-5">
          <AnalyticsPanel title="Top performers — by submissions and revenue">
            <RankedProgressList
              items={employeeRows.slice(0, 5).map((entry) => ({
                label: entry.full_name,
                value: entry.submissions,
                displayValue: `${entry.submissions} subs`,
                accent: formatCompactCurrency(entry.totalRevenue),
                color: entry.business_line === 'TM' ? `linear-gradient(90deg, ${TM_COLOR}, #67e8f9)` : `linear-gradient(90deg, ${IM_COLOR}, #8b5cf6)`,
              }))}
              emptyLabel="No employee activity yet."
            />
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-[#8b5cf6]" />TM</span>
              <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-[#06b6d4]" />IM</span>
            </div>
          </AnalyticsPanel>

          <section className="grid gap-5 xl:grid-cols-2">
            <AnalyticsPanel title="Submission distribution">
              <GroupedBarChart points={employeeDistributionPoints} series={[{ key: 'submissions', label: 'Submissions', color: IM_COLOR }]} />
            </AnalyticsPanel>
            <AnalyticsPanel title="Revenue contribution">
              <DonutChart
                centerLabel="revenue"
                centerValue={formatCompactCurrency(employeeRows.reduce((sum, entry) => sum + entry.totalRevenue, 0))}
                segments={(() => {
                  const top = employeeRows.filter((entry) => entry.totalRevenue > 0).slice(0, 3);
                  const others = employeeRows.slice(3).reduce((sum, entry) => sum + entry.totalRevenue, 0);
                  return [
                    ...top.map((entry, index) => ({
                      label: entry.full_name,
                      value: entry.totalRevenue,
                      color: [IM_COLOR, '#8b5cf6', TM_COLOR][index] || '#cbd5e1',
                    })),
                    { label: 'Others', value: others, color: '#d1d5db' },
                  ].filter((entry) => entry.value > 0);
                })()}
              />
            </AnalyticsPanel>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <AnalyticsPanel title="Resubmission rate">
              <RankedProgressList
                items={employeeRows
                  .filter((entry) => entry.submissions > 0)
                  .sort((left, right) => right.resubmissionRate - left.resubmissionRate)
                  .slice(0, 5)
                  .map((entry) => ({
                    label: entry.full_name,
                    value: Math.round(entry.resubmissionRate * 100),
                    displayValue: formatRate(entry.resubmissionRate),
                    color: entry.resubmissionRate >= 0.15 ? 'linear-gradient(90deg, #ef4444, #f59e0b)' : 'linear-gradient(90deg, #10b981, #06b6d4)',
                    accent: `${entry.resubmissions}/${entry.submissions}`,
                  }))}
                emptyLabel="No resubmissions yet."
              />
            </AnalyticsPanel>
            <AnalyticsPanel title="Business line split">
              <DonutChart
                centerLabel="employees"
                centerValue={String(employeeRows.length)}
                segments={[
                  { label: 'TM', value: employeeRows.filter((entry) => entry.business_line === 'TM').length, color: IM_COLOR },
                  { label: 'IM', value: employeeRows.filter((entry) => entry.business_line === 'IM').length, color: TM_COLOR },
                  { label: 'Unassigned', value: employeeRows.filter((entry) => entry.business_line == null).length, color: '#cbd5e1' },
                ]}
              />
            </AnalyticsPanel>
          </section>
        </div>
      ) : null}

      {tab === 'team_leads' ? (
        <div className="grid gap-5">
          <AnalyticsPanel title="Team overview">
            <GaugeGrid
              items={teamLeadRows.slice(0, 3).map((entry) => ({
                label: entry.full_name,
                subtitle: entry.business_line || 'Unassigned',
                value: entry.completionRate,
                detail: `${entry.teamMembers} members · ${formatCompactCurrency(entry.piRevenue + entry.tiRevenue)}`,
                tone: entry.business_line === 'TM' ? 'cyan' : 'green',
              }))}
            />
          </AnalyticsPanel>

          <section className="grid gap-5 xl:grid-cols-2">
            <AnalyticsPanel title="Team submissions">
              <GroupedBarChart
                points={teamSubmissionPoints}
                series={[
                  { key: 'submitted', label: 'Submitted', color: IM_COLOR },
                  { key: 'closed', label: 'Closed', color: '#10b981' },
                ]}
              />
            </AnalyticsPanel>
            <AnalyticsPanel title="Team revenue (PI + TI)">
              <StackedBarChart
                points={teamRevenuePoints}
                series={[
                  { key: 'pi', label: 'PI revenue', color: IM_COLOR },
                  { key: 'ti', label: 'TI revenue', color: TM_COLOR },
                ]}
              />
            </AnalyticsPanel>
          </section>

          <AnalyticsPanel title="Pending approvals by team">
            <RankedProgressList
              items={teamLeadRows.map((entry) => ({
                label: `${entry.full_name} (${entry.business_line || 'Unassigned'})`,
                value: entry.pendingCount,
                displayValue: `${entry.pendingCount} pending`,
                sublabel: `Resubmission rate ${formatRate(entry.resubmissionRate)}`,
                color: entry.pendingCount >= 6 ? 'linear-gradient(90deg, #ef4444, #fb7185)' : entry.pendingCount >= 3 ? 'linear-gradient(90deg, #f59e0b, #facc15)' : 'linear-gradient(90deg, #10b981, #34d399)',
              }))}
              emptyLabel="No team approvals waiting."
            />
          </AnalyticsPanel>
        </div>
      ) : null}

      {tab === 'finance' ? (
        <div className="grid gap-5">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AnalyticsMetricCard title="Reviews completed" value={String(financeSummary.reviewedCount)} hint="this month slice" tone="green" />
            <AnalyticsMetricCard title="Pending reviews" value={String(financeSummary.pendingCount)} hint="awaiting action" tone="amber" />
            <AnalyticsMetricCard title="Master data reviews" value={String(masterDataSummary.total)} hint="in queue" tone="navy" />
            <AnalyticsMetricCard title="Closed work" value={String(financeSummary.closedCount)} hint="workflow complete" tone="cyan" />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
            <AnalyticsPanel title="Review throughput — 6 months">
              <LineAreaChart
                points={financeThroughputPoints}
                series={[
                  { key: 'completed', label: 'Completed', color: '#10b981', fill: '#10b981' },
                  { key: 'pending', label: 'Pending', color: '#f59e0b', fill: '#f59e0b' },
                ]}
              />
            </AnalyticsPanel>
            <AnalyticsPanel title="Avg review time">
              <div className="grid h-full gap-5">
                <div className="pt-8 text-center">
                  <div className="text-[4.25rem] font-bold leading-none tracking-tight text-foreground">{financeSummary.avgReviewDays === null ? '—' : financeSummary.avgReviewDays.toFixed(1)}</div>
                  <div className="mt-3 text-2xl text-muted-foreground">days average</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {financeSummary.userRows.slice(0, 2).map((entry) => (
                    <div key={entry.id} className={`rounded-[20px] px-4 py-4 text-center ${entry.avgReviewDays !== null && entry.avgReviewDays <= (financeSummary.avgReviewDays ?? entry.avgReviewDays) ? 'border border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-500/35 dark:bg-emerald-500/10' : 'border border-amber-200/80 bg-amber-50/80 dark:border-amber-500/35 dark:bg-amber-500/10'}`}>
                      <div className="text-[2rem] font-bold leading-none text-foreground">{formatDays(entry.avgReviewDays)}</div>
                      <div className="mt-2 text-base font-medium text-muted-foreground">{entry.full_name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </AnalyticsPanel>
          </section>

          <AnalyticsPanel title="Finance user workload breakdown">
            <StackedWorkloadRows
              rows={financeSummary.userRows.map((entry) => ({
                label: entry.full_name,
                totalLabel: String(entry.touched),
                values: {
                  completed: entry.completed,
                  pending: entry.pending,
                  closed: entry.completed,
                },
              }))}
              segments={[
                { key: 'completed', label: 'Completed', color: '#10b981' },
                { key: 'pending', label: 'Pending', color: '#f59e0b' },
                { key: 'closed', label: 'Closed', color: '#06b6d4' },
              ]}
            />
          </AnalyticsPanel>

          <AnalyticsPanel title="Closed submissions — monthly trend">
            <GroupedBarChart points={closedTrendPoints} series={[{ key: 'closed', label: 'Closed', color: '#06b6d4' }]} />
          </AnalyticsPanel>
        </div>
      ) : null}

      {tab === 'operations' ? (
        <div className="grid gap-5">
          <AnalyticsPanel title="Aging buckets">
            <AgingBuckets
              buckets={[
                { label: '0–3 days', value: operationsSummary.aging.zeroToThree, note: 'On track', tone: 'green' },
                { label: '3–7 days', value: operationsSummary.aging.threeToSeven, note: 'Needs follow-up', tone: 'amber' },
                { label: '7–15 days', value: operationsSummary.aging.sevenToFifteen, note: 'At risk', tone: 'rose' },
                { label: '15+ days', value: operationsSummary.aging.fifteenPlus, note: 'Escalation', tone: 'violet' },
              ]}
            />
          </AnalyticsPanel>

          <section className="grid gap-5 xl:grid-cols-2">
            <AnalyticsPanel title="Workflow bottlenecks">
              <WorkflowBars
                rows={[
                  { label: 'Submission', value: visibleRows.length, tone: 'navy' },
                  { label: 'Finance review', value: overviewMetrics.pendingFinance, tone: 'violet' },
                  { label: 'Master data', value: masterDataSummary.pending, tone: 'rose' },
                  { label: 'Payment', value: visibleRows.filter((row) => row.intake_status === 'accepted' && normalizeStatus(row.closure_status) !== 'closed').length, tone: 'amber' },
                  { label: 'Closed', value: financeSummary.closedCount, tone: 'slate' },
                ]}
              />
            </AnalyticsPanel>
            <AnalyticsPanel title="Follow-up distribution">
              <DotStatusList rows={operationsSummary.followUpRows.map((entry) => ({ label: entry.label, overdue: entry.overdue, dueSoon: entry.dueSoon, onTime: entry.onTime, totalLabel: String(entry.total) }))} />
            </AnalyticsPanel>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <AnalyticsPanel title="Resubmission trends — 6 months">
              <LineAreaChart
                points={resubmissionTrendPoints}
                series={[
                  { key: 'resubmissions', label: 'Resubmissions', color: '#ef4444', fill: '#ef4444' },
                  { key: 'reopened', label: 'Reopened', color: '#f59e0b', fill: '#f59e0b' },
                ]}
              />
            </AnalyticsPanel>
            <AnalyticsPanel title="Pending queue age (days)">
              <WorkflowBars
                rows={[
                  { label: 'Finance review', value: Math.round(operationsSummary.queueAgeDays.finance * 10) / 10, tone: 'amber' },
                  { label: 'Master data', value: Math.round(operationsSummary.queueAgeDays.masterData * 10) / 10, tone: 'rose' },
                  { label: 'Payment', value: Math.round(operationsSummary.queueAgeDays.payment * 10) / 10, tone: 'green' },
                  { label: 'Resubmission', value: Math.round(operationsSummary.queueAgeDays.resubmission * 10) / 10, tone: 'violet' },
                ]}
              />
            </AnalyticsPanel>
          </section>
        </div>
      ) : null}

      <AnalyticsPanel title="Recent activity" subtitle="Visible company workflow events from the latest submission activity.">
        <TimelineList
          items={recentActivityItems}
          emptyLabel="No recent activity yet. Submission, finance, master data, and user events will appear here once activity begins."
        />
      </AnalyticsPanel>
    </div>
  );
}
