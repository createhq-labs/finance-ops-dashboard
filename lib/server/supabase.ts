import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

class ServerOnlyRealtimeTransport {
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readonly readyState = 3;
  readonly url: string;
  readonly protocol = '';
  readonly bufferedAmount = 0;
  readonly extensions = '';
  binaryType = 'blob';
  onopen: ((this: unknown, ev: Event) => unknown) | null = null;
  onmessage: ((this: unknown, ev: MessageEvent) => unknown) | null = null;
  onclose: ((this: unknown, ev: CloseEvent) => unknown) | null = null;
  onerror: ((this: unknown, ev: Event) => unknown) | null = null;

  constructor(address: string | URL) {
    this.url = String(address);
  }

  close() {}

  send() {
    throw new Error('Realtime is not used by server Supabase clients.');
  }

  addEventListener() {}

  removeEventListener() {}

  dispatchEvent() {
    return false;
  }
}

// A single Finance Review page load fires many sequential Supabase REST calls
// (across the finance list, master data reviews, follow-ups, and badge-count
// routes) sharing Node's process-wide HTTP connection pool. Under load an
// individual connection attempt can intermittently fail to establish
// ("TypeError: fetch failed", wrapping a connect-level cause such as
// ETIMEDOUT/ECONNRESET) even though the Supabase project itself is healthy
// and an adjacent call on the same request just succeeded. This mirrors the
// existing single-retry pattern already used for `auth.getUser` in
// lib/server/auth.ts, generalized to every Supabase REST call made by these
// server-side clients.
// Deterministic for the exact same request - e.g. a request URL/headers that
// are simply too large will fail identically on every attempt, so retrying
// only adds latency without any chance of succeeding. Checked before the
// generic retryable set so a batching bug can never be masked by a retry.
const NON_RETRYABLE_CAUSE_CODES = new Set(['UND_ERR_HEADERS_OVERFLOW']);

function isRetryableNetworkFetchError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  const cause = (error as Error & { cause?: { code?: string } }).cause;
  if (cause?.code && NON_RETRYABLE_CAUSE_CODES.has(cause.code)) return false;

  const retryableCauseCodes = new Set([
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'EPIPE',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_SOCKET',
  ]);
  if (cause?.code && retryableCauseCodes.has(cause.code)) return true;
  if (cause?.code) return false;
  return error.message === 'fetch failed';
}

const fetchWithSingleRetry: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (!isRetryableNetworkFetchError(error)) throw error;
    return fetch(input, init);
  }
};

const SERVER_SUPABASE_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ServerOnlyRealtimeTransport },
};

export function assertSupabaseEnv() {
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) throw new Error(`Missing env: ${key}`);
  }
}

export function createUserScopedClient(token: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...SERVER_SUPABASE_OPTIONS,
      global: { headers: { Authorization: `Bearer ${token}` }, fetch: fetchWithSingleRetry },
    }
  );
}

export function createServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      ...SERVER_SUPABASE_OPTIONS,
      global: { fetch: fetchWithSingleRetry },
    }
  );
}
