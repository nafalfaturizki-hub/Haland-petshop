function createStableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function getAuthSecret() {
  const explicitSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (explicitSecret?.trim()) {
    return explicitSecret.trim();
  }

  if (process.env.DATABASE_URL?.trim()) {
    return createStableHash(process.env.DATABASE_URL.trim());
  }

  if (process.env.VERCEL_GIT_COMMIT_SHA?.trim()) {
    return createStableHash(process.env.VERCEL_GIT_COMMIT_SHA.trim());
  }

  return 'next-auth-dev-secret';
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
