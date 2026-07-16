import { PrismaClient, Prisma, type Customer } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

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
  } catch {
    // Audit log failures should not block operations
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
