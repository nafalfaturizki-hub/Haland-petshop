import { PrismaClient, Prisma, type Customer } from '@prisma/client';
import { validateEnvironment } from './env-validation';

// C3: Validate required environment variables at startup (throws in production).
validateEnvironment();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  // D5: Log slow queries in development to identify performance bottlenecks
  // before they reach production. Warn+error always visible; query events
  // require the event listener below.
  log: process.env.NODE_ENV === 'development'
    ? [{ emit: 'event', level: 'query' }, { emit: 'stdout', level: 'warn' }, { emit: 'stdout', level: 'error' }]
    : [{ emit: 'stdout', level: 'warn' }, { emit: 'stdout', level: 'error' }],
});

// D5: Slow query logging — queries taking longer than 100ms logged in dev.
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: { duration: number; query: string; params: string }) => {
    if (e.duration > 100) {
      console.warn(`[DB] Slow query (${e.duration}ms): ${e.query.slice(0, 200)}`);
    }
  });
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function createAuditLog(userId: string, action: string, entity: string, entityId: string | null, description: string | null): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        description,
      },
    });
  } catch (error) {
    // A15: Audit log failures must be surfaced (not silently swallowed) so
    // security-relevant gaps are visible in monitoring instead of hidden.
    console.error('[audit] Failed to write audit log', {
      userId,
      action,
      entity,
      entityId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getOrCreateGuestCustomer(): Promise<Customer> {
  const guestName = 'Pelanggan Umum (Walk-in)';
  const existingGuest = await prisma.customer.findFirst({ where: { isGuest: true } });
  if (existingGuest) {
    return existingGuest;
  }

  try {
    return await prisma.customer.create({
      data: {
        name: guestName,
        userId: null,
        isGuest: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const retryGuest = await prisma.customer.findFirst({ where: { isGuest: true } });
      if (retryGuest) {
        return retryGuest;
      }
    }
    throw error;
  }
}

export async function getCustomerForSession(sessionId: string): Promise<Customer | null> {
  return prisma.customer.findFirst({ where: { userId: sessionId } });
}
