'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { createUser as createUserInternal, resetPin as resetPinInternal, unlockUser as unlockUserInternal } from '@/lib/user-management';
import { prisma } from '@/lib/db';
import { canManageTargetRole, canPerformAction, type Role } from '@/lib/permissions';
import { getActorRole, normalizeUsername } from '@/lib/utils';

const userInputSchema = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(2).max(80),
  role: z.enum(['OWNER', 'ADMIN_KLINIK', 'DOKTER', 'CUSTOMER']),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

const updateUserSchema = userInputSchema.extend({
  id: z.string().min(1),
});

const deleteUserSchema = z.object({
  id: z.string().min(1),
});

const activateUserSchema = z.object({
  id: z.string().min(1),
});

const resetPinSchema = z.object({
  id: z.string().min(1),
});

const unlockUserSchema = z.object({
  id: z.string().min(1),
});

function getCastedActorRole(session: Awaited<ReturnType<typeof auth>>) {
  return getActorRole(session) as Role | undefined;
}

export async function listUsers() {
  const session = await auth();
  const actorRole = getCastedActorRole(session);

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (!actorRole || !canPerformAction(actorRole, 'users', 'read')) {
    return { success: false, message: 'Anda tidak berwenang melihat daftar pengguna.' };
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      username: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      isLocked: true,
      mustChangePin: true,
      failedPinAttempts: true,
      createdAt: true,
      createdBy: {
        select: { username: true, name: true },
      },
    },
  });

  return { success: true, users };
}

export async function createUser(input: z.infer<typeof userInputSchema>) {
  const result = await createUserInternal(input);
  if (result.success) {
    revalidatePath('/users');
  }
  return result;
}

export async function updateUser(input: z.infer<typeof updateUserSchema>) {
  const session = await auth();
  const actorRole = getCastedActorRole(session);
  const parsed = updateUserSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (!actorRole || !canPerformAction(actorRole, 'users', 'update')) {
    return { success: false, message: 'Anda tidak berwenang mengubah akun.' };
  }

  const actorId = session.user.id;
  const targetUser = await prisma.user.findUnique({ where: { id: parsed.data.id } });
  if (!targetUser) {
    return { success: false, message: 'Akun tidak ditemukan.' };
  }

  const permission = canManageTargetRole(actorRole, targetUser.role as Role);
  if (!permission.allowed) {
    return { success: false, message: permission.message };
  }

  const rolePermission = canManageTargetRole(actorRole, parsed.data.role as Role);
  if (!rolePermission.allowed) {
    return { success: false, message: rolePermission.message };
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.user.update({
        where: { id: parsed.data.id },
        data: {
          username: normalizeUsername(parsed.data.username),
          name: parsed.data.name,
          phone: parsed.data.phone || null,
          role: parsed.data.role,
          isActive: parsed.data.isActive ?? targetUser.isActive,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'UPDATE',
          entity: 'User',
          entityId: current.id,
          description: `Memperbarui akun ${current.username}`,
        },
      });

      return current;
    });

    revalidatePath('/users');
    return { success: true, userId: updated.id };
  } catch (error) {
    console.error('Failed to update user', error);
    return { success: false, message: 'Gagal memperbarui akun.' };
  }
}

export async function deleteUser(input: z.infer<typeof deleteUserSchema>) {
  const session = await auth();
  const actorRole = getCastedActorRole(session);
  const parsed = deleteUserSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (!actorRole || !canPerformAction(actorRole, 'users', 'delete')) {
    return { success: false, message: 'Anda tidak berwenang menonaktifkan akun.' };
  }

  const actorId = session.user.id;
  const targetUser = await prisma.user.findUnique({ where: { id: parsed.data.id } });
  if (!targetUser) {
    return { success: false, message: 'Akun tidak ditemukan.' };
  }

  if (targetUser.id === actorId) {
    return { success: false, message: 'Tidak dapat menonaktifkan akun sendiri.' };
  }

  const permission = canManageTargetRole(actorRole, targetUser.role as Role);
  if (!permission.allowed) {
    return { success: false, message: permission.message };
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.user.update({
        where: { id: parsed.data.id },
        data: {
          isActive: false,
          isLocked: false,
          lockedUntil: null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'DELETE',
          entity: 'User',
          entityId: current.id,
          description: `Menonaktifkan akun ${current.username}`,
        },
      });

      return current;
    });

    revalidatePath('/users');
    return { success: true, userId: updated.id };
  } catch (error) {
    console.error('Failed to deactivate user', error);
    return { success: false, message: 'Gagal menonaktifkan akun.' };
  }
}

export async function activateUser(input: z.infer<typeof activateUserSchema>) {
  const session = await auth();
  const actorRole = getCastedActorRole(session);
  const parsed = activateUserSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (!actorRole || !canPerformAction(actorRole, 'users', 'update')) {
    return { success: false, message: 'Anda tidak berwenang mengaktifkan akun.' };
  }

  const actorId = session.user.id;
  const targetUser = await prisma.user.findUnique({ where: { id: parsed.data.id } });
  if (!targetUser) {
    return { success: false, message: 'Akun tidak ditemukan.' };
  }

  const permission = canManageTargetRole(actorRole, targetUser.role as Role);
  if (!permission.allowed) {
    return { success: false, message: permission.message };
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.user.update({
        where: { id: parsed.data.id },
        data: {
          isActive: true,
          isLocked: false,
          lockedUntil: null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'UPDATE',
          entity: 'User',
          entityId: current.id,
          description: `Mengaktifkan akun ${current.username}`,
        },
      });

      return current;
    });

    revalidatePath('/users');
    return { success: true, userId: updated.id };
  } catch (error) {
    console.error('Failed to activate user', error);
    return { success: false, message: 'Gagal mengaktifkan akun.' };
  }
}

export async function resetPin(input: z.infer<typeof resetPinSchema>) {
  const result = await resetPinInternal({ userId: input.id });
  if (result.success) {
    revalidatePath('/users');
  }
  return result;
}

export async function unlockUser(input: z.infer<typeof unlockUserSchema>) {
  const result = await unlockUserInternal({ userId: input.id });
  if (result.success) {
    revalidatePath('/users');
  }
  return result;
}
