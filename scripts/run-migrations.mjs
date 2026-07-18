#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { loadPrismaEnvironment } from './prepare-prisma-env.mjs';

/**
 * Runs Prisma migrations on production database
 * This script should be executed after deployment to apply any pending migrations
 */

console.log('Starting database migrations...');

const env = loadPrismaEnvironment();
const childEnv = {
  ...process.env,
  ...env,
};

const result = spawnSync('prisma', ['migrate', 'deploy'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: childEnv,
  shell: false,
});

if (result.status !== 0) {
  console.error('Migration failed with status:', result.status);
  process.exit(result.status ?? 1);
}

console.log('Migrations completed successfully');
process.exit(0);
