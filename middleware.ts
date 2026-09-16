import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE_NAME, getExpectedAdminToken } from './constants/auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and auth API routes without authentication
  if (pathname === '/admin/login' || pathname.startsWith('/api/admin/auth')) {
    return NextResponse.next();
  }

  // Protect admin dashboard and admin API endpoints
  const isAdminRoute = pathname.startsWith('/admin');
  const isAdminApiRoute = pathname.startsWith('/api/admin');

  if (isAdminRoute || isAdminApiRoute) {
    const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME);
    const expectedToken = getExpectedAdminToken();

    if (!sessionCookie || sessionCookie.value !== expectedToken) {
      if (isAdminApiRoute) {
        return NextResponse.json({ error: 'Unauthorized. Admin credentials required.' }, { status: 401 });
      }

      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
