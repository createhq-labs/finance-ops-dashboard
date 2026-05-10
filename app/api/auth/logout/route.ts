import { NextResponse } from 'next/server';
import { clearAuthCookies } from '../../../../../lib/server/services/authCookies';

export async function POST() {
  const res = NextResponse.json({ success: true }, { status: 200 });
  clearAuthCookies(res);
  return res;
}