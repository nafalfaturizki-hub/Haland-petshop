'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createInvoice } from '@/actions/invoice';
import { createNotification } from '@/actions/notification';
import { auth } from '@/lib/auth';
import { prisma, createAuditLog, getCustomerForSession } from '@/lib/db';
import { isStaffRole } from '@/lib/permissions';
import { getActorRole, getActorId, normalizeOptionalText } from '@/lib/utils';

const petHotelRoomSchema = z.object({
  name: z.string().trim().min(1, 'Nama kamar wajib diisi.').max(100),
  roomNumber: z.string().trim().max(20).optional().or(z.literal('')),
  roomType: z.string().trim().max(50).optional().or(z.literal('')),
  capacity: z.coerce.number().int().min(1).max(10).optional(),
  status: z.enum(['AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE']).optional(),
  cleaningStatus: z.enum(['CLEAN', 'DIRTY', 'INSPECTION']).optional(),
  maintenanceStatus: z.enum(['OPERATIONAL', 'NEEDS_REPAIR', 'OUT_OF_SERVICE']).optional(),
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
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

const updatePetHotelBookingSchema = petHotelBookingSchema.extend({
  id: z.string().trim().min(1, 'Reservasi tidak valid.'),
  status: z.enum(['BOOKED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED']).optional(),
  petId: z.string().trim().min(1, 'Hewan wajib dipilih.').optional(),
});

const petHotelLogSchema = z.object({
  bookingId: z.string().trim().min(1, 'Reservasi wajib dipilih.'),
  type: z.enum(['FEEDING', 'MEDICINE', 'NOTE']),
  description: z.string().trim().min(1, 'Catatan wajib diisi.').max(500),
  photo: z.string().trim().optional().or(z.literal('')),
});

const HOTEL_DAILY_RATE = 100000;

type RoomStatus = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE';

function getStartOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getDayCount(checkInDate: Date, checkOutDate: Date) {
  const diff = checkOutDate.getTime() - checkInDate.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function generateBookingNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PH-${datePart}-${random}`;
}

async function notifyPetHotelChange(userId: string | null | undefined, title: string, message: string) {
  if (!userId) {
    return;
  }

  try {
    await createNotification({ userId, title, message, type: 'pet-hotel' });
  } catch {
    // ignore notification errors so booking flows stay resilient
  }
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

async function syncRoomStatus(roomId: string) {
  const room = await prisma.petHotelRoom.findUnique({ where: { id: roomId } });
  if (!room) {
    return;
  }

  if (room.status === 'MAINTENANCE' || room.status === 'INACTIVE' || room.maintenanceStatus === 'OUT_OF_SERVICE') {
    return;
  }

  const [activeBooking, upcomingBooking] = await Promise.all([
    prisma.petHotelBooking.findFirst({
      where: { roomId, status: 'CHECKED_IN' },
      select: { id: true },
    }),
    prisma.petHotelBooking.findFirst({
      where: { roomId, status: 'BOOKED' },
      select: { id: true },
    }),
  ]);

  const nextStatus: RoomStatus = activeBooking ? 'OCCUPIED' : upcomingBooking ? 'RESERVED' : 'AVAILABLE';
  if (room.status !== nextStatus) {
    await prisma.petHotelRoom.update({
      where: { id: roomId },
      data: { status: nextStatus },
    });
  }
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

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (actorRole === 'CUSTOMER') {
    const customer = await getCustomerForSession(actorId);
    if (!customer) {
      return { success: true, pets: [] };
    }

    const pets = await prisma.pet.findMany({
      where: { customerId: customer.id },
      orderBy: { name: 'asc' },
      include: { customer: { select: { id: true, name: true } } },
    });

    return { success: true, pets };
  }

  if (!isStaffRole(actorRole)) {
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

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang membuat kamar.' };
  }

  const room = await prisma.petHotelRoom.create({
    data: {
      name: parsed.data.name,
      roomNumber: normalizeOptionalText(parsed.data.roomNumber),
      roomType: normalizeOptionalText(parsed.data.roomType) ?? 'STANDARD',
      capacity: parsed.data.capacity ?? 1,
      status: parsed.data.status ?? 'AVAILABLE',
      cleaningStatus: parsed.data.cleaningStatus ?? 'CLEAN',
      maintenanceStatus: parsed.data.maintenanceStatus ?? 'OPERATIONAL',
    },
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

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang mengubah kamar.' };
  }

  const room = await prisma.petHotelRoom.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      roomNumber: normalizeOptionalText(parsed.data.roomNumber),
      roomType: normalizeOptionalText(parsed.data.roomType) ?? 'STANDARD',
      capacity: parsed.data.capacity ?? 1,
      status: parsed.data.status ?? 'AVAILABLE',
      cleaningStatus: parsed.data.cleaningStatus ?? 'CLEAN',
      maintenanceStatus: parsed.data.maintenanceStatus ?? 'OPERATIONAL',
    },
  });

  await createAuditLog(actorId, 'UPDATE', 'PetHotelRoom', room.id, `Memperbarui kamar ${room.name}`);
  await syncRoomStatus(room.id);
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

  const activeBooking = await prisma.petHotelBooking.findFirst({ where: { roomId: id, status: { in: ['BOOKED', 'CHECKED_IN'] } } });
  if (activeBooking) {
    return { success: false, message: 'Kamar masih memiliki reservasi aktif.' };
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

  const checkInDate = new Date(`${parsed.data.checkInDate}T00:00:00`);
  const checkOutDate = new Date(`${parsed.data.checkOutDate}T00:00:00`);

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
  } else if (!isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang membuat reservasi.' };
  }

  if (parsed.data.roomId) {
    const room = await prisma.petHotelRoom.findUnique({ where: { id: parsed.data.roomId } });
    if (!room) {
      return { success: false, message: 'Kamar tidak ditemukan.' };
    }
    if (room.status === 'MAINTENANCE' || room.status === 'INACTIVE' || room.maintenanceStatus === 'OUT_OF_SERVICE') {
      return { success: false, message: 'Kamar tidak tersedia untuk reservasi.' };
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
        bookingNumber: generateBookingNumber(),
        notes: normalizeOptionalText(parsed.data.notes),
      },
    });

    if (createdBooking.roomId) {
      await tx.petHotelRoom.update({
        where: { id: createdBooking.roomId },
        data: { status: 'RESERVED' },
      });
    }

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

  if (booking.roomId) {
    await syncRoomStatus(booking.roomId);
  }

  const customer = await prisma.customer.findFirst({ where: { id: pet.customerId }, select: { userId: true } });
  await notifyPetHotelChange(customer?.userId, 'Reservasi pet hotel dibuat', `Reservasi pet hotel untuk ${pet.name} berhasil dibuat.`);

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

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang mengubah reservasi.' };
  }

  const existing = await prisma.petHotelBooking.findUnique({ where: { id: parsed.data.id } });
  if (!existing) {
    return { success: false, message: 'Reservasi tidak ditemukan.' };
  }

  if (existing.status !== 'BOOKED') {
    return { success: false, message: 'Hanya reservasi yang masih booked yang bisa diperbarui.' };
  }

  const effectivePetId = parsed.data.petId ?? existing.petId;
  const pet = await prisma.pet.findUnique({ where: { id: effectivePetId } });
  if (!pet) {
    return { success: false, message: 'Hewan tidak ditemukan.' };
  }

  const checkInDate = new Date(`${parsed.data.checkInDate}T00:00:00`);
  const checkOutDate = new Date(`${parsed.data.checkOutDate}T00:00:00`);

  if (checkOutDate <= checkInDate) {
    return { success: false, message: 'Tanggal check-out harus setelah tanggal check-in.' };
  }

  if (parsed.data.roomId) {
    const room = await prisma.petHotelRoom.findUnique({ where: { id: parsed.data.roomId } });
    if (!room) {
      return { success: false, message: 'Kamar tidak ditemukan.' };
    }
    if (room.status === 'MAINTENANCE' || room.status === 'INACTIVE' || room.maintenanceStatus === 'OUT_OF_SERVICE') {
      return { success: false, message: 'Kamar tidak tersedia untuk reservasi.' };
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
        petId: effectivePetId,
        roomId: parsed.data.roomId || null,
        checkInDate,
        checkOutDate,
        status: parsed.data.status ?? 'BOOKED',
        notes: normalizeOptionalText(parsed.data.notes),
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

  if (existing.roomId) {
    await syncRoomStatus(existing.roomId);
  }
  if (booking.roomId) {
    await syncRoomStatus(booking.roomId);
  }

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
  } else if (!isStaffRole(actorRole)) {
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

  if (booking.roomId) {
    await syncRoomStatus(booking.roomId);
  }

  revalidatePath('/pet-hotel');
  revalidatePath('/portal/pet-hotel');
  return { success: true, booking: updated };
}

export async function deletePetHotelBooking(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang menghapus reservasi.' };
  }

  const booking = await prisma.petHotelBooking.findUnique({ where: { id } });
  if (!booking) {
    return { success: false, message: 'Reservasi tidak ditemukan.' };
  }

  if (booking.status === 'CHECKED_IN' || booking.status === 'CHECKED_OUT') {
    return { success: false, message: 'Reservasi yang sudah check-in atau check-out tidak bisa dihapus.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.petHotelBooking.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'DELETE',
        entity: 'PetHotelBooking',
        entityId: id,
        description: 'Menghapus reservasi pet hotel',
      },
    });
  });

  if (booking.roomId) {
    await syncRoomStatus(booking.roomId);
  }

  revalidatePath('/pet-hotel');
  revalidatePath('/portal/pet-hotel');
  return { success: true };
}

export async function checkInPetHotelBooking(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melakukan check-in.' };
  }

  const booking = await prisma.petHotelBooking.findUnique({
    where: { id },
    include: {
      pet: { select: { id: true, name: true, customerId: true } },
      room: { select: { id: true, name: true, status: true, maintenanceStatus: true } },
    },
  });

  if (!booking) {
    return { success: false, message: 'Reservasi tidak ditemukan.' };
  }

  if (booking.status !== 'BOOKED') {
    return { success: false, message: 'Reservasi ini tidak dalam status booked.' };
  }

  let roomId: string | null = booking.roomId;
  if (!roomId) {
    const fallbackRoom = await prisma.petHotelRoom.findFirst({
      where: {
        status: { in: ['AVAILABLE', 'RESERVED'] },
        maintenanceStatus: { not: 'OUT_OF_SERVICE' },
      },
      orderBy: { name: 'asc' },
      select: { id: true },
    });
    roomId = fallbackRoom?.id ?? null;
  }

  if (!roomId) {
    return { success: false, message: 'Tidak ada kamar tersedia untuk check-in.' };
  }

  const room = await prisma.petHotelRoom.findUnique({ where: { id: roomId } });
  if (!room || room.status === 'MAINTENANCE' || room.status === 'INACTIVE' || room.maintenanceStatus === 'OUT_OF_SERVICE') {
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

  await syncRoomStatus(roomId);
  const customer = await prisma.customer.findFirst({ where: { id: booking.pet.customerId }, select: { userId: true } });
  await notifyPetHotelChange(customer?.userId, 'Check-in pet hotel', `Status reservasi ${booking.id} telah berubah menjadi check-in.`);
  revalidatePath('/pet-hotel');
  return { success: true, booking: updated };
}

export async function checkOutPetHotelBooking(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || !isStaffRole(actorRole)) {
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

    if (booking.roomId) {
      await tx.petHotelRoom.update({
        where: { id: booking.roomId },
        data: { status: 'AVAILABLE' },
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

  if (booking.roomId) {
    await syncRoomStatus(booking.roomId);
  }

  const customer = await prisma.customer.findFirst({ where: { id: booking.pet.customerId }, select: { userId: true } });
  await notifyPetHotelChange(customer?.userId, 'Check-out pet hotel', `Reservasi pet hotel untuk ${booking.pet.name} telah selesai.`);

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

  if (!actorId || !isStaffRole(actorRole)) {
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
