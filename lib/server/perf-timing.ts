// TEMPORARY diagnostic instrumentation (Task 3D). Not wired into any
// response - server console only. Safe to delete once the next optimization
// task's evidence has been captured; not intended as permanent
// infrastructure.
//
// Logs only stage names and durations - never tokens, cookies, emails, GST
// numbers, addresses, PI numbers, submission data, or request bodies.

const PERF_LOGGING = process.env.PERF_LOGGING === 'true'

let requestCounter = 0;

export type PerfTimer = {
  id: string;
  /** Logs the elapsed time since the previous log()/mark() call as `stage`. */
  log: (stage: string) => void;
  /** Logs a bare marker line with no duration (e.g. START, mode=overview). */
  mark: (label: string) => void;
  /** Logs total elapsed time since the timer was created. */
  total: () => void;
};

const NOOP_TIMER: PerfTimer = { id: '', log: () => {}, mark: () => {}, total: () => {} };

export function createPerfTimer(routeLabel: string): PerfTimer {
  if (!PERF_LOGGING) return NOOP_TIMER;

  requestCounter += 1;
  const id = Date.now().toString(36) + '-' + requestCounter.toString(36);
  const start = performance.now();
  let last = start;

  return {
    id,
    log(stage: string) {
      const now = performance.now();
      // eslint-disable-next-line no-console
      console.log(`[PERF][${routeLabel}][${id}] ${stage}=${(now - last).toFixed(0)}ms`);
      last = now;
    },
    mark(label: string) {
      // eslint-disable-next-line no-console
      console.log(`[PERF][${routeLabel}][${id}] ${label}`);
    },
    total() {
      const now = performance.now();
      // eslint-disable-next-line no-console
      console.log(`[PERF][${routeLabel}][${id}] TOTAL=${(now - start).toFixed(0)}ms`);
    },
  };
}
