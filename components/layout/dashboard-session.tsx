"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { AUTH_TOKEN_RECOVERY_EVENT } from '../../lib/client/auth-recovery';
import { fetchSessionUser, type SessionUser } from '../../lib/client/session';

type DashboardSessionValue = {
  user: SessionUser | null;
  loading: boolean;
};

const DashboardSessionContext = createContext<DashboardSessionValue>({ user: null, loading: true });

export function DashboardSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveringSession, setRecoveringSession] = useState(false);

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

    let active = true;
    let reloadTimer: number | null = null;

    async function onRecover() {
      if (!active) return;
      setRecoveringSession(true);
      try {
        const nextUser = await fetchSessionUser();
        if (active) setUser(nextUser);
      } catch {
        if (active) setUser(null);
      } finally {
        reloadTimer = window.setTimeout(() => {
          window.location.reload();
        }, 900);
      }
    }

    const handler = () => {
      void onRecover();
    };

    window.addEventListener(AUTH_TOKEN_RECOVERY_EVENT, handler as EventListener);
    return () => {
      active = false;
      if (reloadTimer) window.clearTimeout(reloadTimer);
      window.removeEventListener(AUTH_TOKEN_RECOVERY_EVENT, handler as EventListener);
    };
  }, []);

  return (
    <DashboardSessionContext.Provider value={{ user, loading }}>
      {children}
      {recoveringSession ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 p-4">
          <div className="surface w-full max-w-sm rounded-2xl border border-border/70 bg-background px-5 py-4 text-center shadow-2xl" style={{ display: 'grid', gap: 6 }}>
            <div className="text-sm font-semibold text-foreground">Refreshing session</div>
            <div className="text-sm text-muted-foreground">Refreshing session. Please wait a moment...</div>
          </div>
        </div>
      ) : null}
    </DashboardSessionContext.Provider>
  );
}

export function useDashboardSession() {
  return useContext(DashboardSessionContext);
}
