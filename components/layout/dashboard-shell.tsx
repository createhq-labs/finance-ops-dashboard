"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Bell, BookOpen, FilePlus, Home, ListChecks } from 'lucide-react';
import { canAccessDashboardPath, canViewNotifications, getDefaultDashboardPath, getInvoiceIntakePath, getSubmissionsLabel } from '../../lib/client/dashboard-access';
import { ThemeToggle } from './theme-toggle';
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

  useEffect(() => {
    if (loading || !user) return;
    if (!canAccessDashboardPath(user.role, pathname)) {
      router.replace(getDefaultDashboardPath(user.role));
    }
  }, [loading, pathname, router, user]);

  useEffect(() => {
    let active = true;
    if (!user || !canViewNotifications(user.role)) return;

    fetch('/api/notifications/my?limit=20', { method: 'GET', cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) return;
        if (active) setUnreadCount(Number(json.unread_count ?? 0));
      })
      .catch(() => {})
      .finally(() => {
        if (!active) return;
      });

    return () => {
      active = false;
    };
  }, [user]);

  const items = useMemo(() => {
    const role = user?.role;
    const base = [
      { href: '/dashboard', label: 'Overview', icon: Home },
      { href: getInvoiceIntakePath(), label: 'Submit Invoice', icon: FilePlus },
      { href: '/dashboard/submissions', label: getSubmissionsLabel(role), icon: ListChecks },
      { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
      { href: '/dashboard/guide', label: 'Guide', icon: BookOpen },
      { href: '/dashboard/finance', label: 'Finance Review' },
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
    <div className="min-h-screen bg-app" style={{ display: 'grid', gridTemplateColumns: '260px 1fr' }}>
      <aside className="surface" style={{ borderRadius: 0, borderLeft: 0, borderTop: 0, borderBottom: 0, padding: 16 }}>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Finance Ops</h2>
          <p className="text-muted" style={{ marginTop: 4, fontSize: 13 }}>Intake and approval workflow</p>
        </div>

        <nav style={{ display: 'grid', gap: 8 }}>
          {items.map((item) => {
            const active = pathname === item.href || (item.href === getInvoiceIntakePath() && pathname === '/dashboard/submit');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textDecoration: 'none',
                  background: active ? 'linear-gradient(135deg, var(--primary), var(--accent))' : 'var(--card)',
                  color: active ? '#fff' : 'var(--fg)',
                  border: active ? 'none' : '1px solid var(--border)',
                }}
              >
                {Icon ? <Icon size={16} /> : null}
                {item.label}
                {'badge' in item && item.badge ? (
                  <span
                    style={{
                      marginLeft: 'auto',
                      minWidth: 20,
                      height: 20,
                      borderRadius: 999,
                      display: 'inline-grid',
                      placeItems: 'center',
                      padding: '0 6px',
                      background: active ? 'rgba(255,255,255,0.2)' : 'var(--primary)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: 24, display: 'grid', gap: 10 }}>
          <ThemeToggle />
          <form action="/api/auth/logout" method="post">
            <button className="btn" type="submit" style={{ width: '100%' }}>Logout</button>
          </form>
          <div className="text-muted" style={{ fontSize: 12 }}>
            <div><strong>User:</strong> {user?.full_name || 'Unknown'}</div>
            <div><strong>Role:</strong> {user?.role || 'Unknown'}</div>
          </div>
        </div>
      </aside>

      <main style={{ padding: 20 }}>{children}</main>
    </div>
  );
}
