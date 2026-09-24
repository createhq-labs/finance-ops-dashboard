"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { BarChart3, Bell, BookOpen, BriefcaseBusiness, ClipboardList, Database, FilePlus, Home, ListChecks, LogOut, Settings, Users } from 'lucide-react';
import {
  canAccessDashboardPath,
  canManageDeliverables,
  canViewAnalyticsPage,
  canViewFinanceDashboard,
  canViewFollowUps,
  canViewNotifications,
  canViewTeamSubmissions,
  canViewTransferredSubmissions,
  getDefaultDashboardPath,
  getInvoiceIntakePath,
  getSubmissionsLabel,
} from '../../lib/client/dashboard-access';
import { FINANCE_NEW_RESUBMISSION_BADGE_CLASSES, FINANCE_NEW_SUBMISSION_BADGE_CLASSES } from '../../lib/client/finance-badge-colors';
import { FINANCE_BADGE_REFRESH_EVENT } from '../../lib/client/finance-badge-refresh';
import { PENDING_RESUBMISSION_BADGE_REFRESH_EVENT } from '../../lib/client/resubmission-badge-refresh';
import { DashboardNavbar } from './dashboard-navbar';
import { DashboardSessionProvider, useDashboardSession } from './dashboard-session';
import { WorkspaceLoader } from './workspace-loader';

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <DashboardSessionProvider>
      <DashboardShellFrame>{children}</DashboardShellFrame>
    </DashboardSessionProvider>
  );
}

function DashboardShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useDashboardSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [newSubmissionCount, setNewSubmissionCount] = useState(0);
  const [newResubmissionCount, setNewResubmissionCount] = useState(0);
  const [pendingResubmissionCount, setPendingResubmissionCount] = useState(0);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (loading || !user) return;
    if (!canAccessDashboardPath(user.role, pathname)) {
      router.replace(getDefaultDashboardPath(user.role));
    }
  }, [loading, pathname, router, user]);

  useEffect(() => {
    if (loading || !user || !canViewFollowUps(user.role)) {
      setFollowUpCount(0);
      return;
    }

    let active = true;
    const loadFollowUpCount = async () => {
      try {
        const response = await fetch('/api/follow-ups/count', { method: 'GET', cache: 'no-store' });
        const body = await response.json().catch(() => ({}));
        if (active && response.ok && body?.success) {
          setFollowUpCount(Number(body.count) > 0 ? Number(body.count) : 0);
        }
      } catch {
        if (active) setFollowUpCount(0);
      }
    };

    void loadFollowUpCount();
    const timer = window.setInterval(loadFollowUpCount, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user || !canViewFinanceDashboard(user.role)) {
      setNewSubmissionCount(0);
      setNewResubmissionCount(0);
      return;
    }

    let active = true;
    const loadFinanceBadgeCounts = async () => {
      try {
        const response = await fetch('/api/submissions/finance/badge-counts', { method: 'GET', cache: 'no-store' });
        const body = await response.json().catch(() => ({}));
        if (active && response.ok && body?.success) {
          setNewSubmissionCount(Number(body.newSubmissions) > 0 ? Number(body.newSubmissions) : 0);
          setNewResubmissionCount(Number(body.newResubmissions) > 0 ? Number(body.newResubmissions) : 0);
        } else if (active && !(response.ok && body?.success)) {
          console.warn(`Finance badge refresh failed: ${response.status} ${response.statusText}`.trim());
        }
      } catch {
        if (active) {
          setNewSubmissionCount(0);
          setNewResubmissionCount(0);
        }
      }
    };

    void loadFinanceBadgeCounts();
    const timer = window.setInterval(loadFinanceBadgeCounts, 60000);
    const handleRefreshRequest = () => void loadFinanceBadgeCounts();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void loadFinanceBadgeCounts();
    };
    window.addEventListener(FINANCE_BADGE_REFRESH_EVENT, handleRefreshRequest);
    window.addEventListener('focus', handleRefreshRequest);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(FINANCE_BADGE_REFRESH_EVENT, handleRefreshRequest);
      window.removeEventListener('focus', handleRefreshRequest);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user || !(user.role === 'employee' || user.role === 'team_lead')) {
      setPendingResubmissionCount(0);
      return;
    }

    let active = true;
    const loadPendingResubmissionCount = async () => {
      try {
        const response = await fetch('/api/submissions/pending-resubmission-count', { method: 'GET', cache: 'no-store' });
        const body = await response.json().catch(() => ({}));
        if (active && response.ok && body?.success) {
          setPendingResubmissionCount(Number(body.count) > 0 ? Number(body.count) : 0);
        }
      } catch {
        if (active) setPendingResubmissionCount(0);
      }
    };

    void loadPendingResubmissionCount();
    const timer = window.setInterval(loadPendingResubmissionCount, 60000);
    const handleRefreshRequest = () => void loadPendingResubmissionCount();
    window.addEventListener(PENDING_RESUBMISSION_BADGE_REFRESH_EVENT, handleRefreshRequest);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(PENDING_RESUBMISSION_BADGE_REFRESH_EVENT, handleRefreshRequest);
    };
  }, [loading, user]);

  const items = useMemo(() => {
    const role = user?.role;
    const base = [
      { href: '/dashboard', label: 'Overview', icon: Home, group: 'workspace' },
      ...(canViewAnalyticsPage(role ?? 'employee') ? [{ href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, group: 'workspace' as const }] : []),
      ...(role && (role === 'employee' || role === 'team_lead')
        ? [{ href: getInvoiceIntakePath(), label: 'Submit Invoice', icon: FilePlus, group: 'operations' as const }]
        : []),
      ...(role && (role === 'employee' || role === 'team_lead')
        ? [{
            href: '/dashboard/submissions',
            label: getSubmissionsLabel(role),
            icon: ListChecks,
            group: 'operations' as const,
            badge: pendingResubmissionCount > 0 ? pendingResubmissionCount : undefined,
          }]
        : []),
      ...(canViewTeamSubmissions(role ?? 'employee')
        ? [{ href: '/dashboard/team-submissions', label: 'Team Submissions', icon: ListChecks, group: 'operations' as const }]
        : []),
      ...(canViewFollowUps(role ?? 'employee')
        ? [{ href: '/dashboard/follow-ups', label: 'Follow-ups', icon: ClipboardList, group: 'operations' as const, badge: followUpCount > 0 ? followUpCount : undefined }]
        : []),
      ...(canViewTransferredSubmissions(role ?? 'employee')
        ? [{ href: '/dashboard/transferred-submissions', label: 'Transferred Submissions', icon: ListChecks, group: 'operations' as const }]
        : []),
      { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, group: 'workspace', badge: unreadCount > 0 ? unreadCount : undefined },
      { href: '/dashboard/guide', label: 'Guide', icon: BookOpen, group: 'workspace' },
      {
        href: '/dashboard/finance',
        label: 'Finance Review',
        icon: BriefcaseBusiness,
        group: 'operations' as const,
        financeBadges: canViewFinanceDashboard(role ?? 'employee')
          ? { newSubmissions: newSubmissionCount, newResubmissions: newResubmissionCount }
          : undefined,
      },
      { href: '/dashboard/master-data', label: 'Master Data', icon: Database, group: 'operations' },
      ...(canManageDeliverables(role ?? 'employee')
        ? [{ href: '/dashboard/deliverables', label: 'Deliverables', icon: ClipboardList, group: 'operations' as const }]
        : []),
      { href: '/dashboard/users', label: 'Users', icon: Users, group: 'admin' },
      ...(role === 'developer' ? [{ href: '/dashboard/system', label: 'System', group: 'admin' as const }] : []),
    ];

    return base.filter((item) => {
      if (!role) return item.href === '/dashboard';
      if (item.href === '/dashboard/team-submissions') return canViewTeamSubmissions(role);
      if (item.href === '/dashboard/follow-ups') return canViewFollowUps(role);
      if (item.href === '/dashboard/transferred-submissions') return canViewTransferredSubmissions(role);
      return canAccessDashboardPath(role, item.href);
    });
  }, [followUpCount, newResubmissionCount, newSubmissionCount, pendingResubmissionCount, unreadCount, user?.role]);

  const groupOrder = ['workspace', 'operations', 'admin'] as const;
  const groupLabels: Record<string, string> = {
    workspace: 'Workspace',
    operations: 'Operations',
    admin: 'Admin',
  };

  const grouped = groupOrder
    .map((group) => ({ key: group, label: groupLabels[group], items: items.filter((item) => item.group === group) }))
    .filter((group) => group.items.length > 0);

  if (loading) {
    return (
      <WorkspaceLoader
        variant="fullscreen"
        label="Preparing your workspace"
        description="Checking session and loading dashboard access..."
      />
    );
  }

  return (
    <div
      className="min-h-screen bg-app"
      style={{
        display: 'grid',
        gridTemplateRows: '64px minmax(0, 1fr)',
        overflow: 'hidden',
      }}
    >
      <div style={{ gridColumn: '1 / -1', gridRow: '1' }}>
        {user ? (
          <DashboardNavbar
            user={user}
            showNotifications={canViewNotifications(user.role)}
            onUnreadCountChange={setUnreadCount}
          />
        ) : null}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: collapsed ? '72px 1fr' : '260px 1fr',
          minHeight: 0,
          overflow: 'hidden',
          transition: 'grid-template-columns 0.25s ease',
        }}
      >
        <aside
          className={`sidebar ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 10px',
            height: 'calc(100vh - 64px)',
            position: 'sticky',
            top: 64,
            overflowY: 'auto',
            minHeight: 0,
          }}
          onMouseEnter={() => setCollapsed(false)}
          onMouseLeave={() => setCollapsed(true)}
        >
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, alignContent: 'start' }}>
            {grouped.map((group) => (
              <div key={group.key} className="sidebar-group">
                <span className="sidebar-group-label" style={{ opacity: collapsed ? 0 : 1 }}>
                  {group.label}
                </span>

                <div style={{ display: 'grid', gap: 1, gridAutoRows: 'max-content' }}>
                  {group.items.map((item) => {
                    const active = pathname === item.href || (item.href === getInvoiceIntakePath() && pathname === '/dashboard/submit');
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-item ${active ? 'nav-item-active' : ''}`}
                        title={collapsed ? item.label : undefined}
                        style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
                      >
                        <span className="nav-icon">
                          {Icon ? <Icon size={15} style={{ flexShrink: 0 }} /> : <span style={{ width: 15 }} />}
                        </span>

                        <span className="sidebar-nav-label" style={{ opacity: collapsed ? 0 : 1 }}>
                          {item.label}
                        </span>

                        {!collapsed && 'badge' in item && item.badge ? (
                          <span className="nav-badge">{item.badge}</span>
                        ) : null}

                        {!collapsed && 'financeBadges' in item && item.financeBadges &&
                        (item.financeBadges.newSubmissions > 0 || item.financeBadges.newResubmissions > 0) ? (
                          <span className="inline-flex items-center" style={{ marginLeft: 'auto' }}>
                            {item.financeBadges.newSubmissions > 0 ? (
                              <span
                                className={FINANCE_NEW_SUBMISSION_BADGE_CLASSES}
                                title={`${item.financeBadges.newSubmissions} new submission${item.financeBadges.newSubmissions === 1 ? '' : 's'} waiting for Finance action`}
                              >
                                {item.financeBadges.newSubmissions}
                              </span>
                            ) : null}
                            {item.financeBadges.newResubmissions > 0 ? (
                              <span
                                className={FINANCE_NEW_RESUBMISSION_BADGE_CLASSES}
                                style={item.financeBadges.newSubmissions > 0 ? { marginLeft: -7 } : undefined}
                                title={`${item.financeBadges.newResubmissions} new resubmission${item.financeBadges.newResubmissions === 1 ? '' : 's'} waiting for Finance action`}
                              >
                                {item.financeBadges.newResubmissions}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="sidebar-bottom">
            <Link
              href="/dashboard/settings"
              className="nav-item nav-item-bottom"
              title={collapsed ? 'Settings' : undefined}
              style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
            >
              <span className="nav-icon">
                <Settings size={14} style={{ flexShrink: 0 }} />
              </span>
              <span className="sidebar-nav-label" style={{ opacity: collapsed ? 0 : 1 }}>
                Settings
              </span>
            </Link>

            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="nav-item nav-item-bottom nav-item-logout w-full"
                title={collapsed ? 'Logout' : undefined}
                style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
              >
                <span className="nav-icon">
                  <LogOut size={14} style={{ flexShrink: 0 }} />
                </span>
                <span className="sidebar-nav-label" style={{ opacity: collapsed ? 0 : 1 }}>
                  Logout
                </span>
              </button>
            </form>
          </div>
        </aside>

        <main
          className="min-w-0"
          style={{
            height: 'calc(100vh - 64px)',
            overflowY: 'auto',
            minHeight: 0,
          }}
        >
          <div className="p-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
