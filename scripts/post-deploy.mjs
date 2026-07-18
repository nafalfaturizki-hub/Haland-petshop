#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { loadPrismaEnvironment } from './prepare-prisma-env.mjs';

/**
 * Post-deployment script for Vercel
 * Runs database migrations after the build completes
 * Add to vercel.json: "postBuildCommand": "node scripts/post-deploy.mjs"
 */

console.log('[Post-Deploy] Starting post-deployment tasks...');

// Skip migrations if explicitly disabled
if (process.env.SKIP_MIGRATIONS === 'true') {
  console.log('[Post-Deploy] Skipping migrations (SKIP_MIGRATIONS=true)');
  process.exit(0);
}

// Only run migrations if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.warn('[Post-Deploy] DATABASE_URL not set, skipping migrations');
  process.exit(0);
}

const shouldSeed = (process.env.SEED_ON_DEPLOY ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true')).toLowerCase() !== 'false';

const env = loadPrismaEnvironment();
const childEnv = {
  ...process.env,
  ...env,
};

console.log('[Post-Deploy] Running database migrations...');

const migrationResult = spawnSync('prisma', ['migrate', 'deploy', '--skip-generate'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: childEnv,
  shell: false,
});

if (migrationResult.status !== 0) {
  console.error('[Post-Deploy] Migration failed with status:', migrationResult.status);
  console.error('[Post-Deploy] This may cause runtime errors if the schema is out of sync');
  process.exit(0);
}

console.log('[Post-Deploy] Migrations completed successfully');

if (shouldSeed) {
  console.log('[Post-Deploy] Checking whether the database already has seed data...');
  const userCountResult = spawnSync('prisma', ['db', 'execute', '--stdin', '--', 'SELECT COUNT(*)::int AS count FROM "User";'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: childEnv,
    shell: false,
    encoding: 'utf8',
  });

  const userCount = Number.parseInt(String(userCountResult.stdout || '').match(/\b(\d+)\b/)?.[1] ?? '0', 10);
  if (userCount > 0) {
    console.log('[Post-Deploy] Database already contains users; skipping seed.');
  } else {
    console.log('[Post-Deploy] Running database seed...');
    const seedResult = spawnSync('prisma', ['db', 'seed'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: childEnv,
      shell: false,
    });

    if (seedResult.status !== 0) {
      console.warn('[Post-Deploy] Seed completed with warnings or failed; deployment continues.');
    }
  }
}

process.exit(0);
