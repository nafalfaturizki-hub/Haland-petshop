import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { canPerform } from '@/lib/permission-matrix';
import { getAuthSecret } from '@/lib/auth-env';
import { RATE_LIMIT } from '@/lib/constants';

// D3: Structured request logging for production observability.
function logRequest(request: NextRequest, status: number, role: string | null, durationMs: number) {
  const path = request.nextUrl.pathname;
  const method = request.method;
  const msg = `${method} ${path} ${status} ${durationMs}ms role=${role ?? 'unknown'}`;
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify({ level: 'info', message: msg, timestamp: new Date().toISOString() }));
  } else {
    console.log(`[${new Date().toISOString()}] ${msg}`);
  }
}

const loginRateLimitWindowMs = RATE_LIMIT.WINDOW_MS;
const loginRateLimitMaxAttempts = RATE_LIMIT.MAX_ATTEMPTS;
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
  // D3: Timing starts here for request logging.
  const start = Date.now();
  const { pathname } = request.nextUrl;

  if (pathname === '/api/auth/callback/credentials' && request.method === 'POST') {
    const ip = getClientIp(request);
    const key = `credentials:${ip}`;
    if (isRateLimited(key)) {
      logRequest(request, 429, null, Date.now() - start);
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

  const response = await proxy(request);
  const finalResponse = withSecurityHeaders(response);

  const token = await getToken({
    req: request,
    secret: getAuthSecret(),
    secureCookie: process.env.NODE_ENV === 'production',
  });
  const role = typeof token?.role === 'string' ? token.role : null;
  logRequest(request, finalResponse.status, role, Date.now() - start);

  return finalResponse;
}

const SECURITY_HEADERS: Record<string, string> = {
  // A3: Content Security Policy to mitigate XSS injection.
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
};

function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
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
    secret: getAuthSecret(),
    secureCookie: process.env.NODE_ENV === 'production',
  });

  const role = typeof token?.role === 'string' ? token.role : undefined;
  const userId = typeof token?.sub === 'string' && token.sub ? token.sub : (typeof token?.id === 'string' ? token.id : undefined);
  const isAuthenticated = Boolean(userId);

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
