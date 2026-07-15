import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { canPerform, getAuthorizedRoutes } from '@/lib/permission-matrix';

const loginRateLimitWindowMs = 15 * 60 * 1000;
const loginRateLimitMaxAttempts = 5;
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();

function getClientIp(request: NextRequest) {
  // SECURITY: Only trust x-forwarded-for from Vercel edge (trusted proxy)
  // In production (Vercel), x-forwarded-for is set by Vercel infrastructure
  // For local development, fallback to x-real-ip or unknown
  const xForwardedFor = request.headers.get('x-forwarded-for');
  
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs: client, proxy1, proxy2, ...
    // The LAST IP is the most recent proxy (should be Vercel edge in production)
    // We take the FIRST IP which is the client
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    if (ips.length > 0 && ips[0]) {
      return ips[0];
    }
  }
  
  // Fallback: try x-real-ip (sometimes set by proxies)
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }
  
  // Final fallback: unknown
  return 'unknown';
}

function isRateLimited(key: string) {
  const record = loginAttempts.get(key);
  if (!record) return false;

  const elapsed = Date.now() - record.firstAttempt;
  if (elapsed > loginRateLimitWindowMs) {
    loginAttempts.delete(key);
    return false;
  }

  return record.count >= loginRateLimitMaxAttempts;
}

function incrementRateLimit(key: string) {
  const record = loginAttempts.get(key);
  if (!record) {
    loginAttempts.set(key, { count: 1, firstAttempt: Date.now() });
    return;
  }

  const elapsed = Date.now() - record.firstAttempt;
  if (elapsed > loginRateLimitWindowMs) {
    loginAttempts.set(key, { count: 1, firstAttempt: Date.now() });
  } else {
    record.count += 1;
    loginAttempts.set(key, record);
  }
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/api/auth/callback/credentials' && request.method === 'POST') {
    const ip = getClientIp(request);
    const key = `credentials:${ip}`;
    if (isRateLimited(key)) {
      return new NextResponse('Too many requests', {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(loginRateLimitWindowMs / 1000)),
          'Cache-Control': 'no-store, private',
        },
      });
    }
    incrementRateLimit(key);
  }

  return proxy(request);
}

const ROUTE_TO_MODULE: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/customers': 'customers',
  '/pets': 'pets',
  '/appointments': 'appointments',
  '/medical-records': 'medical-records',
  '/procedures': 'procedures',
  '/pet-hotel': 'pet-hotel',
  '/petshop': 'petshop',
  '/pos': 'pos',
  '/billing': 'billing',
  '/reports': 'reports',
  '/users': 'users',
  '/settings': 'settings',
  '/profile': 'profile',
};

const STAFF_PREFIXES = Object.keys(ROUTE_TO_MODULE);

const CUSTOMER_PREFIXES = ['/portal'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const publicRoutes = ['/login', '/api/auth', '/_next', '/favicon.ico'];

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? undefined,
  });

  const role = typeof token?.role === 'string' ? token.role : undefined;
  const isAuthenticated = Boolean(token?.sub);

  if (pathname === '/') {
    return NextResponse.next();
  }

  if (pathname === '/change-pin' || pathname.startsWith('/change-pin/')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
  }

  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  if (pathname === '/login') {
    if (isAuthenticated) {
      const redirectTo = role === 'CUSTOMER' ? '/portal' : '/dashboard';
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }

    return NextResponse.next();
  }

  if (CUSTOMER_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (role !== 'CUSTOMER') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  }

  if (STAFF_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (role === 'CUSTOMER') {
      return NextResponse.redirect(new URL('/portal', request.url));
    }

    if (!['OWNER', 'ADMIN_KLINIK', 'DOKTER'].includes(role ?? '')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const matchedModule = Object.entries(ROUTE_TO_MODULE).find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1];

    if (!matchedModule || !canPerform(role, matchedModule as any)) {
      const unauthorizedUrl = new URL('/dashboard', request.url);
      unauthorizedUrl.searchParams.set('unauthorized', '1');
      unauthorizedUrl.searchParams.set('route', pathname);
      console.warn(`[middleware] Unauthorized access: role=${role ?? 'unknown'} route=${pathname}`);
      return NextResponse.redirect(unauthorizedUrl);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
