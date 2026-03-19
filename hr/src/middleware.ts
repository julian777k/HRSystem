import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { isSaaSMode, SAAS_BASE_DOMAIN } from '@/lib/deploy-config';

// ──────────────────────────────────────────────
// Global API rate limiting (in-memory, per-isolate)
// 100 requests per 60 seconds per IP for /api/ routes
// Excludes /api/auth/*, /api/files/*, /api/internal/*
// ──────────────────────────────────────────────
const API_RATE_LIMIT = 100;
const API_RATE_WINDOW_MS = 60_000;

const apiRateLimitMap = new Map<string, { count: number; timestamp: number }>();

function checkApiRateLimit(request: NextRequest): Response | null {
  const { pathname } = request.nextUrl;

  // Only apply to /api/ routes
  if (!pathname.startsWith('/api/')) return null;

  // Exclude routes that have their own rate limits or are exempt
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/files/') ||
    pathname.startsWith('/api/internal/')
  ) {
    return null;
  }

  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';

  const now = Date.now();

  // Cleanup stale entries (older than the window)
  for (const [key, entry] of apiRateLimitMap) {
    if (now - entry.timestamp > API_RATE_WINDOW_MS) {
      apiRateLimitMap.delete(key);
    }
  }

  const existing = apiRateLimitMap.get(ip);

  if (existing && now - existing.timestamp <= API_RATE_WINDOW_MS) {
    existing.count++;
    if (existing.count > API_RATE_LIMIT) {
      return new Response(
        JSON.stringify({ message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
      );
    }
  } else {
    apiRateLimitMap.set(ip, { count: 1, timestamp: now });
  }

  return null;
}

// API routes that don't require authentication
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/register-company',
  '/api/setup/',
  '/api/super-admin/auth/login',
  '/api/payments/',
];

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Extract subdomain from the request host.
 * e.g. "acme.keystonehr.app" → "acme"
 *      "keystonehr.app" → null
 *      "localhost:3000" → null
 *      "acme.localhost:3000" → "acme" (local development)
 */
function extractSubdomain(host: string): string | null {
  // Remove port if present
  const hostname = host.split(':')[0];

  // Support *.localhost for local development (e.g., acme.localhost:3000)
  if (hostname.endsWith('.localhost')) {
    const prefix = hostname.slice(0, -'.localhost'.length);
    if (prefix && !prefix.includes('.')) {
      return prefix;
    }
    return null;
  }

  // For plain localhost or IP addresses, no subdomain
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  const baseDomain = SAAS_BASE_DOMAIN;
  if (!hostname.endsWith(baseDomain)) {
    return null;
  }

  // Extract part before the base domain
  const prefix = hostname.slice(0, -(baseDomain.length + 1)); // +1 for the dot
  if (!prefix || prefix.includes('.')) {
    // No subdomain, or multi-level subdomain (not supported)
    return null;
  }

  return prefix;
}

// ──────────────────────────────────────────────
// Self-hosted middleware (original logic)
// ──────────────────────────────────────────────
async function selfHostedMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow setup pages and static files
  if (
    pathname.startsWith('/setup') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Super admin routes: separate auth flow
  if (pathname.startsWith('/super-admin') || pathname.startsWith('/api/super-admin')) {
    if (pathname === '/super-admin/login' || isPublicApiRoute(pathname)) {
      return NextResponse.next();
    }
    const superAdminToken = request.cookies.get('super_admin_token')?.value;
    if (!superAdminToken) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ message: '인증 필요' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/super-admin/login', request.url));
    }
    return NextResponse.next();
  }

  // JWT authentication check
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const user = token ? (await verifyToken(token))?.user ?? null : null;

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

  // Public pages: login, register, legal
  if (['/login', '/register', '/privacy', '/terms'].includes(pathname)) {
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

// ──────────────────────────────────────────────
// SaaS middleware (multi-tenant)
// ──────────────────────────────────────────────
async function saasMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Internal API routes: block external access entirely.
  // Tenant resolution now uses D1 directly, so /api/internal/ is not needed.
  if (pathname.startsWith('/api/internal/')) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  // Super admin routes: skip tenant check but verify super_admin_token cookie
  if (pathname.startsWith('/super-admin') || pathname.startsWith('/api/super-admin')) {
    // Allow login page and public API routes without auth
    if (pathname === '/super-admin/login' || isPublicApiRoute(pathname)) {
      return NextResponse.next();
    }
    // Basic gate: require super_admin_token cookie (actual JWT verification in route handlers)
    const superAdminToken = request.cookies.get('super_admin_token')?.value;
    if (!superAdminToken) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ message: '인증 필요' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/super-admin/login', request.url));
    }
    return NextResponse.next();
  }

  const host = request.headers.get('host') || '';
  const subdomain = extractSubdomain(host);

  if (!subdomain) {
    // ── No subdomain: landing page / marketing site ──

    // Allow setup pages
    if (pathname.startsWith('/setup')) {
      return NextResponse.next();
    }

    // Allow landing page routes (including privacy, terms, start)
    if (pathname.startsWith('/(landing)') || pathname === '/' || pathname === '/privacy' || pathname === '/terms' || pathname === '/start' || pathname.startsWith('/purchase')) {
      return NextResponse.next();
    }

    // Allow auth pages (login, register) on root domain for setup flow
    if (['/login', '/register'].includes(pathname)) {
      return NextResponse.next();
    }

    // Allow public API routes (for landing page forms, etc.)
    if (pathname.startsWith('/api') && isPublicApiRoute(pathname)) {
      return NextResponse.next();
    }

    // Allow R2 file serving (screenshots for landing page)
    if (pathname.startsWith('/api/files/')) {
      return NextResponse.next();
    }

    // Redirect all other routes to landing page
    return NextResponse.redirect(new URL('/', request.url));
  }

  // ── With subdomain: tenant context ──
  // Set subdomain header — tenant resolution happens in server function layer
  // (Workers cannot self-fetch reliably, so we resolve tenantId lazily via D1)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-subdomain', subdomain);

  // Allow setup pages
  if (pathname.startsWith('/setup')) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Legal pages: accessible without auth on subdomains too
  if (pathname === '/privacy' || pathname === '/terms') {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // JWT authentication check
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const user = token ? (await verifyToken(token))?.user ?? null : null;

  // JWT tenant cross-verification is done in the server function layer
  // (where we have D1 access to resolve subdomain → tenantId)

  // API routes: check auth (except public API routes)
  if (pathname.startsWith('/api')) {
    if (isPublicApiRoute(pathname)) {
      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Public pages: login, register
  if (['/login', '/register'].includes(pathname)) {
    if (user && pathname === '/login') {
      const isAdmin = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role);
      return NextResponse.redirect(new URL(isAdmin ? '/admin' : '/dashboard', request.url));
    }
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
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

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.tosspayments.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.tosspayments.com https://*.tosspayments.com; frame-src https://*.tosspayments.com; frame-ancestors 'none'");
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  return response;
}

export async function middleware(request: NextRequest) {
  // Global API rate limit check (early exit)
  const rateLimitResponse = checkApiRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const response = isSaaSMode()
    ? await saasMiddleware(request)
    : await selfHostedMiddleware(request);
  return addSecurityHeaders(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
