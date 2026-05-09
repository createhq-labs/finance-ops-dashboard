import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppUser } from './types/submissions';

export function getBearerToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  const [scheme, token] = auth.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new Error('Missing Bearer token');
  }
  return token;
}

export async function getCurrentAppUser(client: SupabaseClient, token: string): Promise<AppUser> {
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user) throw new Error('Unauthorized');

  const { data: user, error } = await client
    .from('users')
    .select('id, supabase_auth_id, email, role, status')
    .eq('supabase_auth_id', authData.user.id)
    .single();

  if (error || !user) throw new Error('User mapping not found');
  if (user.status !== 'active') throw new Error('User is inactive');

  return user as AppUser;
}