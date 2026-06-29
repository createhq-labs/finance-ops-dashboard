'use client';

import Link from 'next/link';
import { AlertTriangle, Bell, Check, ExternalLink, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDashboardSession } from '../layout/dashboard-session';
import { isEmployeeRole } from '../../lib/client/dashboard-access';
import {
  getNotificationDisplayType,
  getNotificationTone,
  formatRelativeTime,
  getNotificationCategory,
  getNotificationCategoryLabel,
  sortNotificationsLatestFirst,
  isClosedSubmissionReopenedNotification,
  type NotificationCategory,
  type NotificationRow,
} from '../../lib/client/notification-utils';

type Props = {
  onUnreadCountChange?: (count: number) => void;
  variant?: 'default' | 'navbar';
};

const CATEGORY_ORDER: NotificationCategory[] = ['needs_action', 'master_data', 'updates'];

function getToneTextClass(type: NotificationRow['type'], isEmployeeView: boolean) {
  if (isEmployeeView && type === 'resubmission_requested') return 'text-destructive';

  const tone = getNotificationTone(type);

  if (tone === 'danger') return 'text-destructive';
  if (tone === 'warning') return 'text-violet-700 dark:text-violet-300';
  if (tone === 'action') return 'text-orange-700 dark:text-orange-300';
  if (tone === 'info') return 'text-sky-700 dark:text-sky-300';
  if (tone === 'success') return 'text-emerald-700 dark:text-emerald-300';
  return 'text-foreground';
}

function getCategoryHeaderClass(category: NotificationCategory) {
  if (category === 'needs_action') {
    return {
      section: 'bg-muted/10',
      badge: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    };
  }

  if (category === 'master_data') {
    return {
      section: 'bg-muted/10',
      badge: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    };
  }

  return {
    section: 'bg-muted/10',
    badge: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  };
}

export function NotificationBellIcon({ onUnreadCountChange, variant = 'default' }: Props) {
  const { user } = useDashboardSession();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [apiUnreadCount, setApiUnreadCount] = useState(0);
  const [showAllUpdates, setShowAllUpdates] = useState(false);
  const [showReopenedOnly, setShowReopenedOnly] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const isEmployeeView = !!user && isEmployeeRole(user.role);

  const unreadCount = apiUnreadCount;

  const visibleNotifications = useMemo(
    () => showReopenedOnly ? notifications.filter((item) => isClosedSubmissionReopenedNotification(item)) : notifications,
    [notifications, showReopenedOnly]
  );

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: visibleNotifications.filter((item) => getNotificationCategory(item.type) === category),
      })),
    [visibleNotifications]
  );

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications/my?limit=100', {
        method: 'GET',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success && Array.isArray(json.notifications)) {
        const next = sortNotificationsLatestFirst(json.notifications as NotificationRow[]);
        setNotifications(next);
        const nextUnreadCount = Number(json.unread_count ?? 0);
        setApiUnreadCount(nextUnreadCount);
        onUnreadCountChange?.(nextUnreadCount);
      }
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;

    function handleMouseDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  async function markRead(id: string) {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    setNotifications((prev) => {
      const current = prev.find((item) => item.id === id);
      const next = prev.map((item) => (item.id === id ? { ...item, is_read: true } : item));

      if (current && !current.is_read) {
        setApiUnreadCount((count) => {
          const nextCount = Math.max(0, count - 1);
          onUnreadCountChange?.(nextCount);
          return nextCount;
        });
      }

      return next;
    });
  }


  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={[
          'relative inline-flex h-9 w-9 items-center justify-center transition-colors duration-150',
          variant === 'navbar'
            ? 'rounded-md text-muted-foreground hover:bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(37,99,235,0.14))] hover:text-sky-700 dark:hover:text-sky-200'
            : 'rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted/30',
        ].join(' ')}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={16} className="text-foreground" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
          <div className="surface fixed right-4 top-14 z-50 flex max-h-[420px] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b border-border/70 bg-popover px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">{showReopenedOnly ? 'Reopened Alerts' : 'Notifications'}</h3>
              <p className="text-xs text-muted-foreground">{showReopenedOnly ? 'Closed submissions reopened by finance' : `${unreadCount} unread`}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowReopenedOnly((current) => !current)}
                className={[
                  'rounded-md p-1 transition-colors',
                  showReopenedOnly
                    ? 'bg-rose-500/12 text-rose-700 hover:bg-rose-500/18 dark:bg-rose-400/12 dark:text-rose-200 dark:hover:bg-rose-400/18'
                    : 'text-muted-foreground hover:bg-muted/20 hover:text-foreground',
                ].join(' ')}
                aria-label={showReopenedOnly ? 'Show all notifications' : 'Show reopened submission alerts'}
                title={showReopenedOnly ? 'Show all notifications' : 'Show reopened submission alerts'}
              >
                <AlertTriangle size={16} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
                aria-label="Close notifications"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && visibleNotifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading notifications...</div>
            ) : visibleNotifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">{showReopenedOnly ? 'No reopened submission alerts' : 'No notifications'}</div>
            ) : (
              grouped.map(({ category, items }) => {
                if (items.length === 0) return null;

                const visibleItems = category === 'updates' && !showAllUpdates ? items.slice(0, 2) : items;
                const categoryClasses = getCategoryHeaderClass(category);

                return (
                  <section key={category}>
                    <div className={`flex items-center justify-between border-b border-border/60 px-4 py-1.5 ${categoryClasses.section}`}>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {getNotificationCategoryLabel(category)}
                      </span>
                      <span className={`inline-flex min-w-5 items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${categoryClasses.badge}`}>
                        {items.length}
                      </span>
                    </div>

                    <div className="divide-y divide-border/60">
                      {visibleItems.map((item) => {
                        const isReopenedAlert = isClosedSubmissionReopenedNotification(item);
                        return (
                          <article
                            key={item.id}
                            className={[
                              'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2 transition-colors hover:bg-muted/15',
                              isReopenedAlert
                                ? item.is_read
                                  ? 'bg-rose-50/55 dark:bg-rose-500/10'
                                  : 'border-l-2 border-l-rose-500/75 bg-[linear-gradient(90deg,rgba(244,63,94,0.12),transparent)] dark:bg-[linear-gradient(90deg,rgba(244,63,94,0.16),transparent)]'
                                : item.is_read
                                  ? 'bg-popover'
                                  : 'border-l-2 border-l-[rgba(34,211,238,0.65)] bg-[linear-gradient(90deg,rgba(34,211,238,0.10),transparent)]',
                            ].join(' ')}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                {!item.is_read ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" /> : null}
                                <p
                                  className={`truncate text-sm ${item.is_read ? 'font-medium' : 'font-semibold'} ${isReopenedAlert ? 'text-rose-700 dark:text-rose-200' : getToneTextClass(item.type, isEmployeeView)}`}
                                >
                                  {item.title}
                                </p>
                              </div>
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.message}</p>
                              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                                <span className={isReopenedAlert ? 'text-rose-700 dark:text-rose-200' : getToneTextClass(item.type, isEmployeeView)}>{getNotificationDisplayType(item.type, user?.role)}</span>
                                <span>&middot;</span>
                                <span>{formatRelativeTime(item.created_at)}</span>
                              </div>
                            </div>

                            <div className="row-span-2 flex items-center gap-1">
                              {!item.is_read ? (
                                <button
                                  type="button"
                                  onClick={() => void markRead(item.id)}
                                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
                                  title="Mark as read"
                                >
                                  <Check size={13} />
                                </button>
                              ) : null}
                              <Link
                                href={item.target_path}
                                onClick={() => {
                                  setOpen(false);
                                }}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted/20"
                              >
                                Open <ExternalLink size={12} />
                              </Link>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {category === 'updates' && items.length > 2 && !showAllUpdates ? (
                      <button
                        type="button"
                        onClick={() => setShowAllUpdates(true)}
                        className="w-full border-b border-border px-4 py-2 text-left text-xs font-medium text-primary transition-colors hover:bg-muted/20"
                      >
                        Show {items.length - 2} more updates
                      </button>
                    ) : null}
                  </section>
                );
              })
            )}
          </div>

          <div className="border-t border-border p-3">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-muted/20"
            >
              View All <ExternalLink size={13} />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
