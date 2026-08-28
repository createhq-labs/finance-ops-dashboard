'use client';

import { Check, CheckCircle2, ChevronRight, Inbox } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WorkspaceLoader } from '../../../../components/layout/workspace-loader';
import { useDashboardRefresh } from '../../../../lib/client/use-dashboard-refresh';
import { handleAuthTokenRecoveryMessage } from '../../../../lib/client/auth-recovery';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';
import { isEmployeeRole } from '../../../../lib/client/dashboard-access';
import {
  getNotificationDisplayType,
  formatRelativeTime,
  getCompletedNotificationTitle,
  getNotificationCategory,
  getNotificationCategoryLabel,
  getNotificationTone,
  isClosedSubmissionReopenedNotification,
  isNotificationCompleted,
  sortNotificationsLatestFirst,
  type NotificationCategory,
  type NotificationRow,
} from '../../../../lib/client/notification-utils';

type CategoryFilter = 'all' | 'reopened' | NotificationCategory;
type ReadFilter = 'all' | 'unread' | 'read';
type TimeFilter = 'all' | 'today' | 'week' | 'older';
type TypeFilter = 'all' | NotificationRow['type'];

type NotificationsResponse = {
  success?: boolean;
  notifications?: NotificationRow[];
  has_more?: boolean;
  next_offset?: number | null;
  error?: string;
};

const PAGE_SIZE = 50;

function categoryLabel(value: CategoryFilter) {
  if (value === 'all') return 'All';
  if (value === 'reopened') return 'Reopened';
  return getNotificationCategoryLabel(value);
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isThisWeek(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const diff = Date.now() - date.getTime();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

function mergeNotifications(current: NotificationRow[], incoming: NotificationRow[]) {
  const merged = new Map<string, NotificationRow>();
  for (const item of current) merged.set(item.id, item);
  for (const item of incoming) merged.set(item.id, item);
  return sortNotificationsLatestFirst(Array.from(merged.values()));
}

function getTypeBadgeClass(type: NotificationRow['type'], role?: string | null) {
  if (role === 'employee' && type === 'resubmission_requested') {
    return 'border-destructive/35 bg-destructive/10 text-destructive';
  }

  if (type === 'submission_rejected' || type === 'submission_reopened') {
    return 'border-destructive/30 bg-destructive/10 text-destructive';
  }

  if (type === 'finance_action_pending') {
    return 'border-orange-500/60 bg-orange-200/10 text-orange-600 dark:border-orange-500/65 dark:bg-orange-500/10 dark:text-orange-300';
  }

  if (type === 'resubmission_requested' || type === 'resubmitted_form') {
    return 'border-violet-500/60 bg-violet-500/10 text-violet-700 dark:border-violet-500/65 dark:bg-violet-400/10 dark:bg-violet-500/10 dark:text-violet-400';
  }

  if (type === 'new_submission') {
    return 'border-emerald-500/65 bg-emerald-300/10 text-emerald-700 dark:border-emerald-500/65 dark:bg-emerald-500/10 dark:text-emerald-300';
  }

  if (type === 'invoice_updated') {
    return 'border-sky-500/65 bg-sky-500/10 text-sky-700 dark:border-sky-500/65 dark:bg-sky-500/10 dark:text-sky-400';
  }

  const tone = getNotificationTone(type);

  if (tone === 'info') {
    return 'border-sky-500/65 bg-sky-500/10 text-sky-700 dark:border-sky-500/65 dark:bg-sky-500/10 dark:text-sky-400';
  }

  return 'border-border bg-muted/20 text-muted-foreground';
}

function getCategoryBadgeClass(category: NotificationCategory) {
  if (category === 'needs_action') {
    return 'border-amber-500/65 bg-amber-500/20 text-amber-700 dark:border-amber-500/65 dark:bg-amber-500/10 dark:text-amber-300';
  }

  if (category === 'master_data') {
    return 'border-indigo-500/65 bg-indigo-500/10 text-indigo-700 dark:border-indigo-500/65 dark:bg-indigo-500/10 dark:text-indigo-300';
  }

  return 'border-sky-500/65 bg-sky-500/10 text-sky-700 dark:border-sky-500/65 dark:bg-sky-500/10 dark:text-sky-400';
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading } = useDashboardSession();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [pageLoading, setPageLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [error, setError] = useState('');
  const isEmployeeView = !!user && isEmployeeRole(user.role);
  const showReopenedTab = user?.role === 'finance' || user?.role === 'admin' || user?.role === 'developer';

  const loadNotificationsPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!user) return;

      if (append) setLoadingMore(true);
      else {
        setPageLoading(true);
        setError('');
      }

      try {
        const res = await fetch('/api/notifications/my?limit=' + PAGE_SIZE + '&offset=' + offset, {
          method: 'GET',
          cache: 'no-store',
        });
        const json = (await res.json().catch(() => ({}))) as NotificationsResponse;

        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to load notifications.');
        }

        const nextItems = Array.isArray(json.notifications) ? json.notifications : [];
        setNotifications((current) => (append ? mergeNotifications(current, nextItems) : sortNotificationsLatestFirst(nextItems)));
        setHasMore(Boolean(json.has_more));
        setNextOffset(typeof json.next_offset === 'number' ? json.next_offset : null);
      } catch (nextError) {
        const nextMessage = nextError instanceof Error ? nextError.message : 'Failed to load notifications.';
        if (handleAuthTokenRecoveryMessage(nextMessage)) return;
        setError(nextMessage);
      } finally {
        if (append) setLoadingMore(false);
        else setPageLoading(false);
      }
    },
    [user]
  );

  const loadMore = useCallback(() => {
    if (pageLoading || loadingMore || !hasMore || nextOffset === null) return;
    void loadNotificationsPage(nextOffset, true);
  }, [hasMore, loadNotificationsPage, loadingMore, nextOffset, pageLoading]);

  useDashboardRefresh({
    enabled: Boolean(user),
    refresh: async () => {
      setNotifications([]);
      setHasMore(false);
      setNextOffset(null);
      await loadNotificationsPage(0, false);
    },
    intervalMs: 60000,
    refreshOnFocus: true,
  });

  useEffect(() => {
    if (!hasMore || loadingMore) return undefined;
    const target = loadMoreRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '160px 0px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loadingMore]);

  const categoryFilters = useMemo<CategoryFilter[]>(() => {
    const base = isEmployeeView ? (['all', 'needs_action', 'updates'] as CategoryFilter[]) : (['all', 'needs_action', 'master_data', 'updates'] as CategoryFilter[]);
    return showReopenedTab ? ([base[0], 'reopened', ...base.slice(1)] as CategoryFilter[]) : base;
  }, [isEmployeeView, showReopenedTab]);

  const roleScopedNotifications = useMemo(
    () =>
      notifications.filter((item) => {
        if (isEmployeeView && getNotificationCategory(item.type) === 'master_data') return false;
        return true;
      }),
    [isEmployeeView, notifications]
  );

  const counts = useMemo(() => {
    return {
      all: roleScopedNotifications.length,
      needs_action: roleScopedNotifications.filter((item) => getNotificationCategory(item.type) === 'needs_action').length,
      master_data: roleScopedNotifications.filter((item) => getNotificationCategory(item.type) === 'master_data').length,
      updates: roleScopedNotifications.filter((item) => getNotificationCategory(item.type) === 'updates').length,
      reopened: roleScopedNotifications.filter((item) => isClosedSubmissionReopenedNotification(item)).length,
      unread: roleScopedNotifications.filter((item) => !item.is_read).length,
      read: roleScopedNotifications.filter((item) => item.is_read).length,
      today: roleScopedNotifications.filter((item) => isToday(item.created_at)).length,
      week: roleScopedNotifications.filter((item) => isThisWeek(item.created_at)).length,
      older: roleScopedNotifications.filter((item) => !isThisWeek(item.created_at)).length,
    };
  }, [roleScopedNotifications]);

  const categoryScopedNotifications = useMemo(() => {
    return roleScopedNotifications.filter((item) => {
      if (categoryFilter === 'reopened') {
        if (!isClosedSubmissionReopenedNotification(item)) return false;
      } else if (categoryFilter !== 'all' && getNotificationCategory(item.type) !== categoryFilter) {
        return false;
      }
      if (readFilter === 'unread' && item.is_read) return false;
      if (readFilter === 'read' && !item.is_read) return false;
      if (timeFilter === 'today' && !isToday(item.created_at)) return false;
      if (timeFilter === 'week' && !isThisWeek(item.created_at)) return false;
      if (timeFilter === 'older' && isThisWeek(item.created_at)) return false;
      return true;
    });
  }, [categoryFilter, roleScopedNotifications, readFilter, timeFilter]);

  const availableTypes = useMemo(
    () =>
      Array.from(
        new Set(
          categoryScopedNotifications
            .map((item) => item.type)
            .filter((type) => !(isEmployeeView && type === 'submission_rejected'))
        )
      ),
    [categoryScopedNotifications, isEmployeeView]
  );

  useEffect(() => {
    if (typeFilter !== 'all' && !availableTypes.includes(typeFilter)) {
      setTypeFilter('all');
    }
  }, [availableTypes, typeFilter]);

  const visibleNotifications = useMemo(() => {
    if (typeFilter === 'all') return categoryScopedNotifications;
    return categoryScopedNotifications.filter((item) => item.type === typeFilter);
  }, [categoryScopedNotifications, typeFilter]);

  async function markRead(id: string) {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
  }

  function openNotification(item: NotificationRow) {
    router.push(item.target_path);
  }

  function resetFilters() {
    setCategoryFilter('all');
    setReadFilter('all');
    setTimeFilter('all');
    setTypeFilter('all');
  }

  if (loading || !user) return null;

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review action items, master data updates, and recent workflow activity.
          </p>
        </div>
      </header>

      <div className="grid gap-4 overflow-x-hidden lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="surface flex h-fit flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-5 lg:max-h-[calc(100vh-120px)]">
          <div className="shrink-0 rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/8 text-primary">
                <Inbox className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold text-foreground">Inbox</p>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{counts.unread} unread notifications</p>
          </div>

          <div className="my-3 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="grid gap-[14px]">
              <div>
                <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/70">
                  Category
                </p>

                <div className="grid gap-0.5">
                  {categoryFilters.map((filter) => {
                    const active = categoryFilter === filter;
                    const count = filter === 'all' ? counts.all : counts[filter];

                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setCategoryFilter(filter)}
                        className={[
                          'flex h-8 items-center justify-between rounded-[8px] border px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                          active
                            ? 'border-transparent bg-[var(--secondary)] font-semibold text-foreground'
                            : 'border-transparent bg-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                        ].join(' ')}
                      >
                        <span>{categoryLabel(filter)}</span>
                        <span
                          className={[
                            'inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px]',
                            active
                              ? 'border border-[var(--primary-strong)] bg-[var(--primary-strong)] text-white'
                              : 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-200',
                          ].join(' ')}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border/70 pt-3">
                <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/70">
                  Status
                </p>

                <div className="grid gap-0.5">
                  {[
                    { key: 'all', label: 'All', count: counts.all },
                    { key: 'unread', label: 'Unread', count: counts.unread },
                    { key: 'read', label: 'Read', count: counts.read },
                  ].map((item) => {
                    const active = readFilter === item.key;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setReadFilter(item.key as ReadFilter)}
                        className={[
                          'flex h-8 items-center justify-between rounded-[8px] border px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                          active
                            ? 'border-transparent bg-[var(--secondary)] font-semibold text-foreground'
                            : 'border-transparent bg-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                        ].join(' ')}
                      >
                        <span>{item.label}</span>
                        <span
                          className={[
                            'inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px]',
                            active
                              ? 'border border-[var(--primary-strong)] bg-[var(--primary-strong)] text-white'
                              : 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-200',
                          ].join(' ')}
                        >
                          {item.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border/70 pt-3">
                <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/70">
                  Time
                </p>

                <div className="grid gap-0.5">
                  {[
                    { key: 'all', label: 'Any time', count: counts.all },
                    { key: 'today', label: 'Today', count: counts.today },
                    { key: 'week', label: 'This week', count: counts.week },
                    { key: 'older', label: 'Older', count: counts.older },
                  ].map((item) => {
                    const active = timeFilter === item.key;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setTimeFilter(item.key as TimeFilter)}
                        className={[
                          'flex h-8 items-center justify-between rounded-[8px] border px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                          active
                            ? 'border-transparent bg-[var(--secondary)] font-semibold text-foreground'
                            : 'border-transparent bg-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                        ].join(' ')}
                      >
                        <span>{item.label}</span>
                        <span
                          className={[
                            'inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px]',
                            active
                              ? 'border border-[var(--primary-strong)] bg-[var(--primary-strong)] text-white'
                              : 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-200',
                          ].join(' ')}
                        >
                          {item.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/30"
          >
            Clear filters
          </button>
        </aside>

        <main className="surface min-w-0 overflow-hidden rounded-2xl border border-border bg-card lg:max-h-[calc(100vh-120px)]">
          <div className="sticky top-0 z-20 flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  {categoryFilter === 'all' ? 'All notifications' : categoryLabel(categoryFilter)}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {visibleNotifications.length} item{visibleNotifications.length === 1 ? '' : 's'}
                </span>
                {counts.unread > 0 ? (
                  <span className="inline-flex items-center rounded-full border border-destructive/25 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                    {counts.unread} unread
                  </span>
                ) : null}
              </div>
            </div>

            {showReopenedTab ? (
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={() => setCategoryFilter('all')}
                  className={[
                    'rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium',
                    categoryFilter === 'all' ? 'border-primary/30 bg-primary/10 text-primary' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  All
                </button>
                <button
                  type='button'
                  onClick={() => setCategoryFilter('reopened')}
                  className={[
                    'rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium',
                    categoryFilter === 'reopened' ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  Reopened
                </button>
              </div>
            ) : null}
          </div>

          {availableTypes.length > 0 ? (
            <div className="sticky top-[61px] z-10 flex min-w-0 flex-wrap gap-2 border-b border-border bg-card px-4 py-3">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={[
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150',
                  typeFilter === 'all'
                    ? 'border-[rgba(34,211,238,0.28)] bg-[linear-gradient(135deg,var(--accent),var(--primary-strong))] text-white hover:-translate-y-px hover:shadow-sm'
                    : 'border-accent/20 bg-card text-muted-foreground hover:-translate-y-px hover:border-accent/30 hover:text-foreground hover:shadow-sm',
                ].join(' ')}
              >
                All
              </button>

              {availableTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  className={[
                    'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150',
                    typeFilter === type
                      ? 'border-[rgba(34,211,238,0.28)] bg-[linear-gradient(135deg,var(--accent),var(--primary-strong))] text-white hover:-translate-y-px hover:shadow-sm'
                      : 'border-accent/20 bg-card text-muted-foreground hover:-translate-y-px hover:border-accent/30 hover:text-foreground hover:shadow-sm',
                  ].join(' ')}
                >
                  {getNotificationDisplayType(type, user?.role)}
                </button>
              ))}
            </div>
          ) : null}

          <div className="max-h-[calc(100vh-240px)] overflow-y-auto [scrollbar-color:rgba(255,255,255,0.9)_transparent] [scrollbar-width:thin]">
            {pageLoading ? <WorkspaceLoader variant="section" label="Loading notifications..." /> : null}

            {error ? <div className="p-6 text-sm text-destructive">{error}</div> : null}

            {!pageLoading && !error && visibleNotifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No notifications to show.</div>
            ) : null}

            {!pageLoading && !error && visibleNotifications.length > 0 ? (
              <>
                <div className="divide-y divide-border pt-1">
                  {visibleNotifications.map((item) => {
                    const category = getNotificationCategory(item.type);
                    const isCompleted = isNotificationCompleted(item);

                    return (
                      <article
                        key={item.id}
                        className={[
                          'grid max-w-full grid-cols-[16px_minmax(0,1fr)_auto] gap-3 overflow-hidden px-4 py-3 transition-colors hover:bg-accent/5',
                          isCompleted
                            ? 'border-l-2 border-l-[rgba(74,222,128,0.95)] bg-[linear-gradient(90deg,rgba(134,239,172,0.22),rgba(134,239,172,0.10),transparent)] dark:border-l-[rgba(110,231,183,0.95)] dark:bg-[linear-gradient(90deg,rgba(110,231,183,0.30),rgba(110,231,183,0.14),transparent)]'
                            : item.is_read
                              ? 'bg-card'
                              : 'border-l-2 border-l-[rgba(34,211,238,0.65)] bg-[linear-gradient(90deg,rgba(34,211,238,0.16),transparent)] dark:border-l-[rgba(56,189,248,0.75)] dark:bg-[linear-gradient(90deg,rgba(56,189,248,0.24),transparent)]',
                        ].join(' ')}
                      >
                        <div className="flex items-start justify-center pt-1">
                          <span className="inline-flex h-4 w-4 items-center justify-center">
                            {isCompleted ? (
                              <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                            ) : !item.is_read ? (
                              <span className="h-2 w-2 rounded-full bg-[linear-gradient(135deg,rgba(34,211,238,1),rgba(30,58,138,0.95))]" />
                            ) : null}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => openNotification(item)}
                          className="min-w-0 text-left"
                        >
                          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <h3
                                className={[
                                  'truncate text-sm text-foreground',
                                  item.is_read ? 'font-medium' : 'font-semibold',
                                ].join(' ')}
                              >
                                {getCompletedNotificationTitle(item)}
                              </h3>

                              {categoryFilter === 'all' ? (
                                <span
                                  className={[
                                    'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                    getCategoryBadgeClass(category),
                                  ].join(' ')}
                                >
                                  {getNotificationCategoryLabel(category)}
                                </span>
                              ) : null}

                              <span
                                className={[
                                  'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                  getTypeBadgeClass(item.type, user?.role),
                                ].join(' ')}
                              >
                                {getNotificationDisplayType(item.type, user?.role)}
                              </span>
                            </div>
                          </div>

                          <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{item.message}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(item.created_at)}</p>
                        </button>

                        <div className="flex shrink-0 items-center gap-2 pl-2">
                          {!item.is_read ? (
                            <button
                              type="button"
                              onClick={() => void markRead(item.id)}
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              title="Mark as read"
                              aria-label="Mark as read"
                            >
                              <Check size={15} />
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => openNotification(item)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-muted/40"
                          >
                            Open <ChevronRight size={15} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="border-t border-border bg-card px-4 py-3">
                  {hasMore ? (
                    <div className="flex flex-col items-center gap-3">
                      <div ref={loadMoreRef} className="h-1 w-full" aria-hidden="true" />
                      <button
                        type="button"
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="inline-flex min-w-[150px] items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loadingMore ? 'Loading more...' : 'Load More'}
                      </button>
                    </div>
                  ) : notifications.length > 0 ? (
                    <div className="text-center text-xs text-muted-foreground">You&apos;ve reached the latest notifications.</div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
