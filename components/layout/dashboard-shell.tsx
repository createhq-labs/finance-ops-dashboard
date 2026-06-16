"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Bell, BookOpen, BriefcaseBusiness, Database, FilePlus, Home, ListChecks, LogOut, Settings, Users } from 'lucide-react';
import {
  canAccessDashboardPath,
  canViewNotifications,
  canViewTeamSubmissions,
  getDefaultDashboardPath,
  getInvoiceIntakePath,
  getSubmissionsLabel,
} from '../../lib/client/dashboard-access';
import { DashboardNavbar } from './dashboard-navbar';
import { DashboardSessionProvider, useDashboardSession } from './dashboard-session';

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
      { href: '/dashboard',                 label: 'Overview',             icon: Home,              group: 'workspace' },
      { href: getInvoiceIntakePath(),        label: 'Submit Invoice',       icon: FilePlus,          group: 'workspace' },
      { href: '/dashboard/submissions',      label: getSubmissionsLabel(role), icon: ListChecks,     group: 'workspace' },
      { href: '/dashboard/team-submissions', label: 'Team Submissions',     icon: ListChecks,        group: 'workspace' },
      { href: '/dashboard/notifications',    label: 'Notifications',        icon: Bell,              group: 'workspace', badge: unreadCount > 0 ? unreadCount : undefined },
      { href: '/dashboard/guide',            label: 'Guide',                icon: BookOpen,          group: 'workspace' },
      { href: '/dashboard/finance',          label: 'Finance Review',       icon: BriefcaseBusiness, group: 'operations' },
      { href: '/dashboard/master-data',      label: 'Master Data',          icon: Database,          group: 'operations' },
      { href: '/dashboard/users',            label: 'Users',                icon: Users,             group: 'admin' },
      { href: '/dashboard/system',           label: 'System',                                        group: 'admin' },
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
      <div className="min-h-screen bg-app" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="surface" style={{ padding: 20, minWidth: 320 }}>
          <h2 style={{ margin: 0 }}>Loading dashboard</h2>
          <p className="text-muted" style={{ marginBottom: 0 }}>Checking your session and role access.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-app"
      style={{
        display: 'grid',
        gridTemplateColumns: collapsed ? '72px 1fr' : '260px 1fr',
        transition: 'grid-template-columns 0.25s ease',
      }}
    >
      <aside
        className={`sidebar ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}
        style={{ display: 'flex', flexDirection: 'column', padding: '16px 10px', height: '100vh', position: 'sticky', top: 0 }}
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
      >
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">C</div>
          <div className="sidebar-copy" style={{ opacity: collapsed ? 0 : 1 }}>
            <span className="sidebar-logo-text">Finance Ops</span>
            <span className="sidebar-logo-subtext">Intake and approval workflow</span>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, alignContent: 'start' }}>
          {grouped.map((group, gi) => (
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

      <main className="min-w-0">
        {user ? (
          <DashboardNavbar
            user={user}
            showNotifications={canViewNotifications(user.role)}
            onUnreadCountChange={setUnreadCount}
          />
        ) : null}
        <div className="p-5">
          {children}
        </div>
      </main>
    </div>
  );
}