"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { AUTH_TOKEN_RECOVERY_EVENT } from '../../lib/client/auth-recovery';
import { fetchSessionUser, type SessionUser } from '../../lib/client/session';

type DashboardSessionValue = {
  user: SessionUser | null;
  loading: boolean;
};

const DashboardSessionContext = createContext<DashboardSessionValue>({ user: null, loading: true });

export function DashboardSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveringSession, setRecoveringSession] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('Refreshing session. Please wait a moment...');
  const [recoveryRefreshing, setRecoveryRefreshing] = useState(false);

  useEffect(() => {
    let active = true;

    fetchSessionUser()
      .then((nextUser) => {
        if (active) setUser(nextUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      const nextMessage = customEvent.detail?.message || 'Refreshing session. Please wait a moment...';
      setRecoveryMessage(nextMessage);
      setRecoveringSession(true);
      setRecoveryRefreshing(false);
    };

    window.addEventListener(AUTH_TOKEN_RECOVERY_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(AUTH_TOKEN_RECOVERY_EVENT, handler as EventListener);
    };
  }, []);


  async function handleRecoveryRefresh() {
    if (recoveryRefreshing) return;
    setRecoveryRefreshing(true);
    try {
      const nextUser = await fetchSessionUser();
      setUser(nextUser);
      router.refresh();
      window.setTimeout(() => {
        setRecoveringSession(false);
        setRecoveryRefreshing(false);
      }, 700);
    } catch {
      setUser(null);
      setRecoveryRefreshing(false);
      window.location.reload();
    }
  }

  return (
    <DashboardSessionContext.Provider value={{ user, loading }}>
      {children}
      {recoveringSession ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 p-4">
          <div className="surface w-full max-w-sm rounded-2xl border border-border/70 bg-background px-5 py-4 text-center shadow-2xl" style={{ display: 'grid', gap: 10 }}>
            <div className="text-sm font-semibold text-foreground">Refreshing session</div>
            <div className="text-sm text-muted-foreground">{recoveryMessage}</div>
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => void handleRecoveryRefresh()}
                disabled={recoveryRefreshing}
                className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--primary-strong),var(--accent))] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity disabled:cursor-wait disabled:opacity-75"
              >
                <RefreshCw size={15} className={recoveryRefreshing ? 'animate-spin' : ''} />
                {recoveryRefreshing ? 'Refreshing...' : 'Refresh dashboard'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardSessionContext.Provider>
  );
}

export function useDashboardSession() {
  return useContext(DashboardSessionContext);
}
