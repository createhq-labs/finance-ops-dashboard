'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import {
  formatNotificationType,
  formatRelativeTime,
  getNotificationCategory,
  getNotificationCategoryLabel,
  type NotificationCategory,
  type NotificationRow,
} from '../../../../lib/client/notification-utils';

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

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading } = useDashboardSession();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!user) return;

    setPageLoading(true);
    setError('');

    fetch('/api/notifications/my?limit=100', { method: 'GET', cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to load notifications.');
        }
        if (active) setNotifications((json.notifications ?? []) as NotificationRow[]);
      })
      .catch((nextError) => {
        if (active) setError(nextError instanceof Error ? nextError.message : 'Failed to load notifications.');
      })
      .finally(() => {
        if (active) setPageLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);
  const visibleNotifications = useMemo(
    () => (unreadOnly ? notifications.filter((item) => !item.is_read) : notifications),
    [notifications, unreadOnly]
  );

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: visibleNotifications.filter((item) => getNotificationCategory(item.type) === category),
      })),
    [visibleNotifications]
  );

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

  async function openNotification(item: NotificationRow) {
    if (!item.is_read) {
      await markRead(item.id);
    }
    router.push(item.target_path);
  }

  if (loading || !user) return null;

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review action items, master data updates, and recent workflow activity.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setUnreadOnly(false)}
            className={[
              'inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              unreadOnly ? 'border-border bg-card text-foreground hover:bg-muted/40' : 'border-primary bg-primary text-primary-foreground',
            ].join(' ')}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setUnreadOnly(true)}
            className={[
              'inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              unreadOnly ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted/40',
            ].join(' ')}
          >
            Unread ({unreadCount})
          </button>
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={unreadCount === 0}
            className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark all read
          </button>
        </div>
      </header>

      {pageLoading ? (
        <div className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          Loading notifications...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!pageLoading && !error && visibleNotifications.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          No notifications to show.
        </div>
      ) : null}

      {!pageLoading && !error ? (
        <div className="grid gap-4">
          {grouped.map(({ category, items }) => {
            if (items.length === 0) return null;

            return (
              <section key={category} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{getNotificationCategoryLabel(category)}</h2>
                    <p className="text-xs text-muted-foreground">{items.length} item{items.length > 1 ? 's' : ''}</p>
                  </div>
                </div>

                <div className="divide-y divide-border/60">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className={`grid w-full gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/30 ${item.is_read ? 'bg-card' : 'bg-primary/5'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                            <NotificationTypeChip type={item.type} />
                            {!item.is_read ? (
                              <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                Unread
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
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
                          <button
                            type="button"
                            onClick={() => void openNotification(item)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted/40"
                          >
                            Open <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>{formatRelativeTime(item.created_at)}</span>
                        <span className="truncate">{item.target_path}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
