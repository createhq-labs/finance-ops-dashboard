"use client";

import { SessionUser } from '../../lib/client/session';
import { NotificationBellIcon } from '../dashboard/notification-bell-icon';
import { CompanyLogo } from './company-logo';
import { ThemeToggle } from './theme-toggle';
import { useThemeTransition } from './theme-transition-provider';

function formatRole(role: SessionUser['role']) {
  if (role === 'team_lead') return 'Team Lead';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function getInitials(user: SessionUser) {
  const source = user.full_name?.trim() || user.email.trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return source.slice(0, 1).toUpperCase() || 'U';
}

export function DashboardNavbar({
  user,
  showNotifications,
  onUnreadCountChange,
}: {
  user: SessionUser;
  showNotifications: boolean;
  onUnreadCountChange?: (count: number) => void;
}) {
  const { theme } = useThemeTransition();
  const logoTone = theme === 'dark' ? 'light' : 'dark';

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-16 items-center justify-between px-5 sm:px-6">
        <CompanyLogo tone={logoTone} showText size="md" />

        <div className="flex items-center gap-3 sm:gap-4">
          {showNotifications ? (
            <NotificationBellIcon onUnreadCountChange={onUnreadCountChange} variant="navbar" />
          ) : null}

          <ThemeToggle compact />

          <div className="flex items-center gap-3 sm:gap-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary-strong),var(--accent))] text-xs font-semibold text-primary-foreground">
              {getInitials(user)}
            </div>

            <div className="hidden min-w-0 sm:block">
              <p className="max-w-[11rem] truncate text-sm font-semibold leading-5 text-foreground">
                {user.full_name || user.email}
              </p>
              <p className="truncate text-xs font-semibold leading-4 text-muted-foreground">{formatRole(user.role)}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
