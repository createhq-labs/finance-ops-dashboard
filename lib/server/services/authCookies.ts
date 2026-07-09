import { NextResponse } from 'next/server';

const ACCESS_COOKIE = 'sb-access-token';
const REFRESH_COOKIE = 'sb-refresh-token';

const BASE_COOKIE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export function setAuthCookies(res: NextResponse, accessToken: string, refreshToken: string) {
  res.cookies.set(ACCESS_COOKIE, accessToken, {
    ...BASE_COOKIE,
    maxAge: 60 * 60,
  });

  res.cookies.set(REFRESH_COOKIE, refreshToken, {
    ...BASE_COOKIE,
    maxAge: 60 * 60 * 24 * 14,
  });
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, '', { ...BASE_COOKIE, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { ...BASE_COOKIE, maxAge: 0 });
}

export function getAccessTokenFromCookieHeader(cookieStore: { get(name: string): { value: string } | undefined }) {
  return cookieStore.get(ACCESS_COOKIE)?.value ?? null;
}

export function getRefreshTokenFromCookieHeader(cookieStore: { get(name: string): { value: string } | undefined }) {
  return cookieStore.get(REFRESH_COOKIE)?.value ?? null;
}
