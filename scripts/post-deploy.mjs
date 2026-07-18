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

const env = loadPrismaEnvironment();
const childEnv = {
  ...process.env,
  ...env,
};

console.log('[Post-Deploy] Running database migrations...');

const result = spawnSync('prisma', ['migrate', 'deploy', '--skip-generate'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: childEnv,
  shell: false,
});

if (result.status !== 0) {
  console.error('[Post-Deploy] Migration failed with status:', result.status);
  console.error('[Post-Deploy] This may cause runtime errors if the schema is out of sync');
  // Don't exit with error - allow deployment to complete
  process.exit(0);
}

console.log('[Post-Deploy] Migrations completed successfully');
process.exit(0);
