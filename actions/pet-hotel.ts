'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createInvoice } from '@/actions/invoice';

const petHotelRoomSchema = z.object({
  name: z.string().trim().min(1, 'Nama kamar wajib diisi.').max(100),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE']).optional(),
});

const updatePetHotelRoomSchema = petHotelRoomSchema.extend({
  id: z.string().trim().min(1, 'Kamar tidak valid.'),
});

const petHotelBookingSchema = z.object({
  petId: z.string().trim().min(1, 'Hewan wajib dipilih.'),
  roomId: z.string().trim().optional().or(z.literal('')),
  checkInDate: z.string().trim().min(1, 'Tanggal check-in wajib diisi.'),
  checkOutDate: z.string().trim().min(1, 'Tanggal check-out wajib diisi.'),
  requestedByCustomer: z.boolean().optional(),
});

const updatePetHotelBookingSchema = petHotelBookingSchema.extend({
  id: z.string().trim().min(1, 'Reservasi tidak valid.'),
  status: z.enum(['BOOKED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED']).optional(),
});

const petHotelLogSchema = z.object({
  bookingId: z.string().trim().min(1, 'Reservasi wajib dipilih.'),
  type: z.enum(['FEEDING', 'MEDICINE', 'NOTE']),
  description: z.string().trim().min(1, 'Catatan wajib diisi.').max(500),
  photo: z.string().trim().optional().or(z.literal('')),
});

const HOTEL_DAILY_RATE = 100000;

function getActorRole(session: Awaited<ReturnType<typeof auth>>) {
  return (session?.user as { role?: string } | undefined)?.role;
}

function getActorId(session: Awaited<ReturnType<typeof auth>>) {
  return session?.user?.id;
}

function isStaff(role?: string) {
  return role === 'OWNER' || role === 'ADMIN_KLINIK';
}

function normalizeOptionalText(value: string | undefined | null) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getStartOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getDayCount(checkInDate: Date, checkOutDate: Date) {
  const diff = checkOutDate.getTime() - checkInDate.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

async function createAuditLog(userId: string, action: string, entity: string, entityId: string | null, description: string | null) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      description,
    },
  });
}

async function getCustomerForSession(sessionId: string) {
  return prisma.customer.findFirst({ where: { userId: sessionId } });
}

async function findConflictingBooking(roomId: string, checkInDate: Date, checkOutDate: Date, excludeId?: string) {
  return prisma.petHotelBooking.findFirst({
    where: {
      roomId,
      status: { in: ['BOOKED', 'CHECKED_IN'] },
      id: excludeId ? { not: excludeId } : undefined,
      checkInDate: { lt: checkOutDate },
      checkOutDate: { gt: checkInDate },
    },
    select: { id: true, status: true },
  });
}

// PET HOTEL ROOMS
export async function listPetHotelRooms() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || actorRole === 'CUSTOMER') {
    return { success: false, message: 'Anda tidak berwenang melihat data ini.' };
  }

  const rooms = await prisma.petHotelRoom.findMany({
    orderBy: { name: 'asc' },
    include: {
      bookings: {
        where: { status: { in: ['BOOKED', 'CHECKED_IN'] } },
        select: { id: true },
      },
    },
  });

  return { success: true, rooms };
}

export async function listPetHotelPets() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || !isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melihat daftar hewan.' };
  }

  const pets = await prisma.pet.findMany({
    orderBy: { name: 'asc' },
    include: { customer: { select: { id: true, name: true } } },
  });

  return { success: true, pets };
}

export async function createPetHotelRoom(input: z.infer<typeof petHotelRoomSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = petHotelRoomSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId || !isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang membuat kamar.' };
  }

  const room = await prisma.petHotelRoom.create({
    data: { name: parsed.data.name, status: parsed.data.status ?? 'AVAILABLE' },
  });

  await createAuditLog(actorId, 'CREATE', 'PetHotelRoom', room.id, `Membuat kamar ${room.name}`);
  revalidatePath('/pet-hotel');
  return { success: true, room };
}

export async function updatePetHotelRoom(input: z.infer<typeof updatePetHotelRoomSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = updatePetHotelRoomSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId || !isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang mengubah kamar.' };
  }

  const room = await prisma.petHotelRoom.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name, status: parsed.data.status ?? 'AVAILABLE' },
  });

  await createAuditLog(actorId, 'UPDATE', 'PetHotelRoom', room.id, `Memperbarui kamar ${room.name}`);
  revalidatePath('/pet-hotel');
  return { success: true, room };
}

export async function deletePetHotelRoom(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || actorRole !== 'OWNER') {
    return { success: false, message: 'Hanya Owner yang dapat menghapus kamar.' };
  }

  const room = await prisma.petHotelRoom.findUnique({ where: { id } });
  if (!room) {
    return { success: false, message: 'Kamar tidak ditemukan.' };
  }

  await prisma.petHotelRoom.delete({ where: { id } });
  await createAuditLog(actorId, 'DELETE', 'PetHotelRoom', room.id, `Menghapus kamar ${room.name}`);

  revalidatePath('/pet-hotel');
  return { success: true };
}

// PET HOTEL BOOKINGS
export async function listPetHotelBookings() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (actorRole === 'CUSTOMER') {
    const customer = await getCustomerForSession(actorId);
    if (!customer) {
      return { success: true, bookings: [] };
    }

    const bookings = await prisma.petHotelBooking.findMany({
      where: { pet: { customerId: customer.id } },
      orderBy: { checkInDate: 'desc' },
      include: {
        pet: { select: { id: true, name: true } },
        room: { select: { id: true, name: true } },
      },
    });

    return { success: true, bookings };
  }

  const bookings = await prisma.petHotelBooking.findMany({
    orderBy: { checkInDate: 'desc' },
    include: {
      pet: { select: { id: true, name: true, customer: { select: { id: true, name: true } } } },
      room: { select: { id: true, name: true } },
    },
  });

  return { success: true, bookings };
}

export async function createPetHotelBooking(input: z.infer<typeof petHotelBookingSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = petHotelBookingSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const checkInDate = new Date(parsed.data.checkInDate);
  const checkOutDate = new Date(parsed.data.checkOutDate);

  if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
    return { success: false, message: 'Tanggal tidak valid.' };
  }

  if (checkOutDate <= checkInDate) {
    return { success: false, message: 'Tanggal check-out harus setelah tanggal check-in.' };
  }

  if (getStartOfDay(checkInDate) < getStartOfDay(new Date())) {
    return { success: false, message: 'Tidak bisa membuat reservasi untuk tanggal yang sudah lewat.' };
  }

  const pet = await prisma.pet.findUnique({ where: { id: parsed.data.petId } });
  if (!pet) {
    return { success: false, message: 'Hewan tidak ditemukan.' };
  }

  if (actorRole === 'CUSTOMER') {
    const customer = await getCustomerForSession(actorId);
    if (!customer || pet.customerId !== customer.id) {
      return { success: false, message: 'Hewan yang dipilih tidak milik Anda.' };
    }
  } else if (!isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang membuat reservasi.' };
  }

  if (parsed.data.roomId) {
    const room = await prisma.petHotelRoom.findUnique({ where: { id: parsed.data.roomId } });
    if (!room) {
      return { success: false, message: 'Kamar tidak ditemukan.' };
    }
    if (room.status === 'MAINTENANCE') {
      return { success: false, message: 'Kamar sedang dalam pemeliharaan.' };
    }

    const conflict = await findConflictingBooking(room.id, checkInDate, checkOutDate);
    if (conflict) {
      return { success: false, message: 'Kamar sudah dipesan untuk rentang tanggal tersebut.' };
    }
  }

  const booking = await prisma.$transaction(async (tx) => {
    const createdBooking = await tx.petHotelBooking.create({
      data: {
        petId: parsed.data.petId,
        roomId: parsed.data.roomId || null,
        checkInDate,
        checkOutDate,
        status: 'BOOKED',
        requestedByCustomer: parsed.data.requestedByCustomer ?? false,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'CREATE',
        entity: 'PetHotelBooking',
        entityId: createdBooking.id,
        description: `Membuat reservasi hotel untuk ${pet.name}`,
      },
    });

    return createdBooking;
  });

  revalidatePath('/portal/pet-hotel');
  revalidatePath('/pet-hotel');
  return { success: true, booking };
}

export async function updatePetHotelBooking(input: z.infer<typeof updatePetHotelBookingSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = updatePetHotelBookingSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId || !isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang mengubah reservasi.' };
  }

  const existing = await prisma.petHotelBooking.findUnique({ where: { id: parsed.data.id } });
  if (!existing) {
    return { success: false, message: 'Reservasi tidak ditemukan.' };
  }

  if (existing.status !== 'BOOKED') {
    return { success: false, message: 'Hanya reservasi yang masih booked yang bisa diperbarui.' };
  }

  const checkInDate = new Date(parsed.data.checkInDate);
  const checkOutDate = new Date(parsed.data.checkOutDate);

  if (checkOutDate <= checkInDate) {
    return { success: false, message: 'Tanggal check-out harus setelah tanggal check-in.' };
  }

  if (parsed.data.roomId) {
    const room = await prisma.petHotelRoom.findUnique({ where: { id: parsed.data.roomId } });
    if (!room) {
      return { success: false, message: 'Kamar tidak ditemukan.' };
    }
    if (room.status === 'MAINTENANCE') {
      return { success: false, message: 'Kamar sedang dalam pemeliharaan.' };
    }

    const conflict = await findConflictingBooking(room.id, checkInDate, checkOutDate, existing.id);
    if (conflict) {
      return { success: false, message: 'Kamar sudah dipesan untuk rentang tanggal tersebut.' };
    }
  }

  const booking = await prisma.$transaction(async (tx) => {
    const updated = await tx.petHotelBooking.update({
      where: { id: parsed.data.id },
      data: {
        roomId: parsed.data.roomId || null,
        checkInDate,
        checkOutDate,
        status: parsed.data.status ?? 'BOOKED',
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'UPDATE',
        entity: 'PetHotelBooking',
        entityId: updated.id,
        description: `Memperbarui reservasi ${updated.id}`,
      },
    });

    return updated;
  });

  revalidatePath('/pet-hotel');
  return { success: true, booking };
}

export async function cancelPetHotelBooking(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const booking = await prisma.petHotelBooking.findUnique({
    where: { id },
    include: { pet: { select: { customerId: true, name: true } } },
  });

  if (!booking) {
    return { success: false, message: 'Reservasi tidak ditemukan.' };
  }

  if (actorRole === 'CUSTOMER') {
    const customer = await getCustomerForSession(actorId);
    if (!customer || booking.pet.customerId !== customer.id) {
      return { success: false, message: 'Anda tidak berwenang membatalkan reservasi ini.' };
    }
    if (booking.status !== 'BOOKED') {
      return { success: false, message: 'Hanya reservasi yang belum check-in yang bisa dibatalkan.' };
    }
  } else if (!isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang membatalkan reservasi.' };
  }

  if (booking.status !== 'BOOKED') {
    return { success: false, message: 'Hanya reservasi yang masih booked yang bisa dibatalkan.' };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.petHotelBooking.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'CANCEL',
        entity: 'PetHotelBooking',
        entityId: cancelled.id,
        description: `Membatalkan reservasi untuk ${booking.pet.name}`,
      },
    });

    return cancelled;
  });

  revalidatePath('/pet-hotel');
  revalidatePath('/portal/pet-hotel');
  return { success: true, booking: updated };
}

export async function checkInPetHotelBooking(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || !isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melakukan check-in.' };
  }

  const booking = await prisma.petHotelBooking.findUnique({
    where: { id },
    include: { pet: { select: { id: true, name: true } }, room: { select: { id: true, name: true, status: true } } },
  });

  if (!booking) {
    return { success: false, message: 'Reservasi tidak ditemukan.' };
  }

  if (booking.status !== 'BOOKED') {
    return { success: false, message: 'Reservasi ini tidak dalam status booked.' };
  }

  const roomId = booking.roomId ?? (await prisma.petHotelRoom.findFirst({ where: { status: 'AVAILABLE' }, orderBy: { name: 'asc' }, select: { id: true } }))?.id;
  if (!roomId) {
    return { success: false, message: 'Tidak ada kamar tersedia untuk check-in.' };
  }

  const room = await prisma.petHotelRoom.findUnique({ where: { id: roomId } });
  if (!room || room.status === 'MAINTENANCE') {
    return { success: false, message: 'Kamar yang dipilih tidak tersedia untuk check-in.' };
  }

  const conflict = await findConflictingBooking(room.id, booking.checkInDate, booking.checkOutDate, booking.id);
  if (conflict) {
    return { success: false, message: 'Kamar sudah ditempati untuk rentang tanggal tersebut.' };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const checkedIn = await tx.petHotelBooking.update({
      where: { id },
      data: { roomId, status: 'CHECKED_IN' },
    });

    await tx.petHotelRoom.update({
      where: { id: roomId },
      data: { status: 'OCCUPIED' },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'CHECK_IN',
        entity: 'PetHotelBooking',
        entityId: checkedIn.id,
        description: `Check-in hotel untuk ${booking.pet.name}`,
      },
    });

    return checkedIn;
  });

  revalidatePath('/pet-hotel');
  return { success: true, booking: updated };
}

export async function checkOutPetHotelBooking(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || !isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melakukan check-out.' };
  }

  const booking = await prisma.petHotelBooking.findUnique({
    where: { id },
    include: { pet: { select: { id: true, name: true, customerId: true } }, room: { select: { id: true, name: true } } },
  });

  if (!booking) {
    return { success: false, message: 'Reservasi tidak ditemukan.' };
  }

  if (booking.status !== 'CHECKED_IN') {
    return { success: false, message: 'Reservasi ini belum check-in.' };
  }

  const invoiceDays = getDayCount(booking.checkInDate, booking.checkOutDate);
  const updated = await prisma.$transaction(async (tx) => {
    const checkedOut = await tx.petHotelBooking.update({
      where: { id },
      data: { status: 'CHECKED_OUT' },
    });

    const otherCheckedInCount = await tx.petHotelBooking.count({
      where: { roomId: booking.roomId, status: 'CHECKED_IN', id: { not: id } },
    });

    if (booking.roomId) {
      await tx.petHotelRoom.update({
        where: { id: booking.roomId },
        data: { status: otherCheckedInCount > 0 ? 'OCCUPIED' : 'AVAILABLE' },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'CHECK_OUT',
        entity: 'PetHotelBooking',
        entityId: checkedOut.id,
        description: `Check-out hotel untuk ${booking.pet.name}`,
      },
    });

    return checkedOut;
  });

  await createInvoice({
    customerId: booking.pet.customerId,
    petId: booking.pet.id,
    items: [{ type: 'PET_HOTEL', description: `Penginapan ${booking.pet.name}`, qty: invoiceDays, price: HOTEL_DAILY_RATE }],
    notes: `Penginapan pet hotel untuk ${booking.pet.name}`,
  });

  revalidatePath('/pet-hotel');
  return { success: true, booking: updated };
}

// PET HOTEL LOGS
export async function createPetHotelLog(input: z.infer<typeof petHotelLogSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = petHotelLogSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId || !isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang membuat log.' };
  }

  const booking = await prisma.petHotelBooking.findUnique({ where: { id: parsed.data.bookingId } });
  if (!booking || booking.status === 'CANCELLED') {
    return { success: false, message: 'Reservasi tidak valid untuk pencatatan log.' };
  }

  const log = await prisma.$transaction(async (tx) => {
    const createdLog = await tx.petHotelLog.create({
      data: {
        bookingId: parsed.data.bookingId,
        type: parsed.data.type,
        description: parsed.data.description,
        photo: normalizeOptionalText(parsed.data.photo),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'LOG',
        entity: 'PetHotelLog',
        entityId: createdLog.id,
        description: `Menambahkan log ${parsed.data.type}`,
      },
    });

    return createdLog;
  });

  revalidatePath('/pet-hotel');
  return { success: true, log };
}

export async function listPetHotelLogs(bookingId: string) {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!actorRole) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const logs = await prisma.petHotelLog.findMany({
    where: { bookingId },
    orderBy: { date: 'desc' },
  });

  return { success: true, logs };
}

export async function getPetHotelSummary() {
  const occupiedRooms = await prisma.petHotelBooking.count({
    where: { status: 'CHECKED_IN' },
  });

  const totalRooms = await prisma.petHotelRoom.count();

  return { success: true, occupiedRooms, totalRooms };
}
