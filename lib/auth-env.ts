function createStableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function isPlaceholderUrl(url: string): boolean {
  // Detect common placeholder patterns that cause Invalid URL errors at runtime.
  // See Vercel error: "TypeError: Invalid URL" with placeholder AUTH_URL values.
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.includes('placeholder') ||
    trimmed.includes('your-') ||
    trimmed.includes('yourdomain') ||
    trimmed.includes('where nextauth') ||
    trimmed === '' ||
    trimmed === 'http://localhost:3000'
  );
}

// ---------------------------------------------------------------------------
// CRITICAL: Sanitize AUTH_URL / NEXTAUTH_URL before NextAuth reads them.
// NextAuth internally calls `new URL(process.env.NEXTAUTH_URL)` at
// initialization. If the env var contains a placeholder value (e.g. "URL where
// NextAuth is running (production domain)") it throws TypeError: Invalid URL
// and crashes every request handler that imports lib/auth.ts.
//
// This module is imported before next-auth in lib/auth.ts, so we can clean
// the env var before NextAuth ever reads it.
// ---------------------------------------------------------------------------
const authUrl = process.env.AUTH_URL?.trim() ?? '';
const nextAuthUrl = process.env.NEXTAUTH_URL?.trim() ?? '';

if (authUrl && isPlaceholderUrl(authUrl)) {
  delete process.env.AUTH_URL;
}
if (nextAuthUrl && isPlaceholderUrl(nextAuthUrl)) {
  delete process.env.NEXTAUTH_URL;
  // NextAuth reads NEXTAUTH_URL; deleting it lets it fall back to VERCEL_URL.
}

let cachedSecret: string | undefined;

export function getAuthSecret(): string {
  if (cachedSecret !== undefined) {
    return cachedSecret;
  }

  const explicitSecret = (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET)?.trim();
  if (explicitSecret) {
    cachedSecret = explicitSecret;
    return cachedSecret;
  }

  // A1: In production, an explicit AUTH_SECRET is mandatory. Fail fast instead
  // of silently falling back to a deterministic or dev secret that would
  // invalidate all sessions and expose the app to JWT forgery.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: AUTH_SECRET is not set. Set AUTH_SECRET (or NEXTAUTH_SECRET) before starting in production.',
    );
  }

  if (process.env.DATABASE_URL?.trim()) {
    cachedSecret = createStableHash(process.env.DATABASE_URL.trim());
    return cachedSecret;
  }

  if (process.env.VERCEL_GIT_COMMIT_SHA?.trim()) {
    cachedSecret = createStableHash(process.env.VERCEL_GIT_COMMIT_SHA.trim());
    return cachedSecret;
  }

  cachedSecret = 'next-auth-dev-secret';
  return cachedSecret;
}
