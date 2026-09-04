import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE_NAME, getExpectedAdminToken } from './constants/auth';
import { SESSION_COOKIE_NAME, verifySessionToken, canModerate, isAdmin } from './lib/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and auth API routes without authentication
  if (
    pathname === '/admin/login' ||
    pathname.startsWith('/api/admin/auth') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  // Extract session token or legacy admin token
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const legacyAdminCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const expectedLegacyToken = getExpectedAdminToken();

  const sessionUser = sessionCookie ? await verifySessionToken(sessionCookie) : null;
  const hasLegacyAdminAccess = legacyAdminCookie && legacyAdminCookie === expectedLegacyToken;

  const isUserAdmin = (sessionUser && isAdmin(sessionUser.role)) || hasLegacyAdminAccess;
  const isUserModeratorOrAdmin = (sessionUser && canModerate(sessionUser.role)) || hasLegacyAdminAccess;

  // 1. Strict Admin-Only Routes (/admin/users, /api/admin/users)
  const isSuperAdminRoute = pathname === '/admin/users' || pathname.startsWith('/admin/users/');
  const isSuperAdminApi = pathname.startsWith('/api/admin/users');

  if (isSuperAdminRoute || isSuperAdminApi) {
    if (!isUserAdmin) {
      if (isSuperAdminApi) {
        return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
      }
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 2. Admin & Moderator Console Routes (/admin, /api/admin)
  const isAdminRoute = pathname.startsWith('/admin');
  const isAdminApiRoute = pathname.startsWith('/api/admin');

  if (isAdminRoute || isAdminApiRoute) {
    if (!isUserModeratorOrAdmin) {
      if (isAdminApiRoute) {
        return NextResponse.json({ error: 'Unauthorized. Moderator or Admin role required.' }, { status: 401 });
      }
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 3. Contribution Submission Protection (POST /api/contributions)
  if (pathname === '/api/contributions' && request.method === 'POST') {
    if (!sessionUser && !hasLegacyAdminAccess) {
      return NextResponse.json({ error: 'Login is mandatory to contribute streets.' }, { status: 401 });
    }
    if (sessionUser && sessionUser.role === 'USER') {
      return NextResponse.json(
        { error: 'Verified Contributor status is required to submit street contributions.' },
        { status: 403 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/contributions',
  ],
};
