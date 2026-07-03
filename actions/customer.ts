'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createUser } from '@/actions/auth';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const customerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  notes: z.string().trim().max(300).optional().or(z.literal('')),
  createLogin: z.boolean().optional(),
  username: z.string().trim().min(3).max(30).regex(/^[a-z0-9_]+$/).optional(),
});

const updateCustomerSchema = customerSchema.extend({
  id: z.string().min(1),
});

const deleteCustomerSchema = z.object({
  id: z.string().min(1),
});

function getActorRole(session: Awaited<ReturnType<typeof auth>>) {
  return (session?.user as { role?: string } | undefined)?.role;
}

async function ensureStaffAccess(actorRole: string | undefined) {
  if (!actorRole) {
    return { allowed: false, message: 'Tidak terautentikasi.' };
  }

  if (actorRole === 'OWNER' || actorRole === 'ADMIN_KLINIK') {
    return { allowed: true };
  }

  return { allowed: false, message: 'Anda tidak berwenang mengelola data pelanggan.' };
}

async function buildUsername(name: string) {
  const seed = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'customer';
  let username = seed;
  let suffix = 1;

  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${seed}${suffix}`;
    suffix += 1;
  }

  return username;
}

async function findCustomerByPhone(phone: string, excludeId?: string) {
  if (!phone) {
    return null;
  }

  return prisma.customer.findFirst({
    where: {
      phone,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
}

export async function listCustomers() {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (actorRole === 'CUSTOMER') {
    const customer = await prisma.customer.findFirst({
      where: { userId: session.user.id },
      include: { pets: { select: { id: true, name: true } } },
    });
    return { success: true, customers: customer ? [customer] : [] };
  }

  const customers = await prisma.customer.findMany({
    orderBy: { name: 'asc' },
    include: {
      user: { select: { id: true, username: true, role: true, isActive: true } },
      pets: { select: { id: true, name: true } },
    },
  });

  return { success: true, customers };
}

export async function getCustomer(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (actorRole === 'CUSTOMER') {
    const customer = await prisma.customer.findFirst({
      where: { id, userId: session.user.id },
      include: { pets: true },
    });

    return customer ? { success: true, customer } : { success: false, message: 'Data tidak ditemukan.' };
  }

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { pets: true, user: { select: { username: true, role: true, isActive: true } } },
  });

  return customer ? { success: true, customer } : { success: false, message: 'Data tidak ditemukan.' };
}

export async function createCustomer(input: z.infer<typeof customerSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = customerSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  const permission = await ensureStaffAccess(actorRole);
  if (!permission.allowed) {
    return { success: false, message: permission.message };
  }

  if (parsed.data.phone) {
    const duplicate = await findCustomerByPhone(parsed.data.phone);
    if (duplicate) {
      return { success: false, message: 'Nomor telepon sudah dipakai pelanggan lain.' };
    }
  }

  let createdUserId: string | null = null;
  let temporaryPin: string | undefined;

  if (parsed.data.createLogin) {
    const username = parsed.data.username || (await buildUsername(parsed.data.name));
    const createResult = await createUser({
      username,
      name: parsed.data.name,
      role: 'CUSTOMER',
      phone: parsed.data.phone || '',
    });

    if (!createResult.success) {
      return { success: false, message: createResult.message };
    }

    createdUserId = createResult.userId ?? null;
    temporaryPin = createResult.temporaryPin;
  }

  const customer = await prisma.customer.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
      userId: createdUserId,
    },
  });

  revalidatePath('/customers');
  revalidatePath('/customers/[id]');
  return { success: true, customer, temporaryPin };
}

export async function updateCustomer(input: z.infer<typeof updateCustomerSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = updateCustomerSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  const permission = await ensureStaffAccess(actorRole);
  if (!permission.allowed) {
    return { success: false, message: permission.message };
  }

  const existing = await prisma.customer.findUnique({ where: { id: parsed.data.id } });
  if (!existing) {
    return { success: false, message: 'Data pelanggan tidak ditemukan.' };
  }

  if (parsed.data.phone) {
    const duplicate = await findCustomerByPhone(parsed.data.phone, parsed.data.id);
    if (duplicate) {
      return { success: false, message: 'Nomor telepon sudah dipakai pelanggan lain.' };
    }
  }

  const customer = await prisma.customer.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath('/customers');
  revalidatePath('/customers/[id]');
  return { success: true, customer };
}

export async function deleteCustomer(input: z.infer<typeof deleteCustomerSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = deleteCustomerSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  const permission = await ensureStaffAccess(actorRole);
  if (!permission.allowed) {
    return { success: false, message: permission.message };
  }

  const [petCount, appointmentCount, invoiceCount] = await Promise.all([
    prisma.pet.count({ where: { customerId: parsed.data.id } }),
    prisma.appointment.count({ where: { customerId: parsed.data.id } }),
    prisma.invoice.count({ where: { customerId: parsed.data.id } }),
  ]);

  if (petCount > 0 || appointmentCount > 0 || invoiceCount > 0) {
    return { success: false, message: 'Pelanggan ini masih memiliki data terkait (hewan, janji temu, atau invoice). Hapus data terkait terlebih dahulu.' };
  }

  await prisma.customer.delete({ where: { id: parsed.data.id } });
  revalidatePath('/customers');
  revalidatePath('/customers/[id]');
  return { success: true };
}
