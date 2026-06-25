"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { BarChart3, Bell, BookOpen, BriefcaseBusiness, ClipboardList, Database, FilePlus, Home, ListChecks, LogOut, Settings, Users } from 'lucide-react';
import {
  canAccessDashboardPath,
  canManageDeliverables,
  canViewAnalyticsPage,
  canViewNotifications,
  canViewTeamSubmissions,
  getDefaultDashboardPath,
  getInvoiceIntakePath,
  getSubmissionsLabel,
} from '../../lib/client/dashboard-access';
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
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (loading || !user) return;
    if (!canAccessDashboardPath(user.role, pathname)) {
      router.replace(getDefaultDashboardPath(user.role));
    }
  }, [loading, pathname, router, user]);

  const items = useMemo(() => {
    const role = user?.role;
    const base = [
      { href: '/dashboard', label: 'Overview', icon: Home, group: 'workspace' },
      ...(canViewAnalyticsPage(role ?? 'employee') ? [{ href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, group: 'workspace' as const }] : []),
      ...(role && (role === 'employee' || role === 'team_lead')
        ? [{ href: getInvoiceIntakePath(), label: 'Submit Invoice', icon: FilePlus, group: 'workspace' as const }]
        : []),
      ...(role && (role === 'employee' || role === 'team_lead')
        ? [{ href: '/dashboard/submissions', label: getSubmissionsLabel(role), icon: ListChecks, group: 'workspace' as const }]
        : []),
      ...(canViewTeamSubmissions(role ?? 'employee')
        ? [{ href: '/dashboard/team-submissions', label: 'Team Submissions', icon: ListChecks, group: 'workspace' as const }]
        : []),
      { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, group: 'workspace', badge: unreadCount > 0 ? unreadCount : undefined },
      { href: '/dashboard/guide', label: 'Guide', icon: BookOpen, group: 'workspace' },
      { href: '/dashboard/finance', label: 'Finance Review', icon: BriefcaseBusiness, group: 'operations' },
      { href: '/dashboard/master-data', label: 'Master Data', icon: Database, group: 'operations' },
      ...(canManageDeliverables(role ?? 'employee')
        ? [{ href: '/dashboard/deliverables', label: 'Deliverables', icon: ClipboardList, group: 'operations' as const }]
        : []),
      { href: '/dashboard/users', label: 'Users', icon: Users, group: 'admin' },
      ...(role === 'developer' ? [{ href: '/dashboard/system', label: 'System', group: 'admin' as const }] : []),
    ];

    return base.filter((i) => {
      if (!role) return i.href === '/dashboard';
      if (i.href === '/dashboard/team-submissions') return canViewTeamSubmissions(role);
      return canAccessDashboardPath(role, i.href);
    });
  }, [unreadCount, user?.role]);

  const groupOrder = ['workspace', 'operations', 'admin'] as const;
  const groupLabels: Record<string, string> = {
    workspace:  'Workspace',
    operations: 'Operations',
    admin:      'Admin',
  };

  const grouped = groupOrder
    .map((g) => ({ key: g, label: groupLabels[g], items: items.filter((i) => i.group === g) }))
    .filter((g) => g.items.length > 0);

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

              <span
                className="sidebar-group-label"
                style={{ opacity: collapsed ? 0 : 1 }}
              >
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
                      {/* Single nav-icon — no active variant */}
                      <span className="nav-icon">
                        {Icon ? <Icon size={15} style={{ flexShrink: 0 }} /> : <span style={{ width: 15 }} />}
                      </span>

                      <span className="sidebar-nav-label" style={{ opacity: collapsed ? 0 : 1 }}>
                        {item.label}
                      </span>

                      {!collapsed && 'badge' in item && item.badge ? (
                        <span className="nav-badge">{item.badge}</span>
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
        <div className="p-5">
          {children}
        </div>
      </main>
      </div>
    </div>
  );
}
