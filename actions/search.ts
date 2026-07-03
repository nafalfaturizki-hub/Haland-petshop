'use server';

import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const searchSchema = z.object({
  query: z.string().trim().min(1),
});

function getActorRole(session: Awaited<ReturnType<typeof auth>>) {
  return (session?.user as { role?: string } | undefined)?.role;
}

function getActorId(session: Awaited<ReturnType<typeof auth>>) {
  return session?.user?.id;
}

function isStaff(role?: string) {
  return role === 'OWNER' || role === 'ADMIN_KLINIK' || role === 'DOKTER';
}

function isDoctor(role?: string) {
  return role === 'DOKTER';
}

export async function searchGlobal(input: z.infer<typeof searchSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = searchSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Query pencarian tidak valid.', data: null };
  }

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  if (!isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melakukan pencarian global.', data: null };
  }

  const q = parsed.data.query;
  const customerFilter = {
    OR: [
      { name: { contains: q } },
      { phone: { contains: q } },
    ],
  };

  const petFilter = {
    OR: [
      { name: { contains: q } },
      { species: { contains: q } },
      { breed: { contains: q } },
    ],
  };

  const appointmentFilter = {
    OR: [
      { pet: { is: { name: { contains: q } } } },
      { customer: { is: { name: { contains: q } } } },
    ],
  };

  const invoiceFilter = {
    OR: [
      { invoiceNumber: { contains: q } },
      { customer: { is: { name: { contains: q } } } },
    ],
  };

  const productFilter = {
    OR: [
      { name: { contains: q } },
      { sku: { contains: q } },
      { barcode: { contains: q } },
    ],
  };

  const customers = await prisma.customer.findMany({
    where: isDoctor(actorRole)
      ? { AND: [customerFilter, { appointments: { some: { doctorId: actorId } } }] }
      : customerFilter,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, phone: true },
    take: 5,
  });

  const pets = await prisma.pet.findMany({
    where: isDoctor(actorRole)
      ? { AND: [petFilter, { customer: { appointments: { some: { doctorId: actorId } } } }] }
      : petFilter,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, species: true, customer: { select: { name: true } } },
    take: 5,
  });

  const appointments = await prisma.appointment.findMany({
    where: isDoctor(actorRole)
      ? { AND: [appointmentFilter, { doctorId: actorId }] }
      : appointmentFilter,
    orderBy: { date: 'desc' },
    select: { id: true, date: true, status: true, pet: { select: { name: true } }, customer: { select: { name: true } } },
    take: 5,
  });

  const medicalRecords = await prisma.medicalRecord.findMany({
    where: isDoctor(actorRole)
      ? { doctorId: actorId, OR: [{ diagnosis: { contains: q } }, { treatment: { contains: q } }, { prescription: { contains: q } }] }
      : { OR: [{ diagnosis: { contains: q } }, { treatment: { contains: q } }, { prescription: { contains: q } }] },
    orderBy: { date: 'desc' },
    select: { id: true, diagnosis: true, treatment: true, pet: { select: { name: true } } },
    take: 5,
  });

  const results = [
    {
      category: 'Pelanggan',
      items: customers.map((customer) => ({
        id: customer.id,
        title: customer.name,
        subtitle: customer.phone ?? 'Tidak ada telepon',
        href: '/customers',
      })),
    },
    {
      category: 'Hewan',
      items: pets.map((pet) => ({
        id: pet.id,
        title: pet.name,
        subtitle: pet.species,
        href: '/pets',
      })),
    },
    {
      category: 'Janji Temu',
      items: appointments.map((appointment) => ({
        id: appointment.id,
        title: appointment.pet.name,
        subtitle: `${appointment.customer.name} • ${new Date(appointment.date).toLocaleDateString('id-ID')}`,
        href: '/appointments',
      })),
    },
    {
      category: 'Rekam Medis',
      items: medicalRecords.map((record) => ({
        id: record.id,
        title: record.diagnosis ?? 'Rekam medis',
        subtitle: record.pet.name,
        href: '/medical-records',
      })),
    },
  ];

  if (!isDoctor(actorRole)) {
    const invoices = await prisma.invoice.findMany({
      where: invoiceFilter,
      orderBy: { date: 'desc' },
      select: { id: true, invoiceNumber: true, totalAmount: true },
      take: 5,
    });

    const products = await prisma.product.findMany({
      where: productFilter,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, stock: true },
      take: 5,
    });

    results.push({
      category: 'Invoice',
      items: invoices.map((invoice) => ({
        id: invoice.id,
        title: invoice.invoiceNumber,
        subtitle: `Total ${invoice.totalAmount}`,
        href: '/billing',
      })),
    });

    results.push({
      category: 'Produk',
      items: products.map((product) => ({
        id: product.id,
        title: product.name,
        subtitle: `Stok ${product.stock}`,
        href: '/petshop/products',
      })),
    });
  }

  return { success: true, message: 'Hasil pencarian tersedia.', data: { results } };
}
