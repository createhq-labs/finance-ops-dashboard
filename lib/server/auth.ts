import { NextRequest } from 'next/server';
import type { AuthUser, SupabaseClient } from '@supabase/supabase-js';
import type { AppUser } from './types/submissions';


function isTimeoutError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const cause = (error as Error & { cause?: { code?: string } }).cause;
  return cause?.code === 'ETIMEDOUT';
}

async function getUserWithRetry(client: SupabaseClient, token: string) {
  try {
    return await client.auth.getUser(token);
  } catch (error) {
    if (!isTimeoutError(error)) throw error;
    return client.auth.getUser(token);
  }
}

export async function getAuthenticatedSupabaseUser(client: SupabaseClient, token: string): Promise<AuthUser> {
  const { data, error } = await getUserWithRetry(client, token);
  if (error || !data.user) throw new Error('Unauthorized');
  return data.user;
}

export function getBearerToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  const [scheme, token] = auth.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new Error('Missing Bearer token');
  }
  return token;
}

export async function getCurrentAppUser(client: SupabaseClient, token: string): Promise<AppUser> {
  const authUser = await getAuthenticatedSupabaseUser(client, token);

  const { data: user, error } = await client
    .from('users')
    .select('id, supabase_auth_id, email, role, status, business_line')
    .eq('supabase_auth_id', authUser.id)
    .single();

  if (error || !user) throw new Error('User mapping not found');
  if (user.status !== 'active') throw new Error('User is inactive');

  return user as AppUser;
}
