'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createNotification } from '@/actions/notification';
import { auth } from '@/lib/auth';
import { prisma, getCustomerForSession } from '@/lib/db';
import { getActorRole, getActorId } from '@/lib/utils';

const appointmentSchema = z.object({
  petId: z.string().min(1, 'Pilih hewan terlebih dahulu.'),
  customerId: z.string().optional(),
  doctorId: z.string().optional().or(z.literal('')),
  date: z.string().min(1, 'Pilih tanggal dan waktu.'),
  queueNumber: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(['WAITING', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
  requestedByCustomer: z.boolean().optional(),
});

const updateAppointmentSchema = z.object({
  id: z.string().min(1),
  petId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  doctorId: z.string().optional(),
  date: z.string().min(1).optional(),
  queueNumber: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(['WAITING', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
  requestedByCustomer: z.boolean().optional(),
});

const cancelAppointmentSchema = z.object({
  id: z.string().min(1),
});

async function notifyAppointmentChange(userId: string | null | undefined, title: string, message: string) {
  if (!userId) {
    return;
  }

  try {
    await createNotification({ userId, title, message, type: 'appointment' });
  } catch {
    // ignore notification errors so the appointment workflow remains resilient
  }
}

async function validateAppointmentTime(date: Date) {
  const appointmentDate = new Date(date);
  if (Number.isNaN(appointmentDate.getTime())) {
    return { allowed: false, message: 'Tanggal tidak valid.' };
  }

  if (appointmentDate < new Date()) {
    return { allowed: false, message: 'Tidak bisa membuat jadwal di masa lalu.' };
  }

  const hour = appointmentDate.getHours();
  if (hour < 8 || hour >= 17) {
    return { allowed: false, message: 'Jam layanan hanya tersedia dari pukul 08.00 sampai 17.00.' };
  }

  return { allowed: true };
}

async function findDoctorConflict(doctorId: string | null | undefined, date: Date, excludeId?: string) {
  if (!doctorId) {
    return null;
  }

  return prisma.appointment.findFirst({
    where: {
      doctorId,
      date,
      status: { not: 'CANCELLED' },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
}

export async function listAppointmentLookups() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  const petsQuery = actorRole === 'CUSTOMER'
    ? prisma.pet.findMany({
        where: { customer: { userId: actorId } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, species: true, customer: { select: { id: true, name: true } } },
      })
    : prisma.pet.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, species: true, customer: { select: { id: true, name: true } } },
      });

  const customersQuery = actorRole === 'CUSTOMER'
    ? prisma.customer.findMany({ where: { userId: actorId }, orderBy: { name: 'asc' }, select: { id: true, name: true } })
    : prisma.customer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });

  const [pets, customers, doctors] = await Promise.all([
    petsQuery,
    customersQuery,
    prisma.user.findMany({ where: { role: 'DOKTER' }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return { success: true, pets, customers, doctors };
}

export async function listAppointments() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (actorRole === 'CUSTOMER') {
    const customer = await getCustomerForSession(actorId);
    if (!customer) {
      return { success: true, appointments: [] };
    }

    const appointments = await prisma.appointment.findMany({
      where: { customerId: customer.id },
      orderBy: { date: 'asc' },
      include: { pet: { select: { id: true, name: true, species: true } }, doctor: { select: { id: true, name: true } }, customer: { select: { id: true, name: true } } },
    });

    return { success: true, appointments };
  }

  const queryOptions: any = {
    orderBy: { date: 'asc' },
    include: { pet: { select: { id: true, name: true, species: true } }, doctor: { select: { id: true, name: true } }, customer: { select: { id: true, name: true } } },
  };

  if (actorRole === 'DOKTER') {
    queryOptions.where = { OR: [{ doctorId: null }, { doctorId: actorId }] };
  }

  const appointments = await prisma.appointment.findMany(queryOptions);

  return { success: true, appointments };
}

export async function getAppointment(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { pet: { select: { id: true, name: true, species: true } }, doctor: { select: { id: true, name: true } }, customer: { select: { id: true, name: true } } },
  });

  if (!appointment) {
    return { success: false, message: 'Jadwal tidak ditemukan.' };
  }

  if (actorRole === 'CUSTOMER') {
    const customer = await getCustomerForSession(actorId);
    if (!customer || appointment.customerId !== customer.id) {
      return { success: false, message: 'Anda tidak berwenang melihat data ini.' };
    }
  }

  return { success: true, appointment };
}

export async function createAppointment(input: z.infer<typeof appointmentSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = appointmentSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (actorRole === 'CUSTOMER') {
    const customer = await getCustomerForSession(actorId);
    if (!customer) {
      return { success: false, message: 'Data pelanggan belum terhubung ke akun Anda.' };
    }

    const pet = await prisma.pet.findFirst({ where: { id: parsed.data.petId, customerId: customer.id } });
    if (!pet) {
      return { success: false, message: 'Hewan yang dipilih tidak milik Anda.' };
    }

    const timeValidation = await validateAppointmentTime(new Date(parsed.data.date));
    if (!timeValidation.allowed) {
      return { success: false, message: timeValidation.message };
    }

    const doctorConflict = await findDoctorConflict(parsed.data.doctorId || null, new Date(parsed.data.date));
    if (doctorConflict) {
      return { success: false, message: 'Dokter sudah memiliki jadwal pada waktu yang dipilih.' };
    }

    const appointment = await prisma.appointment.create({
      data: {
        petId: parsed.data.petId,
        customerId: customer.id,
        doctorId: parsed.data.doctorId || null,
        date: new Date(parsed.data.date),
        queueNumber: parsed.data.queueNumber ?? null,
        status: 'WAITING',
        requestedByCustomer: true,
      },
    });

    await notifyAppointmentChange(actorId, 'Jadwal dibuat', `Jadwal pemeriksaan untuk ${pet.name} berhasil dibuat.`);

    revalidatePath('/portal/appointments');
    revalidatePath('/appointments');
    return { success: true, appointment };
  }

  if (actorRole !== 'OWNER' && actorRole !== 'ADMIN_KLINIK') {
    return { success: false, message: 'Anda tidak berwenang membuat jadwal.' };
  }

  if (!parsed.data.customerId) {
    return { success: false, message: 'Pilih pelanggan untuk membuat jadwal.' };
  }

  const pet = await prisma.pet.findFirst({ where: { id: parsed.data.petId, customerId: parsed.data.customerId } });
  if (!pet) {
    return { success: false, message: 'Hewan yang dipilih tidak cocok dengan pelanggan.' };
  }

  const timeValidation = await validateAppointmentTime(new Date(parsed.data.date));
  if (!timeValidation.allowed) {
    return { success: false, message: timeValidation.message };
  }

  const doctorConflict = await findDoctorConflict(parsed.data.doctorId || null, new Date(parsed.data.date));
  if (doctorConflict) {
    return { success: false, message: 'Dokter sudah memiliki jadwal pada waktu yang dipilih.' };
  }

  const appointment = await prisma.appointment.create({
    data: {
      petId: parsed.data.petId,
      customerId: parsed.data.customerId,
      doctorId: parsed.data.doctorId || null,
      date: new Date(parsed.data.date),
      queueNumber: parsed.data.queueNumber ?? null,
      status: parsed.data.status ?? 'WAITING',
      requestedByCustomer: parsed.data.requestedByCustomer ?? false,
    },
  });

  const customerUser = await prisma.customer.findUnique({ where: { id: parsed.data.customerId }, select: { userId: true } });
  await notifyAppointmentChange(customerUser?.userId, 'Jadwal dibuat', `Jadwal pemeriksaan untuk ${pet.name} berhasil dibuat.`);

  revalidatePath('/appointments');
  revalidatePath('/dashboard');
  return { success: true, appointment };
}

export async function updateAppointment(input: z.infer<typeof updateAppointmentSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = updateAppointmentSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const existing = await prisma.appointment.findUnique({ where: { id: parsed.data.id } });
  if (!existing) {
    return { success: false, message: 'Jadwal tidak ditemukan.' };
  }

  if (actorRole === 'CUSTOMER') {
    return { success: false, message: 'Customer tidak dapat mengubah jadwal.' };
  }

  if (actorRole === 'DOKTER') {
    if (existing.doctorId !== actorId) {
      return { success: false, message: 'Anda hanya bisa mengubah status jadwal yang ditugaskan ke Anda.' };
    }

    const allowedStatuses = ['WAITING', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;
    if (parsed.data.status && !allowedStatuses.includes(parsed.data.status as (typeof allowedStatuses)[number])) {
      return { success: false, message: 'Status tidak valid.' };
    }

    const appointment = await prisma.appointment.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status ?? existing.status },
    });

    const customerUser = await prisma.customer.findUnique({ where: { id: existing.customerId }, select: { userId: true } });
    const petRecord = await prisma.pet.findUnique({ where: { id: existing.petId }, select: { name: true } });
    await notifyAppointmentChange(customerUser?.userId, 'Status jadwal diperbarui', `Status jadwal untuk ${petRecord?.name ?? 'hewan Anda'} telah diperbarui.`);

    revalidatePath('/appointments');
    revalidatePath('/dashboard');
    return { success: true, appointment };
  }

  if (parsed.data.date) {
    const timeValidation = await validateAppointmentTime(new Date(parsed.data.date));
    if (!timeValidation.allowed) {
      return { success: false, message: timeValidation.message };
    }
  }

  if (parsed.data.doctorId !== undefined || parsed.data.date) {
    const doctorConflict = await findDoctorConflict(parsed.data.doctorId ?? existing.doctorId, parsed.data.date ? new Date(parsed.data.date) : existing.date, parsed.data.id);
    if (doctorConflict) {
      return { success: false, message: 'Dokter sudah memiliki jadwal pada waktu yang dipilih.' };
    }
  }

  const appointment = await prisma.appointment.update({
    where: { id: parsed.data.id },
    data: {
      petId: parsed.data.petId ?? existing.petId,
      customerId: parsed.data.customerId ?? existing.customerId,
      doctorId: parsed.data.doctorId || null,
      date: parsed.data.date ? new Date(parsed.data.date) : existing.date,
      queueNumber: parsed.data.queueNumber ?? existing.queueNumber,
      status: parsed.data.status ?? existing.status,
      requestedByCustomer: parsed.data.requestedByCustomer ?? existing.requestedByCustomer,
    },
  });

  const customerUser = await prisma.customer.findUnique({ where: { id: appointment.customerId }, select: { userId: true } });
  const petRecord = await prisma.pet.findUnique({ where: { id: appointment.petId }, select: { name: true } });
  await notifyAppointmentChange(customerUser?.userId, 'Jadwal diperbarui', `Jadwal pemeriksaan untuk ${petRecord?.name ?? 'hewan Anda'} telah diperbarui.`);

  revalidatePath('/appointments');
  revalidatePath('/dashboard');
  return { success: true, appointment };
}

export async function cancelAppointment(input: z.infer<typeof cancelAppointmentSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = cancelAppointmentSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const existing = await prisma.appointment.findUnique({ where: { id: parsed.data.id } });
  if (!existing) {
    return { success: false, message: 'Jadwal tidak ditemukan.' };
  }

  if (actorRole === 'CUSTOMER') {
    const customer = await getCustomerForSession(actorId);
    if (!customer || existing.customerId !== customer.id) {
      return { success: false, message: 'Anda tidak berwenang membatalkan jadwal ini.' };
    }
    if (existing.status === 'DONE' || existing.status === 'CANCELLED' || existing.status === 'IN_PROGRESS') {
      return { success: false, message: 'Jadwal yang sedang berjalan tidak bisa dibatalkan.' };
    }
  }

  if (actorRole === 'DOKTER') {
    return { success: false, message: 'Dokter tidak dapat membatalkan jadwal.' };
  }

  if (existing.status === 'DONE' || existing.status === 'CANCELLED' || existing.status === 'IN_PROGRESS') {
    return { success: false, message: 'Jadwal yang sedang berjalan tidak bisa dibatalkan.' };
  }

  const appointment = await prisma.appointment.update({
    where: { id: parsed.data.id },
    data: { status: 'CANCELLED' },
  });

  const customerUser = await prisma.customer.findUnique({ where: { id: existing.customerId }, select: { userId: true } });
  const petRecord = await prisma.pet.findUnique({ where: { id: existing.petId }, select: { name: true } });
  await notifyAppointmentChange(customerUser?.userId, 'Jadwal dibatalkan', `Jadwal pemeriksaan untuk ${petRecord?.name ?? 'hewan Anda'} dibatalkan.`);

  revalidatePath('/appointments');
  revalidatePath('/portal/appointments');
  return { success: true, appointment };
}

export async function getAppointmentSummary() {
  const session = await auth();
  const actorId = getActorId(session);

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const appointmentsToday = await prisma.appointment.count({
    where: { date: { gte: start, lt: end } },
  });

  return { success: true, appointmentsToday };
}

export async function getPortalAppointmentSummary() {
  const session = await auth();
  const actorId = getActorId(session);

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const customer = await getCustomerForSession(actorId);
  if (!customer) {
    return { success: true, upcomingAppointments: 0 };
  }

  const count = await prisma.appointment.count({
    where: {
      customerId: customer.id,
      date: { gte: new Date() },
      status: { not: 'CANCELLED' },
    },
  });

  return { success: true, upcomingAppointments: count };
}
