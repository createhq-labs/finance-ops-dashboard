"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';

type NotificationRow = {
  id: string;
  role_target: string | null;
  type: string;
  title: string;
  message: string;
  related_submission_id: string | null;
  related_review_id: string | null;
  target_path: string;
  is_read: boolean;
  created_at: string;
};

function formatTypeLabel(type: string) {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
    <div style={{ display: 'grid', gap: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Notifications</h1>
          <p className="text-muted">Open the exact submission or review context from each notification without leaving the current workflow pattern.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn"
            type="button"
            onClick={() => setUnreadOnly(false)}
            style={{ background: unreadOnly ? 'var(--card)' : 'var(--primary)', color: unreadOnly ? 'var(--fg)' : '#fff', border: unreadOnly ? '1px solid var(--border)' : 'none' }}
          >
            All
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => setUnreadOnly(true)}
            style={{ background: unreadOnly ? 'var(--primary)' : 'var(--card)', color: unreadOnly ? '#fff' : 'var(--fg)', border: unreadOnly ? 'none' : '1px solid var(--border)' }}
          >
            Unread ({unreadCount})
          </button>
          <button className="btn" type="button" onClick={() => void markAllRead()} disabled={unreadCount === 0}>
            Mark all read
          </button>
        </div>
      </header>

      {pageLoading ? <div className="surface text-muted" style={{ padding: 16 }}>Loading notifications...</div> : null}
      {error ? <div className="surface text-danger" style={{ padding: 16 }}>{error}</div> : null}

      {!pageLoading && !error && visibleNotifications.length === 0 ? (
        <div className="surface text-muted" style={{ padding: 16 }}>
          No notifications to show.
        </div>
      ) : null}

      {!pageLoading && !error ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {visibleNotifications.map((item) => (
            <article
              key={item.id}
              className="surface"
              style={{
                padding: 16,
                display: 'grid',
                gap: 10,
                borderColor: item.is_read ? 'var(--border)' : 'var(--primary)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'start' }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <strong>{item.title}</strong>
                    <span className="text-muted" style={{ fontSize: 12 }}>{formatTypeLabel(item.type)}</span>
                    {!item.is_read ? (
                      <span style={{ fontSize: 11, color: '#fff', background: 'var(--primary)', borderRadius: 999, padding: '2px 8px' }}>
                        Unread
                      </span>
                    ) : null}
                  </div>
                  <p className="text-muted" style={{ margin: 0 }}>{item.message}</p>
                </div>
                <span className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" type="button" onClick={() => void openNotification(item)}>
                  Open Related Item
                </button>
                {!item.is_read ? (
                  <button className="btn" type="button" onClick={() => void markRead(item.id)}>
                    Mark as read
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
