import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function createAuditLog(userId: string, action: string, entity: string, entityId: string | null, description: string | null) {
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
  } catch {
    // Audit log failures should not block operations
  }
}

export async function getCustomerForSession(sessionId: string) {
  return prisma.customer.findFirst({ where: { userId: sessionId } });
}
