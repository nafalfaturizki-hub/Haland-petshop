function createStableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
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

export function getAuthBaseUrl(requestUrl?: string) {
  const explicitUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (explicitUrl?.trim()) {
    return explicitUrl.trim();
  }

  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim()}`;
  }

  if (requestUrl) {
    return requestUrl;
  }

  return 'http://localhost:3000';
}
