'use server';

import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageTargetRole, canPerformAction, type Role } from '@/lib/permissions';
import { normalizeUsername } from '@/lib/utils';

const createUserSchema = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(2).max(80),
  role: z.enum(['OWNER', 'ADMIN_KLINIK', 'DOKTER', 'CUSTOMER']),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

const resetPinSchema = z.object({
  userId: z.string().min(1),
});

const unlockUserSchema = z.object({
  userId: z.string().min(1),
});

function generatePin() {
  return String(randomInt(100000, 1000000));
}

function getActorRole(session: Awaited<ReturnType<typeof auth>>) {
  return (session?.user as { role?: string } | undefined)?.role as Role | undefined;
}

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ResetPinInput = z.infer<typeof resetPinSchema>;
export type UnlockUserInput = z.infer<typeof unlockUserSchema>;

export async function createUser(input: unknown) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = createUserSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const actorId = session.user.id;
  const permission = canManageTargetRole(actorRole, parsed.data.role as Role);
  if (!permission.allowed) {
    return { success: false, message: permission.message };
  }

  const normalizedUsername = normalizeUsername(parsed.data.username);
  const existing = await prisma.user.findFirst({
    where: { username: { equals: normalizedUsername, mode: 'insensitive' } },
  });
  if (existing) {
    return { success: false, message: 'Username sudah dipakai.' };
  }

  const temporaryPin = generatePin();
  const pinHash = await bcrypt.hash(temporaryPin, 10);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        username: normalizedUsername,
        pinHash,
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        role: parsed.data.role,
        isActive: parsed.data.isActive ?? true,
        mustChangePin: true,
        createdById: actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'CREATE',
        entity: 'User',
        entityId: created.id,
        description: `Membuat akun ${created.username}`,
      },
    });

    return created;
  });

  return { success: true, userId: user.id, temporaryPin };
}

export async function resetPin(input: unknown) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = resetPinSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (!canPerformAction(actorRole, 'users', 'update')) {
    return { success: false, message: 'Anda tidak berwenang melakukan reset PIN.' };
  }

  const targetUser = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!targetUser) {
    return { success: false, message: 'Akun tidak ditemukan.' };
  }

  const permission = canManageTargetRole(actorRole, targetUser.role as Role);
  if (!permission.allowed) {
    return { success: false, message: permission.message };
  }

  const temporaryPin = generatePin();
  const pinHash = await bcrypt.hash(temporaryPin, 10);

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: {
      pinHash,
      mustChangePin: true,
      failedPinAttempts: 0,
      isLocked: false,
      lockedUntil: null,
    },
  });

  return { success: true, temporaryPin };
}

export async function unlockUser(input: unknown) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = unlockUserSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (!canPerformAction(actorRole, 'users', 'update')) {
    return { success: false, message: 'Anda tidak berwenang membuka kunci akun.' };
  }

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: {
      isLocked: false,
      lockedUntil: null,
      failedPinAttempts: 0,
    },
  });

  return { success: true };
}
