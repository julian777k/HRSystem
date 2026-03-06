import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

// API routes that don't require authentication
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/setup/',
];

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow setup pages and static files
  if (
    pathname.startsWith('/setup') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // JWT authentication check
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  // API routes: check auth (except public API routes)
  if (pathname.startsWith('/api')) {
    if (isPublicApiRoute(pathname)) {
      return NextResponse.next();
    }
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Public pages: login, register, forgot-password, reset-password
  if (['/login', '/register', '/forgot-password', '/reset-password'].includes(pathname)) {
    if (user && pathname === '/login') {
      const isAdmin = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role);
      return NextResponse.redirect(new URL(isAdmin ? '/admin' : '/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Protected routes: redirect to login if not authenticated
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based root redirect
  if (pathname === '/') {
    const isAdmin = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role);
    return NextResponse.redirect(new URL(isAdmin ? '/admin' : '/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
