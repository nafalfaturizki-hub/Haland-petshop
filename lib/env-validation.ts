// C3: Startup environment validation.
// Fails fast (throws) when required variables are missing in production so the
// app never boots into a silently-broken state.

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

export interface EnvValidationResult {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (isBlank(process.env.DATABASE_URL)) {
    missing.push('DATABASE_URL');
  }

  if (isBlank(process.env.DIRECT_URL)) {
    // DIRECT_URL is required for Prisma migrations against Neon. Fall back to
    // DATABASE_URL if absent, but warn since pooled URLs can break migrations.
    if (!isBlank(process.env.DATABASE_URL)) {
      warnings.push('DIRECT_URL is not set; falling back to DATABASE_URL for direct connections.');
    } else {
      missing.push('DIRECT_URL');
    }
  }

  // AUTH_SECRET is mandatory in production (see lib/auth-env.ts).
  if (process.env.NODE_ENV === 'production') {
    if (isBlank(process.env.AUTH_SECRET) && isBlank(process.env.NEXTAUTH_SECRET)) {
      missing.push('AUTH_SECRET (or NEXTAUTH_SECRET)');
    }
  }

  const ok = missing.length === 0;

  if (!ok && process.env.NODE_ENV === 'production') {
    throw new Error(
      `Environment validation failed. Missing required variables: ${missing.join(', ')}.`,
    );
  }

  return { ok, missing, warnings };
}
