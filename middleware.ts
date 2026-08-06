import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies, getAccessTokenFromCookieHeader, getRefreshTokenFromCookieHeader, setAuthCookies } from './lib/server/services/authCookies';

const PROTECTED_PREFIXES = ['/dashboard'];
const AUTH_PAGES = ['/login'];
const PUBLIC_API_PATHS = new Set(['/api/auth/login', '/api/auth/logout', '/api/auth/signup', '/api/auth/oauth/callback']);

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

function isAuthenticatedApiPath(pathname: string) {
  return pathname.startsWith('/api/') && !PUBLIC_API_PATHS.has(pathname);
}

function isJwtExpired(token: string | null) {
  if (!token) return true;

  try {
    const parts = token.split('.');
    const payload = parts[1];
    if (!payload) return true;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const decoded = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof decoded.exp !== 'number') return true;
    return decoded.exp <= Math.floor(Date.now() / 1000) + 30;
  } catch {
    return true;
  }
}

function upsertCookieHeader(cookieHeader: string, name: string, value: string) {
  const cookies = new Map<string, string>();
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    cookies.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
  }
  cookies.set(name, value);
  return Array.from(cookies.entries())
    .map(([key, currentValue]) => key + '=' + currentValue)
    .join('; ');
}

function withUpdatedRequestCookies(req: NextRequest, accessToken: string, refreshToken: string) {
  const headers = new Headers(req.headers);
  let cookieHeader = headers.get('cookie') || '';
  cookieHeader = upsertCookieHeader(cookieHeader, 'sb-access-token', accessToken);
  cookieHeader = upsertCookieHeader(cookieHeader, 'sb-refresh-token', refreshToken);
  headers.set('cookie', cookieHeader);
  return headers;
}

async function refreshSession(refreshToken: string) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session?.access_token || !data.session.refresh_token) {
    throw new Error(error?.message || 'Failed to refresh session');
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (pathname === '/signup') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const accessToken = getAccessTokenFromCookieHeader(req.cookies);
  const refreshToken = getRefreshTokenFromCookieHeader(req.cookies);
  const needsAuthHandling = isProtectedPath(pathname) || isAuthenticatedApiPath(pathname) || AUTH_PAGES.includes(pathname);

  let nextAccessToken = accessToken;
  let nextRefreshToken = refreshToken;

  if (needsAuthHandling && refreshToken && isJwtExpired(accessToken)) {
    try {
      console.info('Refreshing expired session');
      const refreshed = await refreshSession(refreshToken);
      nextAccessToken = refreshed.accessToken;
      nextRefreshToken = refreshed.refreshToken;
      console.info('Session refresh successful');
    } catch (error) {
      console.warn('Session refresh failed', error);
      const clearedResponse = isProtectedPath(pathname)
        ? NextResponse.redirect(new URL('/login', req.url))
        : NextResponse.next();
      clearAuthCookies(clearedResponse);
      return clearedResponse;
    }
  }

  const effectiveAccessToken = nextAccessToken;
  const effectiveRefreshToken = nextRefreshToken;

  if (isProtectedPath(pathname) && !effectiveAccessToken) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    const response = NextResponse.redirect(loginUrl);
    if (!effectiveRefreshToken) {
      clearAuthCookies(response);
    }
    return response;
  }

  if (effectiveAccessToken && AUTH_PAGES.includes(pathname)) {
    const response = NextResponse.redirect(new URL('/dashboard', req.url));
    if (effectiveRefreshToken && (effectiveAccessToken !== accessToken || effectiveRefreshToken !== refreshToken)) {
      setAuthCookies(response, effectiveAccessToken, effectiveRefreshToken);
    }
    return response;
  }

  if (effectiveAccessToken && effectiveRefreshToken && (effectiveAccessToken !== accessToken || effectiveRefreshToken !== refreshToken)) {
    const response = NextResponse.next({
      request: {
        headers: withUpdatedRequestCookies(req, effectiveAccessToken, effectiveRefreshToken),
      },
    });
    setAuthCookies(response, effectiveAccessToken, effectiveRefreshToken);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup', '/api/:path*'],
};
