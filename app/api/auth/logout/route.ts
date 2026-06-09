import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/server/services/authCookies';

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', req.url), { status: 303 });
  clearAuthCookies(res);
  return res;
}
