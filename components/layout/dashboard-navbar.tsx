"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
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
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useThemeTransition();
  const logoTone = theme === 'dark' ? 'light' : 'dark';
  const [refreshing, setRefreshing] = useState(false);
  const [showRefreshToast, setShowRefreshToast] = useState(false);
  const [showRefreshHint, setShowRefreshHint] = useState(false);
  const [nudgeRefresh, setNudgeRefresh] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetRefreshTimers = () => {
    if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    setShowRefreshHint(false);
    setNudgeRefresh(false);
    staleTimerRef.current = setTimeout(() => {
      setNudgeRefresh(true);
      setShowRefreshHint(true);
      hintTimerRef.current = setTimeout(() => {
        setShowRefreshHint(false);
        setNudgeRefresh(false);
      }, 3800);
    }, 7 * 60 * 1000);
  };

  useEffect(() => {
    resetRefreshTimers();
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, [pathname]);

  function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    setShowRefreshHint(false);
    setNudgeRefresh(false);
    router.refresh();
    resetRefreshTimers();
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    window.setTimeout(() => {
      setRefreshing(false);
      setShowRefreshToast(true);
      toastTimerRef.current = setTimeout(() => setShowRefreshToast(false), 1800);
    }, 700);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-16 items-center justify-between px-5 sm:px-6">
        <CompanyLogo tone={logoTone} showText size="md" />

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-sky-100 hover:text-sky-700 disabled:cursor-wait disabled:opacity-70 dark:hover:bg-sky-500/15 dark:hover:text-sky-200"
              aria-label="Refresh dashboard"
              title="Refresh dashboard"
            >
              <RefreshCw size={17} className={[refreshing ? 'animate-spin' : '', nudgeRefresh ? 'animate-pulse text-sky-600 dark:text-sky-300' : ''].join(' ').trim()} />
            </button>
            {showRefreshHint ? (
              <div className="absolute right-0 top-full z-50 mt-3 whitespace-nowrap rounded-lg border border-border/77 bg-card px-4 py-1.8 text-xs text-foreground shadow-lg">
                Refresh to check latest updates
              </div>
            ) : null}
            {showRefreshToast ? (
              <div className="absolute right-0 top-full z-50 mt-2 whitespace-nowrap rounded-lg border border-emerald-200/70 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-lg dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200">
                Dashboard refreshed
              </div>
            ) : null}
          </div>

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
