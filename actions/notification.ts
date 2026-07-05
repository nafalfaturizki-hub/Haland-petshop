'use server';

import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma, createAuditLog } from '@/lib/db';
import { getActorId } from '@/lib/utils';

const markReadSchema = z.object({
  id: z.string().min(1),
});

const createNotificationSchema = z.object({
  userId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(500),
  type: z.string().trim().max(40).optional().or(z.literal('')),
});

const deleteNotificationSchema = z.object({
  id: z.string().min(1),
});

export async function getNotifications() {
  const session = await auth();
  const actorId = getActorId(session);

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: actorId },
      orderBy: { date: 'desc' },
      take: 20,
      select: { id: true, title: true, message: true, isRead: true, type: true, date: true },
    }),
    prisma.notification.count({ where: { userId: actorId, isRead: false } }),
  ]);

  return {
    success: true,
    message: 'Notifikasi berhasil dimuat.',
    data: { notifications, unreadCount },
  };
}

export async function markNotificationRead(input: z.infer<typeof markReadSchema>) {
  const session = await auth();
  const actorId = getActorId(session);
  const parsed = markReadSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.', data: null };
  }

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  const notification = await prisma.notification.updateMany({
    where: { id: parsed.data.id, userId: actorId },
    data: { isRead: true },
  });

  if (notification.count === 0) {
    return { success: false, message: 'Notifikasi tidak ditemukan.', data: null };
  }

  await createAuditLog(actorId, 'MARK_READ', 'Notification', parsed.data.id, 'Notifikasi ditandai dibaca oleh pengguna.');

  return {
    success: true,
    message: 'Notifikasi ditandai sebagai dibaca.',
    data: { notificationId: parsed.data.id },
  };
}

export async function markAllNotificationsRead() {
  const session = await auth();
  const actorId = getActorId(session);

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  const result = await prisma.notification.updateMany({
    where: { userId: actorId, isRead: false },
    data: { isRead: true },
  });

  if (result.count > 0) {
    await createAuditLog(actorId, 'MARK_ALL_READ', 'Notification', null, 'Semua notifikasi ditandai dibaca.');
  }

  return {
    success: true,
    message: 'Semua notifikasi telah dibaca.',
    data: { updatedCount: result.count },
  };
}

export async function deleteNotification(input: z.infer<typeof deleteNotificationSchema>) {
  const session = await auth();
  const actorId = getActorId(session);
  const parsed = deleteNotificationSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.', data: null };
  }

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  const deleted = await prisma.notification.deleteMany({ where: { id: parsed.data.id, userId: actorId } });
  if (deleted.count === 0) {
    return { success: false, message: 'Notifikasi tidak ditemukan.', data: null };
  }

  await createAuditLog(actorId, 'DELETE', 'Notification', parsed.data.id, 'Notifikasi dihapus oleh pengguna.');

  return {
    success: true,
    message: 'Notifikasi berhasil dihapus.',
    data: { notificationId: parsed.data.id },
  };
}

export async function createNotification(input: z.infer<typeof createNotificationSchema>) {
  const session = await auth();
  const actorId = session?.user?.id;
  const actorRole = (session?.user as { role?: string } | undefined)?.role;

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  const canCreateForSelf = input.userId === actorId;
  const canCreateForOthers = ['OWNER', 'ADMIN_KLINIK', 'DOKTER'].includes(actorRole ?? '');

  if (!canCreateForSelf && !canCreateForOthers) {
    return { success: false, message: 'Anda tidak berwenang membuat notifikasi.', data: null };
  }

  const parsed = createNotificationSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data notifikasi tidak valid.', data: null };
  }

  const targetUser = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!targetUser) {
    return { success: false, message: 'Pengguna target tidak ditemukan.', data: null };
  }

  const notification = await prisma.notification.create({
    data: {
      userId: parsed.data.userId,
      title: parsed.data.title,
      message: parsed.data.message,
      type: parsed.data.type?.trim() || null,
    },
  });

  await createAuditLog(actorId, 'CREATE', 'Notification', notification.id, `Notifikasi dibuat untuk ${targetUser.name}.`);

  return {
    success: true,
    message: 'Notifikasi berhasil dibuat.',
    data: { notification },
  };
}
