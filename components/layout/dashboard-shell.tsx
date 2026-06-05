"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Bell, BookOpen, BriefcaseBusiness, FilePlus, Home, ListChecks, Settings } from 'lucide-react';
import { NotificationBellIcon } from '../dashboard/notification-bell-icon';
import { canAccessDashboardPath, canViewNotifications, getDefaultDashboardPath, getInvoiceIntakePath, getSubmissionsLabel } from '../../lib/client/dashboard-access';
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
      { href: '/dashboard', label: 'Overview', icon: Home },
      { href: getInvoiceIntakePath(), label: 'Submit Invoice', icon: FilePlus },
      { href: '/dashboard/submissions', label: getSubmissionsLabel(role), icon: ListChecks },
      { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
      { href: '/dashboard/guide', label: 'Guide', icon: BookOpen },
      { href: '/dashboard/finance', label: 'Finance Review', icon: BriefcaseBusiness },
      { href: '/dashboard/users', label: 'Users' },
      { href: '/dashboard/system', label: 'System' },
    ];

    return base.filter((i) => {
      if (!role) return i.href === '/dashboard';
      return canAccessDashboardPath(role, i.href);
    });
  }, [unreadCount, user?.role]);

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
    <div className="min-h-screen bg-app" style={{ display: 'grid', gridTemplateColumns: collapsed ? '72px 1fr' : '260px 1fr', transition: 'grid-template-columns 0.25s ease' }}>
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

        <nav style={{ display: 'grid', gap: 8, flex: 1, alignContent: 'start', gridAutoRows: 'max-content' }}>
          {items.map((item) => {
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
                {Icon ? <Icon size={16} style={{ flexShrink: 0 }} /> : <span style={{ width: 16 }} />}
                <span className="sidebar-nav-label" style={{ opacity: collapsed ? 0 : 1 }}>
                  {item.label}
                </span>
                {!collapsed && 'badge' in item && item.badge ? (
                  <span className="nav-badge">{item.badge}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-profile-btn" style={{ cursor: 'default' }}>
            <div className="user-avatar">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="sidebar-copy" style={{ opacity: collapsed ? 0 : 1 }}>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.full_name || 'User'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{user?.role}</div>
              </div>
            </div>
          </div>

          <Link
            href="/dashboard/settings"
            className="nav-item"
            title={collapsed ? 'Settings' : undefined}
            style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            <Settings size={16} style={{ flexShrink: 0 }} />
            <span className="sidebar-nav-label" style={{ opacity: collapsed ? 0 : 1 }}>
              Settings
            </span>
          </Link>
        </div>
      </aside>

      <main className="relative p-5">
        {user && canViewNotifications(user.role) ? (
          <div className="fixed right-4 top-4 z-40">
            <NotificationBellIcon onUnreadCountChange={setUnreadCount} />
          </div>
        ) : null}

        {children}
      </main>
    </div>
  );
}
