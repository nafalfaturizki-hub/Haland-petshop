import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const loginRateLimitWindowMs = 15 * 60 * 1000;
const loginRateLimitMaxAttempts = 5;
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();

function getClientIp(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-proto') ||
    'unknown'
  );
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

const STAFF_PREFIXES = [
  '/dashboard',
  '/customers',
  '/pets',
  '/appointments',
  '/medical-records',
  '/pet-hotel',
  '/petshop',
  '/pos',
  '/billing',
  '/reports',
  '/users',
  '/settings',
  '/profile',
];

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

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
