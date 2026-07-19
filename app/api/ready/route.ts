import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;

    const envStatus = {
      databaseUrl: !!process.env.DATABASE_URL,
      directUrl: !!process.env.DIRECT_URL,
      authSecret: !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
      nodeEnv: process.env.NODE_ENV ?? 'development',
    };

    const allEnvReady = envStatus.databaseUrl && envStatus.authSecret;

    if (allEnvReady) {
      return NextResponse.json(
        {
          status: 'ready',
          db: { status: 'up', latencyMs: dbLatency },
          env: envStatus,
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        status: 'not_ready',
        db: { status: 'up', latencyMs: dbLatency },
        env: envStatus,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'not_ready',
        db: { status: 'down' },
        error: error instanceof Error ? error.message : 'unknown',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
