export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  role: 'employee' | 'team_lead' | 'finance' | 'admin' | 'developer';
  status: 'active' | 'inactive';
  business_line: 'IM' | 'TM' | null;
};

export async function fetchSessionUser(): Promise<SessionUser | null> {
  const res = await fetch('/api/auth/session', { cache: 'no-store' });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json?.authenticated || !json?.user) return null;
  return json.user as SessionUser;
}
