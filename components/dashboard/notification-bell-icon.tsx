'use client';

import Link from 'next/link';
import { Bell, Check, ExternalLink, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatNotificationType,
  formatRelativeTime,
  getNotificationCategory,
  getNotificationCategoryLabel,
  type NotificationCategory,
  type NotificationRow,
} from '../../lib/client/notification-utils';

type Props = {
  onUnreadCountChange?: (count: number) => void;
};

const CATEGORY_ORDER: NotificationCategory[] = ['needs_action', 'master_data', 'updates'];

function NotificationTypeChip({ type }: { type: string }) {
  const category = getNotificationCategory(type);
  const tone =
    category === 'needs_action'
      ? 'border-orange-200/70 bg-orange-50 text-orange-700 dark:border-orange-400/20 dark:bg-orange-400/10 dark:text-orange-200'
      : category === 'master_data'
        ? 'border-cyan-200/70 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200'
        : 'border-slate-200/80 bg-slate-50 text-slate-600 dark:border-slate-400/20 dark:bg-slate-400/10 dark:text-slate-200';

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}>
      {formatNotificationType(type)}
    </span>
  );
}

export function NotificationBellIcon({ onUnreadCountChange }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [showAllUpdates, setShowAllUpdates] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: notifications.filter((item) => getNotificationCategory(item.type) === category),
      })),
    [notifications]
  );

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications/my?limit=50', {
        method: 'GET',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success && Array.isArray(json.notifications)) {
        const next = json.notifications as NotificationRow[];
        setNotifications(next);
        onUnreadCountChange?.(Number(json.unread_count ?? next.filter((item) => !item.is_read).length));
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

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [onUnreadCountChange, unreadCount]);

  async function markRead(id: string) {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
  }

  async function markAllRead() {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all: true }),
    });

    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted/50"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={16} className="text-foreground" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed right-4 top-14 z-50 flex max-h-[440px] w-[360px] flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">Notifications</h3>
              <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close notifications"
            >
              <X size={16} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              grouped.map(({ category, items }) => {
                if (items.length === 0) return null;

                const visibleItems = category === 'updates' && !showAllUpdates ? items.slice(0, 2) : items;

                return (
                  <section key={category}>
                    <div className="border-b border-border/60 bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {getNotificationCategoryLabel(category)} ({items.length})
                    </div>

                    <div className="divide-y divide-border/60">
                      {visibleItems.map((item) => (
                        <article
                          key={item.id}
                          className={`grid gap-1 px-4 py-3 transition-colors hover:bg-muted/40 ${item.is_read ? 'bg-popover' : 'bg-primary/5'}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                                <NotificationTypeChip type={item.type} />
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              {!item.is_read ? (
                                <button
                                  type="button"
                                  onClick={() => void markRead(item.id)}
                                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  title="Mark as read"
                                >
                                  <Check size={14} />
                                </button>
                              ) : null}
                              <Link
                                href={item.target_path}
                                onClick={() => {
                                  if (!item.is_read) void markRead(item.id);
                                  setOpen(false);
                                }}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted/40"
                              >
                                Open <ExternalLink size={12} />
                              </Link>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                            <span>{formatRelativeTime(item.created_at)}</span>
                            <span className="truncate">{item.target_path}</span>
                          </div>
                        </article>
                      ))}
                    </div>

                    {category === 'updates' && items.length > 2 && !showAllUpdates ? (
                      <button
                        type="button"
                        onClick={() => setShowAllUpdates(true)}
                        className="w-full border-b border-border px-4 py-2 text-left text-xs font-medium text-primary transition-colors hover:bg-muted/40"
                      >
                        Show {items.length - 2} more updates
                      </button>
                    ) : null}
                  </section>
                );
              })
            )}
          </div>

          <div className="flex gap-2 border-t border-border p-3">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-muted"
            >
              View All <ExternalLink size={13} />
            </Link>

            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark All Read
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
