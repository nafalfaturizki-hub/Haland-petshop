'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma, getCustomerForSession } from '@/lib/db';
import { getActorRole } from '@/lib/utils';

const petSchema = z.object({
  customerId: z.string().trim().min(1, 'Pilih pemilik terlebih dahulu.'),
  name: z.string().trim().min(2, 'Nama hewan minimal 2 karakter.').max(80),
  species: z.string().trim().min(2, 'Spesies wajib diisi.').max(60),
  breed: z.string().trim().max(60).optional().or(z.literal('')),
  birthDate: z.string().trim().optional().or(z.literal('')),
  gender: z.string().trim().max(20).optional().or(z.literal('')),
  photo: z.string().trim().max(200).optional().or(z.literal('')),
  weight: z.coerce.number().positive().optional(),
});

const updatePetSchema = petSchema.extend({
  id: z.string().min(1),
});

const deletePetSchema = z.object({
  id: z.string().min(1),
});

async function ensureAccess(actorRole: string | undefined) {
  if (!actorRole) {
    return { allowed: false, message: 'Tidak terautentikasi.' };
  }

  if (actorRole === 'OWNER' || actorRole === 'ADMIN_KLINIK' || actorRole === 'DOKTER') {
    return { allowed: true };
  }

  return { allowed: false, message: 'Anda tidak berwenang mengelola data hewan.' };
}

async function ensureCustomerExists(customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  return customer;
}

async function ensureUniqueName(customerId: string, name: string, excludeId?: string) {
  const existing = await prisma.pet.findFirst({
    where: {
      customerId,
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });

  return existing;
}

async function createWeightLog(petId: string, weight: number) {
  await prisma.petWeightLog.create({
    data: {
      petId,
      weight,
      date: new Date(),
    },
  });
}

export async function listPets() {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (actorRole === 'CUSTOMER') {
    const customer = await getCustomerForSession(session.user.id);
    if (!customer) return { success: true, pets: [] };

    const pets = await prisma.pet.findMany({
      where: { customerId: customer.id },
      orderBy: { name: 'asc' },
      include: { customer: { select: { id: true, name: true } } },
    });
    return { success: true, pets };
  }

  const pets = await prisma.pet.findMany({
    orderBy: { name: 'asc' },
    include: { customer: { select: { id: true, name: true } } },
  });

  return { success: true, pets };
}

export async function getPet(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (actorRole === 'CUSTOMER') {
    const customer = await getCustomerForSession(session.user.id);
    if (!customer) return { success: false, message: 'Data tidak ditemukan.' };

    const pet = await prisma.pet.findFirst({
      where: { id, customerId: customer.id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        weightLogs: { orderBy: { date: 'asc' } },
        vaccineRecords: { orderBy: { date: 'asc' } },
        diseaseRecords: { orderBy: { date: 'asc' } },
        allergies: { orderBy: { id: 'asc' } },
        appointments: { select: { id: true, date: true, status: true } },
        medicalRecords: { select: { id: true, diagnosis: true, date: true } },
      },
    });
    return pet ? { success: true, pet } : { success: false, message: 'Data tidak ditemukan.' };
  }

  const pet = await prisma.pet.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      weightLogs: { orderBy: { date: 'asc' } },
      vaccineRecords: { orderBy: { date: 'asc' } },
      diseaseRecords: { orderBy: { date: 'asc' } },
      allergies: { orderBy: { id: 'asc' } },
      appointments: { select: { id: true, date: true, status: true } },
      medicalRecords: { select: { id: true, diagnosis: true, date: true } },
    },
  });

  return pet ? { success: true, pet } : { success: false, message: 'Data tidak ditemukan.' };
}

export async function createPet(input: z.infer<typeof petSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = petSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  const permission = await ensureAccess(actorRole);
  if (!permission.allowed) {
    return { success: false, message: permission.message };
  }

  const customer = await ensureCustomerExists(parsed.data.customerId);
  if (!customer) {
    return { success: false, message: 'Pemilik hewan tidak ditemukan.' };
  }

  const duplicate = await ensureUniqueName(parsed.data.customerId, parsed.data.name);
  if (duplicate) {
    return { success: false, message: 'Nama hewan sudah ada untuk pemilik ini.' };
  }

  const birthDate = parsed.data.birthDate ? new Date(parsed.data.birthDate) : null;
  if (parsed.data.birthDate && Number.isNaN(birthDate?.getTime())) {
    return { success: false, message: 'Tanggal lahir tidak valid.' };
  }

  const pet = await prisma.pet.create({
    data: {
      customerId: parsed.data.customerId,
      name: parsed.data.name,
      species: parsed.data.species,
      breed: parsed.data.breed || null,
      birthDate,
      gender: parsed.data.gender || null,
      photo: parsed.data.photo || null,
    },
  });

  if (parsed.data.weight && parsed.data.weight > 0) {
    await createWeightLog(pet.id, parsed.data.weight);
  }

  revalidatePath('/pets');
  revalidatePath('/pets/[id]');
  revalidatePath('/portal/pets');
  return { success: true, pet };
}

export async function updatePet(input: z.infer<typeof updatePetSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = updatePetSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  const permission = await ensureAccess(actorRole);
  if (!permission.allowed) {
    return { success: false, message: permission.message };
  }

  const existing = await prisma.pet.findUnique({ where: { id: parsed.data.id } });
  if (!existing) {
    return { success: false, message: 'Data hewan tidak ditemukan.' };
  }

  const customer = await ensureCustomerExists(parsed.data.customerId);
  if (!customer) {
    return { success: false, message: 'Pemilik hewan tidak ditemukan.' };
  }

  const duplicate = await ensureUniqueName(parsed.data.customerId, parsed.data.name, parsed.data.id);
  if (duplicate) {
    return { success: false, message: 'Nama hewan sudah ada untuk pemilik ini.' };
  }

  const birthDate = parsed.data.birthDate ? new Date(parsed.data.birthDate) : null;
  if (parsed.data.birthDate && Number.isNaN(birthDate?.getTime())) {
    return { success: false, message: 'Tanggal lahir tidak valid.' };
  }

  const pet = await prisma.pet.update({
    where: { id: parsed.data.id },
    data: {
      customerId: parsed.data.customerId,
      name: parsed.data.name,
      species: parsed.data.species,
      breed: parsed.data.breed || null,
      birthDate,
      gender: parsed.data.gender || null,
      photo: parsed.data.photo || null,
    },
  });

  if (parsed.data.weight && parsed.data.weight > 0) {
    await createWeightLog(pet.id, parsed.data.weight);
  }

  revalidatePath('/pets');
  revalidatePath('/pets/[id]');
  revalidatePath('/portal/pets');
  return { success: true, pet };
}

export async function deletePet(input: z.infer<typeof deletePetSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = deletePetSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  const permission = await ensureAccess(actorRole);
  if (!permission.allowed) {
    return { success: false, message: permission.message };
  }

  const [appointmentCount, medicalRecordCount, hotelBookingCount] = await Promise.all([
    prisma.appointment.count({ where: { petId: parsed.data.id } }),
    prisma.medicalRecord.count({ where: { petId: parsed.data.id } }),
    prisma.petHotelBooking.count({ where: { petId: parsed.data.id } }),
  ]);

  if (appointmentCount > 0 || medicalRecordCount > 0 || hotelBookingCount > 0) {
    return { success: false, message: 'Hewan ini masih memiliki data terkait, hapus riwayat terlebih dahulu.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.petWeightLog.deleteMany({ where: { petId: parsed.data.id } });
    await tx.petVaccineRecord.deleteMany({ where: { petId: parsed.data.id } });
    await tx.petDiseaseRecord.deleteMany({ where: { petId: parsed.data.id } });
    await tx.petAllergy.deleteMany({ where: { petId: parsed.data.id } });
    await tx.pet.delete({ where: { id: parsed.data.id } });
  });

  revalidatePath('/pets');
  revalidatePath('/pets/[id]');
  revalidatePath('/portal/pets');
  return { success: true };
}
