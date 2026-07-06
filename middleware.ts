import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
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
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
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
