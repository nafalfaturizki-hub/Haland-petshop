import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_LOCAL_DATABASE_URL = 'postgresql://halandpet_user:halandpet_password@127.0.0.1:5432/halandpet_test?sslmode=disable';

export function resolvePrismaEnvironment(env = process.env) {
  const databaseUrl = env.DATABASE_URL?.trim();
  const directUrl = env.DIRECT_URL?.trim();
  const unpooledUrl = env.DATABASE_URL_UNPOOLED?.trim() || env.POSTGRES_URL_NON_POOLING?.trim();
  const resolvedDatabaseUrl = databaseUrl || DEFAULT_LOCAL_DATABASE_URL;

  return {
    ...env,
    DATABASE_URL: resolvedDatabaseUrl,
    // Use provided DIRECT_URL, fall back to unpooled URL, then to DATABASE_URL
    DIRECT_URL: directUrl || unpooledUrl || resolvedDatabaseUrl,
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
  const directUrl = env.DIRECT_URL?.trim();

  if (databaseUrl) {
    lines.push(`DATABASE_URL=${databaseUrl}`);
  }
  if (directUrl) {
    lines.push(`DIRECT_URL=${directUrl}`);
  }

  if (process.env.NEXTAUTH_SECRET) {
    lines.push(`NEXTAUTH_SECRET=${process.env.NEXTAUTH_SECRET}`);
  }
  if (process.env.NEXTAUTH_URL) {
    lines.push(`NEXTAUTH_URL=${process.env.NEXTAUTH_URL}`);
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

  const commands = [
    ['prisma', ['generate']],
    ['next', ['build']],
  ];

  for (const [command, args] of commands) {
    const result = spawnSync(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: childEnv,
      shell: false,
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }

  // Optionally run migrations if not in CI/Vercel build
  if (!process.env.SKIP_MIGRATIONS && !process.env.VERCEL) {
    console.log('[Build] Running database migrations...');
    const migrateResult = spawnSync('prisma', ['migrate', 'deploy'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: childEnv,
      shell: false,
    });
    // Don't fail the build if migrations fail - they can be run separately
    if (migrateResult.status !== 0) {
      console.warn('[Build] Migrations failed - may need to run manually on deployment');
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
