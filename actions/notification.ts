'use server';

import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const markReadSchema = z.object({
  id: z.string().min(1),
});

const createNotificationSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.string().optional(),
});

function getActorId(session: Awaited<ReturnType<typeof auth>>) {
  return session?.user?.id;
}

export async function getNotifications() {
  const session = await auth();
  const actorId = getActorId(session);

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: actorId },
    orderBy: { date: 'desc' },
    take: 10,
    select: { id: true, title: true, message: true, isRead: true, type: true, date: true },
  });

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

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

  return {
    success: true,
    message: 'Notifikasi ditandai sebagai dibaca.',
    data: { notificationId: parsed.data.id },
  };
}

export async function createNotification(input: z.infer<typeof createNotificationSchema>) {
  const session = await auth();
  const actorRole = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user?.id || !['OWNER', 'ADMIN_KLINIK', 'DOKTER'].includes(actorRole ?? '')) {
    return { success: false, message: 'Anda tidak berwenang membuat notifikasi.', data: null };
  }

  const parsed = createNotificationSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data notifikasi tidak valid.', data: null };
  }

  const notification = await prisma.notification.create({
    data: {
      userId: parsed.data.userId,
      title: parsed.data.title,
      message: parsed.data.message,
      type: parsed.data.type || null,
    },
  });

  return {
    success: true,
    message: 'Notifikasi berhasil dibuat.',
    data: { notification },
  };
}
