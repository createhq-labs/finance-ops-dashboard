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
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );
}

export function createServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    SERVER_SUPABASE_OPTIONS
  );
}
