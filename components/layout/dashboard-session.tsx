"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { fetchSessionUser, type SessionUser } from '../../lib/client/session';

type DashboardSessionValue = {
  user: SessionUser | null;
  loading: boolean;
};

const DashboardSessionContext = createContext<DashboardSessionValue>({ user: null, loading: true });

export function DashboardSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

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

  return <DashboardSessionContext.Provider value={{ user, loading }}>{children}</DashboardSessionContext.Provider>;
}

export function useDashboardSession() {
  return useContext(DashboardSessionContext);
}
