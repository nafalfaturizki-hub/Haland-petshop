import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  // C10: Lightweight health check for load balancers / uptime monitors.
  // Verifies database connectivity without leaking system details.
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: 'ok', db: 'up', timestamp: new Date().toISOString() },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        db: 'down',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'unknown',
      },
      { status: 503 },
    );
  }
}
