import { useCallback, useEffect, useRef } from 'react';

type RefreshReason = 'initial' | 'interval' | 'focus' | 'manual' | 'realtime' | 'queued';

type UseDashboardRefreshOptions = {
  enabled?: boolean;
  refresh: (reason: RefreshReason) => Promise<void> | void;
  intervalMs?: number;
  refreshOnFocus?: boolean;
  debounceMs?: number;
};

export function useDashboardRefresh({
  enabled = true,
  refresh,
  intervalMs,
  refreshOnFocus = false,
  debounceMs = 350,
}: UseDashboardRefreshOptions) {
  const refreshRef = useRef(refresh);
  const inFlightRef = useRef(false);
  const queuedReasonRef = useRef<RefreshReason | null>(null);
  const lastRunAtRef = useRef(0);
  const debounceTimerRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const runRefresh = useCallback(async (reason: RefreshReason) => {
    if (!enabled || unmountedRef.current) return;

    const now = Date.now();
    const elapsed = now - lastRunAtRef.current;
    if (reason !== 'queued' && debounceMs > 0 && elapsed < debounceMs) {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        void runRefresh(reason);
      }, debounceMs - elapsed);
      return;
    }

    if (inFlightRef.current) {
      queuedReasonRef.current = reason;
      return;
    }

    inFlightRef.current = true;
    lastRunAtRef.current = Date.now();

    try {
      await refreshRef.current(reason);
    } finally {
      inFlightRef.current = false;
      if (queuedReasonRef.current && !unmountedRef.current) {
        const nextReason = queuedReasonRef.current;
        queuedReasonRef.current = null;
        void runRefresh(nextReason);
      }
    }
  }, [debounceMs, enabled]);

  useEffect(() => {
    if (!enabled) return;
    void runRefresh('initial');
  }, [enabled, runRefresh]);

  useEffect(() => {
    if (!enabled || !intervalMs || intervalMs <= 0) return;
    const timer = window.setInterval(() => {
      void runRefresh('interval');
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, runRefresh]);

  useEffect(() => {
    if (!enabled || !refreshOnFocus) return;

    const handleFocus = () => {
      if (document.visibilityState === 'hidden') return;
      void runRefresh('focus');
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [enabled, refreshOnFocus, runRefresh]);

  return {
    triggerRefresh: useCallback((reason: Exclude<RefreshReason, 'initial' | 'interval' | 'focus' | 'queued'> = 'manual') => {
      void runRefresh(reason);
    }, [runRefresh]),
  };
}
