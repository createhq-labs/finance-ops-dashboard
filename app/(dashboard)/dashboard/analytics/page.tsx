"use client";

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, LineChart } from 'lucide-react';
import { KpiCard } from '../../../../components/dashboard/kpi-card';
import { PageHeader } from '../../../../components/dashboard/page-header';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { StatePanel } from '../../../../components/dashboard/state-panel';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { WorkspaceLoader } from '../../../../components/layout/workspace-loader';
import { canViewAnalyticsPage, getDefaultDashboardPath } from '../../../../lib/client/dashboard-access';
import { getRevenueSeries, getLineRevenue, isPiInvoiceType, isTiInvoiceType, type RevenueSeriesPoint } from '../../../../lib/client/admin-stats';

type AnalyticsSubmissionRow = {
  id: string;
  submitted_by: string | null;
  full_name?: string | null;
  invoice_type: string | null;
  business_line: 'IM' | 'TM' | null;
  submitted_at: string | null;
  intake_status: 'submitted' | 'rejected' | 'accepted';
  closure_status: string | null;
  reviewed_by: string | null;
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
  summary?: MasterDataSummary;
  error?: string;
};

const TABS: Array<{ value: AnalyticsTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'employees', label: 'Employees' },
  { value: 'team_leads', label: 'Team Leads' },
  { value: 'finance', label: 'Finance' },
  { value: 'operations', label: 'Operations' },
];

function compactButtonClass(active = false) {
  return active
    ? 'inline-flex items-center justify-center rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold text-foreground shadow-sm shadow-primary/10 transition-colors'
    : 'inline-flex items-center justify-center rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/30';
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRate(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function lineLabel(value: 'IM' | 'TM' | null) {
  return value ?? 'Unassigned';
}

function SeriesChart({ series }: { series: RevenueSeriesPoint[] }) {
  if (series.length === 0) {
    return <div className="text-sm text-muted-foreground">No revenue data available yet.</div>;
  }

  const width = 700;
  const height = 220;
  const maxValue = Math.max(1, ...series.map((point) => Math.max(point.pi, point.ti)));
  const leftPadding = 28;
  const rightPadding = 16;
  const topPadding = 20;
  const bottomPadding = 28;
  const innerWidth = width - leftPadding - rightPadding;
  const innerHeight = height - topPadding - bottomPadding;

  const buildPath = (selector: 'pi' | 'ti') => {
    return series
      .map((point, index) => {
        const x = leftPadding + (innerWidth * index) / Math.max(series.length - 1, 1);
        const y = topPadding + innerHeight - (innerHeight * point[selector]) / maxValue;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  const piPath = buildPath('pi');
  const tiPath = buildPath('ti');

  return (
    <div className="grid gap-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full overflow-visible">
        <defs>
          <linearGradient id="pi-gradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgb(56 189 248)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="ti-gradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = topPadding + innerHeight - innerHeight * ratio;
          return <line key={ratio} x1={leftPadding} x2={width - rightPadding} y1={y} y2={y} stroke="currentColor" className="text-border/40" strokeDasharray="3 6" />;
        })}

        <path d={piPath} fill="none" stroke="url(#pi-gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={tiPath} fill="none" stroke="url(#ti-gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {series.map((point, index) => {
          const x = leftPadding + (innerWidth * index) / Math.max(series.length - 1, 1);
          const piY = topPadding + innerHeight - (innerHeight * point.pi) / maxValue;
          const tiY = topPadding + innerHeight - (innerHeight * point.ti) / maxValue;
          return (
            <g key={point.key}>
              <circle cx={x} cy={piY} r="4" fill="rgb(56 189 248)" />
              <circle cx={x} cy={tiY} r="4" fill="rgb(52 211 153)" />
              <text x={x} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
          PI Revenue
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          TI Revenue
        </span>
      </div>
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={compactButtonClass(active)}>
      {label}
    </button>
  );
}

export default function AnalyticsPage() {
  const { user, loading } = useDashboardSession();
  const [tab, setTab] = useState<AnalyticsTab>('overview');
  const [submissions, setSubmissions] = useState<AnalyticsSubmissionRow[]>([]);
  const [users, setUsers] = useState<AnalyticsUserRow[]>([]);
  const [masterDataSummary, setMasterDataSummary] = useState<MasterDataSummary>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const userNameById = useMemo(() => new Map(users.map((entry) => [entry.id, entry.full_name])), [users]);

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

        if (!submissionsRes.ok || !submissionsJson.success) {
          throw new Error(submissionsJson.error || 'Failed to load submissions.');
        }
        if (!usersRes.ok || !usersJson.success) {
          throw new Error(usersJson.error || 'Failed to load users.');
        }
        if (!masterDataRes.ok || !masterDataJson.success) {
          throw new Error(masterDataJson.error || 'Failed to load master data reviews.');
        }

        if (!active) return;
        setSubmissions(Array.isArray(submissionsJson.submissions) ? submissionsJson.submissions : []);
        setUsers(Array.isArray(usersJson.users) ? usersJson.users : []);
        setMasterDataSummary(masterDataJson.summary ?? { total: 0, pending: 0, approved: 0, rejected: 0 });
      })
      .catch((nextError) => {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : 'Failed to load analytics.');
        }
      })
      .finally(() => {
        if (active) setPageLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const visibleRows = useMemo(() => [...submissions].sort((left, right) => new Date(right.submitted_at || '').getTime() - new Date(left.submitted_at || '').getTime()), [submissions]);
  const revenueSeries = useMemo(() => getRevenueSeries(visibleRows), [visibleRows]);

  const overviewMetrics = useMemo(() => {
    const totalPiRevenue = getLineRevenue(visibleRows, null, 'pi');
    const totalTiRevenue = getLineRevenue(visibleRows, null, 'ti');
    const imPiRevenue = getLineRevenue(visibleRows, 'IM', 'pi');
    const tmPiRevenue = getLineRevenue(visibleRows, 'TM', 'pi');
    const imTiRevenue = getLineRevenue(visibleRows, 'IM', 'ti');
    const tmTiRevenue = getLineRevenue(visibleRows, 'TM', 'ti');
    const submissionsThisMonth = visibleRows.filter((entry) => {
      const submittedAt = new Date(entry.submitted_at || '');
      const now = new Date();
      return submittedAt.getFullYear() === now.getFullYear() && submittedAt.getMonth() === now.getMonth();
    }).length;
    const closedThisMonth = visibleRows.filter((entry) => {
      const date = new Date(entry.submitted_at || '');
      const now = new Date();
      return entry.closure_status === 'closed' && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }).length;
    const pendingFinance = visibleRows.filter((entry) => entry.intake_status === 'submitted').length;

    return {
      totalPiRevenue,
      totalTiRevenue,
      imPiRevenue,
      tmPiRevenue,
      imTiRevenue,
      tmTiRevenue,
      submissionsThisMonth,
      closedThisMonth,
      pendingFinance,
    };
  }, [visibleRows]);

  const employeeRows = useMemo(() => {
    return users.filter((entry) => entry.role === 'employee').map((employee) => {
      const personalRows = visibleRows.filter((row) => row.submitted_by === employee.id);
      const resubmissions = personalRows.filter((row) => row.intake_status === 'rejected').length;
      const piRevenue = personalRows.filter((row) => isPiInvoiceType(row.invoice_type)).reduce((sum, row) => sum + Number(row.commercials ?? 0), 0);
      const tiRevenue = personalRows.filter((row) => isTiInvoiceType(row.invoice_type)).reduce((sum, row) => sum + Number(row.commercials ?? 0), 0);
      const closedCount = personalRows.filter((row) => row.closure_status === 'closed').length;
      return {
        ...employee,
        submissions: personalRows.length,
        resubmissions,
        resubmissionRate: personalRows.length > 0 ? resubmissions / personalRows.length : 0,
        piRevenue,
        tiRevenue,
        closedCount,
      };
    }).sort((left, right) => right.submissions - left.submissions);
  }, [users, visibleRows]);

  const teamLeadRows = useMemo(() => {
    return users.filter((entry) => entry.role === 'team_lead').map((lead) => {
      const teamMembers = users.filter((member) => member.team_lead_id === lead.id);
      const memberIds = new Set(teamMembers.map((member) => member.id));
      const teamRows = visibleRows.filter((row) => memberIds.has(row.submitted_by || ''));
      const resubmissions = teamRows.filter((row) => row.intake_status === 'rejected').length;
      const teamPiRevenue = teamRows.filter((row) => isPiInvoiceType(row.invoice_type)).reduce((sum, row) => sum + Number(row.commercials ?? 0), 0);
      const teamTiRevenue = teamRows.filter((row) => isTiInvoiceType(row.invoice_type)).reduce((sum, row) => sum + Number(row.commercials ?? 0), 0);
      return {
        ...lead,
        teamMembers: teamMembers.length,
        teamSubmissions: teamRows.length,
        teamPiRevenue,
        teamTiRevenue,
        resubmissionRate: teamRows.length > 0 ? resubmissions / teamRows.length : 0,
      };
    }).sort((left, right) => right.teamSubmissions - left.teamSubmissions);
  }, [users, visibleRows]);

  const financeRows = useMemo(() => {
    return users.filter((entry) => entry.role === 'finance').map((financeUser) => {
      const reviewedRows = visibleRows.filter((row) => row.reviewed_by === financeUser.id);
      return {
        ...financeUser,
        reviewsCompleted: reviewedRows.length,
        pendingReviews: visibleRows.filter((row) => row.intake_status === 'submitted').length,
        masterDataReviews: masterDataSummary.total,
        closedWork: reviewedRows.filter((row) => row.closure_status === 'closed').length,
      };
    });
  }, [masterDataSummary.total, users, visibleRows]);

  const pendingOver3 = useMemo(() => visibleRows.filter((entry) => {
    const diffDays = (Date.now() - new Date(entry.submitted_at || '').getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 3 && entry.closure_status !== 'closed';
  }).length, [visibleRows]);
  const pendingOver7 = useMemo(() => visibleRows.filter((entry) => {
    const diffDays = (Date.now() - new Date(entry.submitted_at || '').getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 7 && entry.closure_status !== 'closed';
  }).length, [visibleRows]);
  const pendingOver15 = useMemo(() => visibleRows.filter((entry) => {
    const diffDays = (Date.now() - new Date(entry.submitted_at || '').getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 15 && entry.closure_status !== 'closed';
  }).length, [visibleRows]);
  const mostFollowUps = useMemo(() => visibleRows.filter((entry) => entry.finance_comment || entry.rejection_note).slice(0, 5), [visibleRows]);
  const mostResubmissions = useMemo(() => visibleRows.filter((entry) => entry.intake_status === 'rejected').slice(0, 5), [visibleRows]);

  if (loading || !user) return null;
  if (pageLoading) {
    return <WorkspaceLoader variant="section" label="Loading analytics..." />;
  }
  if (error) return <StatePanel tone="danger">{error}</StatePanel>;

  return (
    <div className="grid gap-4">
      <PageHeader
        className="gap-3 border-b-0 pb-1"
        title="Analytics"
        description="Role-based company insights across revenue, operations, employees, and finance."
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((entry) => (
          <TabButton key={entry.value} active={tab === entry.value} label={entry.label} onClick={() => setTab(entry.value)} />
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-4">
          <section className="grid gap-3 md:grid-cols-4">
            <KpiCard title="Total PI Revenue" value={formatMoney(overviewMetrics.totalPiRevenue)} hint="Proforma-linked revenue" variant="navy" compact />
            <KpiCard title="Total TI Revenue" value={formatMoney(overviewMetrics.totalTiRevenue)} hint="Tax-invoice-linked revenue" variant="teal" compact />
            <KpiCard title="Pending Finance" value={String(overviewMetrics.pendingFinance)} hint="Needs finance review" variant="warning" compact />
            <KpiCard title="Master Data Pending" value={String(masterDataSummary.pending)} hint="Awaiting approval" variant="danger" compact />
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <KpiCard title="IM PI Revenue" value={formatMoney(overviewMetrics.imPiRevenue)} hint="Influencer Marketing" compact />
            <KpiCard title="TM PI Revenue" value={formatMoney(overviewMetrics.tmPiRevenue)} hint="Talent Management" compact />
            <KpiCard title="IM TI Revenue" value={formatMoney(overviewMetrics.imTiRevenue)} hint="Influencer Marketing" compact />
            <KpiCard title="TM TI Revenue" value={formatMoney(overviewMetrics.tmTiRevenue)} hint="Talent Management" compact />
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <KpiCard title="Submissions This Month" value={String(overviewMetrics.submissionsThisMonth)} hint="Current month intake" compact />
            <KpiCard title="Closed This Month" value={String(overviewMetrics.closedThisMonth)} hint="Completed workflows" compact />
            <KpiCard title="Active Employees" value={String(users.filter((entry) => entry.role === 'employee' && entry.status === 'active').length)} hint="Employee access" compact />
            <KpiCard title="Active Finance Users" value={String(users.filter((entry) => entry.role === 'finance' && entry.status === 'active').length)} hint="Finance access" compact />
          </section>
        </div>
      ) : null}

      {tab === 'revenue' ? (
        <SectionCard title="Revenue Trends" description="PI and TI revenue across recent months." contentClassName="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <SeriesChart series={revenueSeries} />
            </div>
            <div className="grid gap-3">
              <KpiCard title="Total PI Revenue" value={formatMoney(overviewMetrics.totalPiRevenue)} hint="All proforma-linked submissions" variant="navy" compact />
              <KpiCard title="Total TI Revenue" value={formatMoney(overviewMetrics.totalTiRevenue)} hint="All tax-invoice-linked submissions" variant="teal" compact />
              <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <LineChart className="h-4 w-4 text-sky-500" />
                  Method
                </div>
                <p className="mt-2 leading-6">
                  Revenue split uses the current invoice type labels already stored in submissions. PI and TI categories are shown separately to match the workflow surface.
                </p>
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {tab === 'employees' ? (
        <SectionCard title="Employees" description="Ranked by submission volume and workflow activity." contentClassName="grid gap-4">
          <div className="overflow-hidden rounded-2xl border border-border/60">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-[1] bg-app">
                <tr>
                  {['Employee', 'Business Line', 'Submissions', 'Resubmissions', 'Resubmission Rate', 'PI Revenue', 'TI Revenue', 'Closed Count'].map((heading) => (
                    <th key={heading} className="border-b border-border/60 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employeeRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-sm text-muted-foreground">
                      No employee data available.
                    </td>
                  </tr>
                ) : (
                  employeeRows.map((entry) => (
                    <tr key={entry.id} className="hover:bg-muted/20">
                      <td className="border-b border-border/50 px-4 py-3">
                        <div className="text-sm font-medium text-foreground">{entry.full_name}</div>
                        <div className="text-xs text-muted-foreground">{entry.email}</div>
                      </td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-muted-foreground">{lineLabel(entry.business_line)}</td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-foreground">{entry.submissions}</td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-foreground">{entry.resubmissions}</td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-foreground">{formatRate(entry.resubmissionRate)}</td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-foreground">{formatMoney(entry.piRevenue)}</td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-foreground">{formatMoney(entry.tiRevenue)}</td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-foreground">{entry.closedCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {tab === 'team_leads' ? (
        <SectionCard title="Team Leads" description="Mapped members and team submission performance." contentClassName="grid gap-4">
          <div className="overflow-hidden rounded-2xl border border-border/60">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-[1] bg-app">
                <tr>
                  {['Team Lead', 'Business Line', 'Team Members', 'Team Submissions', 'Team PI Revenue', 'Team TI Revenue', 'Team Resubmission Rate'].map((heading) => (
                    <th key={heading} className="border-b border-border/60 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamLeadRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-sm text-muted-foreground">
                      No team lead data available.
                    </td>
                  </tr>
                ) : (
                  teamLeadRows.map((entry) => (
                    <tr key={entry.id} className="hover:bg-muted/20">
                      <td className="border-b border-border/50 px-4 py-3">
                        <div className="text-sm font-medium text-foreground">{entry.full_name}</div>
                        <div className="text-xs text-muted-foreground">{entry.email}</div>
                      </td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-muted-foreground">{lineLabel(entry.business_line)}</td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-foreground">{entry.teamMembers}</td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-foreground">{entry.teamSubmissions}</td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-foreground">{formatMoney(entry.teamPiRevenue)}</td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-foreground">{formatMoney(entry.teamTiRevenue)}</td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-foreground">{formatRate(entry.resubmissionRate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {tab === 'finance' ? (
        <SectionCard title="Finance" description="Finance user throughput and review coverage." contentClassName="grid gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <KpiCard title="Reviews Completed" value={String(visibleRows.filter((row) => Boolean(row.reviewed_by)).length)} hint="Rows touched by finance" compact />
            <KpiCard title="Pending Reviews" value={String(visibleRows.filter((row) => row.intake_status === 'submitted').length)} hint="Awaiting review" compact />
            <KpiCard title="Master Data Reviews" value={String(masterDataSummary.total)} hint="Review queue volume" compact />
            <KpiCard title="Closed Work" value={String(visibleRows.filter((row) => row.closure_status === 'closed').length)} hint="Workflow complete" compact />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/60">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-[1] bg-app">
                <tr>
                  {['Finance User', 'Reviews Completed', 'Pending Reviews', 'Master Data Reviews', 'Closed Work'].map((heading) => (
                    <th key={heading} className="border-b border-border/60 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {financeRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-sm text-muted-foreground">
                      No finance users found.
                    </td>
                  </tr>
                ) : (
                  financeRows.map((entry) => (
                    <tr key={entry.id} className="hover:bg-muted/20">
                      <td className="border-b border-border/50 px-4 py-3">
                        <div className="text-sm font-medium text-foreground">{entry.full_name}</div>
                        <div className="text-xs text-muted-foreground">{entry.email}</div>
                      </td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-foreground">{entry.reviewsCompleted}</td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-foreground">{entry.pendingReviews}</td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-foreground">{entry.masterDataReviews}</td>
                      <td className="border-b border-border/50 px-4 py-3 text-sm text-foreground">{entry.closedWork}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {tab === 'operations' ? (
        <SectionCard title="Operations" description="Aging queues and high-touch submissions." contentClassName="grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <KpiCard title="Pending > 3 Days" value={String(pendingOver3)} hint="Older queue items" variant="warning" compact />
            <KpiCard title="Pending > 7 Days" value={String(pendingOver7)} hint="Needs follow-up" variant="danger" compact />
            <KpiCard title="Pending > 15 Days" value={String(pendingOver15)} hint="Escalation queue" variant="danger" compact />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                <ChevronRight className="h-4 w-4 text-sky-500" />
                Most Follow-Ups
              </div>
              <div className="grid gap-2">
                {mostFollowUps.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No follow-up notes available.</div>
                ) : (
                  mostFollowUps.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-border/60 px-3 py-2">
                      <div className="text-sm font-medium text-foreground">{userNameById.get(entry.submitted_by || '') || entry.submitted_by || entry.id}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(entry.submitted_at)} · {entry.finance_comment || entry.rejection_note}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                <ChevronLeft className="h-4 w-4 text-rose-500" />
                Most Resubmissions
              </div>
              <div className="grid gap-2">
                {mostResubmissions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No resubmissions in the current slice.</div>
                ) : (
                  mostResubmissions.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-border/60 px-3 py-2">
                      <div className="text-sm font-medium text-foreground">{userNameById.get(entry.submitted_by || '') || entry.submitted_by || entry.id}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(entry.submitted_at)} · {entry.invoice_type || 'Unknown invoice'}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
