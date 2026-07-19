#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { loadPrismaEnvironment } from './prepare-prisma-env.mjs';

/**
 * Post-deployment script for Vercel
 * Runs database migrations after the build completes
 * Integrated via buildCommand in vercel.json: "buildCommand": "npm run build && node scripts/post-deploy.mjs"
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

const shouldSeed = (process.env.SEED_ON_DEPLOY ?? 'false').toLowerCase() === 'true';

const env = loadPrismaEnvironment();
const childEnv = {
  ...process.env,
  ...env,
};

console.log('[Post-Deploy] Running database migrations...');

const migrationResult = spawnSync('prisma', ['migrate', 'deploy'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: childEnv,
  shell: false,
});

if (migrationResult.status !== 0) {
  console.error('[Post-Deploy] Migration failed with status:', migrationResult.status);
  console.error('[Post-Deploy] This may cause runtime errors if the schema is out of sync');
  process.exit(migrationResult.status ?? 1);
}

console.log('[Post-Deploy] Migrations completed successfully');

if (shouldSeed) {
  console.log('[Post-Deploy] Running database seed (safe to run on existing data)...');
  const seedResult = spawnSync('prisma', ['db', 'seed'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: childEnv,
    shell: false,
    timeout: 30000,
  });

  if (seedResult.status !== 0) {
    console.warn('[Post-Deploy] Seed completed with warnings or failed; deployment continues.');
  } else {
    console.log('[Post-Deploy] Seed completed successfully.');
  }
}

process.exit(0);
