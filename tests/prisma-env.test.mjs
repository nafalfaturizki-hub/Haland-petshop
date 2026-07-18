import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePrismaEnvironment } from '../scripts/prepare-prisma-env.mjs';

test('resolvePrismaEnvironment falls back to DATABASE_URL for DIRECT_URL', () => {
  const env = resolvePrismaEnvironment({
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/haland',
  });

  assert.equal(env.DATABASE_URL, 'postgresql://user:pass@localhost:5432/haland');
  assert.equal(env.DIRECT_URL, 'postgresql://user:pass@localhost:5432/haland');
});

test('resolvePrismaEnvironment preserves an explicit DIRECT_URL', () => {
  const env = resolvePrismaEnvironment({
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/haland',
    DIRECT_URL: 'postgresql://direct:pass@localhost:5432/haland',
  });

  assert.equal(env.DIRECT_URL, 'postgresql://direct:pass@localhost:5432/haland');
});

test('resolvePrismaEnvironment supports Vercel and Neon alias variables', () => {
  const env = resolvePrismaEnvironment({
    POSTGRES_PRISMA_URL: 'postgresql://prisma:pass@localhost:5432/haland',
    POSTGRES_URL_NON_POOLING: 'postgresql://direct:pass@localhost:5432/haland',
  });

  assert.equal(env.DATABASE_URL, 'postgresql://prisma:pass@localhost:5432/haland');
  assert.equal(env.DIRECT_URL, 'postgresql://direct:pass@localhost:5432/haland');
});
