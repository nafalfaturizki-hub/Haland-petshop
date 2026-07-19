import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_LOCAL_DATABASE_URL = 'postgresql://halandpet_user:halandpet_password@127.0.0.1:5432/halandpet_test?sslmode=disable';

export function resolvePrismaEnvironment(env = process.env) {
  const databaseUrl = env.DATABASE_URL?.trim();
  const directUrl = env.DIRECT_URL?.trim();
  const pooledAlias = env.POSTGRES_PRISMA_URL?.trim() || env.POSTGRES_URL?.trim() || env.DATABASE_URL_POOLING?.trim();
  const unpooledAlias = env.DATABASE_URL_UNPOOLED?.trim() || env.POSTGRES_URL_NON_POOLING?.trim() || env.POSTGRES_URL_NO_SSL?.trim();
  const resolvedDatabaseUrl = databaseUrl || pooledAlias || unpooledAlias || DEFAULT_LOCAL_DATABASE_URL;
  const resolvedDirectUrl = directUrl || unpooledAlias || resolvedDatabaseUrl;

  return {
    ...env,
    DATABASE_URL: resolvedDatabaseUrl,
    DIRECT_URL: resolvedDirectUrl,
  };
}

export function loadPrismaEnvironment() {
  const envPath = path.resolve(process.cwd(), '.env');
  const fallbackEnvPath = path.resolve(process.cwd(), '.env.local');

  const envFilePath = existsSync(envPath) ? envPath : existsSync(fallbackEnvPath) ? fallbackEnvPath : null;

  if (!envFilePath) {
    return resolvePrismaEnvironment({
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
    });
  }

  const content = readFileSync(envFilePath, 'utf8');
  const parsed = Object.fromEntries(
    content
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) {
          return [line.trim(), ''];
        }
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
        return [key, value];
      }),
  );

  return resolvePrismaEnvironment({
    ...process.env,
    ...parsed,
  });
}

function writeRuntimeEnvFile(env) {
  const envFilePath = path.resolve(process.cwd(), '.env.local');
  const lines = [];
  const databaseUrl = env.DATABASE_URL?.trim();
  const nextAuthSecret = (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '').trim();
  // During build, if no secret is provided, generate a temporary one.
  // At runtime, Vercel env vars override .env.local.
  const buildTimeSecret = nextAuthSecret || 'build-time-temporary-secret-do-not-use-in-production';
  const nextAuthUrl = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')).trim();

  if (databaseUrl) {
    lines.push(`DATABASE_URL=${databaseUrl}`);
  }
  if (buildTimeSecret) {
    lines.push(`AUTH_SECRET=${buildTimeSecret}`);
    lines.push(`NEXTAUTH_SECRET=${buildTimeSecret}`);
  }
  if (nextAuthUrl) {
    lines.push(`AUTH_URL=${nextAuthUrl}`);
    lines.push(`NEXTAUTH_URL=${nextAuthUrl}`);
  }

  if (lines.length > 0) {
    writeFileSync(envFilePath, `${lines.join('\n')}\n`, 'utf8');
  }
}

function runBuildSteps() {
  const env = loadPrismaEnvironment();
  writeRuntimeEnvFile(env);

  const childEnv = {
    ...process.env,
    ...env,
  };

  const generateResult = spawnSync('prisma', ['generate'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: childEnv,
    shell: false,
  });

  if (generateResult.status !== 0) {
    process.exit(generateResult.status ?? 1);
  }

  const buildResult = spawnSync('next', ['build'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: childEnv,
    shell: false,
  });

  if (buildResult.status !== 0) {
    process.exit(buildResult.status ?? 1);
  }

  if (!process.env.SKIP_MIGRATIONS && childEnv.DATABASE_URL) {
    console.log('[Build] Running database migrations...');
    const migrateResult = spawnSync('prisma', ['migrate', 'deploy'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: childEnv,
      shell: false,
    });

    if (migrateResult.status !== 0) {
      console.warn('[Build] Migrations failed - continuing build; post-deploy will retry on Vercel');
    }
  }
}

if (process.argv[1] && process.argv[1].includes('prepare-prisma-env.mjs')) {
  if (process.argv.includes('--build')) {
    runBuildSteps();
  } else {
    const env = loadPrismaEnvironment();
    writeRuntimeEnvFile(env);
    process.stdout.write(JSON.stringify(env));
  }
}
