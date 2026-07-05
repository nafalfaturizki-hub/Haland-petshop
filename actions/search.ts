'use server';

import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isStaffRole, isDoctor } from '@/lib/permissions';
import { getActorRole, getActorId } from '@/lib/utils';

const searchSchema = z.object({
  query: z.string().trim().min(1).max(80),
});

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

  if (!isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melakukan pencarian global.', data: null };
  }

  const q = parsed.data.query;
  const likeQuery = { contains: q, mode: 'insensitive' as const };

  const customerFilter = {
    OR: [
      { name: likeQuery },
      { phone: likeQuery },
      { email: likeQuery },
    ],
  };

  const petFilter = {
    OR: [
      { name: likeQuery },
      { species: likeQuery },
      { breed: likeQuery },
    ],
  };

  const appointmentFilter = {
    OR: [
      { pet: { is: { name: likeQuery } } },
      { customer: { is: { name: likeQuery } } },
    ],
  };

  const invoiceFilter = {
    OR: [
      { invoiceNumber: likeQuery },
      { customer: { is: { name: likeQuery } } },
      { notes: likeQuery },
    ],
  };

  const productFilter = {
    OR: [
      { name: likeQuery },
      { sku: likeQuery },
      { barcode: likeQuery },
      { description: likeQuery },
    ],
  };

  const baseWhere = isDoctor(actorRole)
    ? {
        AND: [
          { appointments: { some: { doctorId: actorId } } },
        ],
      }
    : {};

  const [customers, pets, appointments, medicalRecords] = await Promise.all([
    prisma.customer.findMany({
      where: isDoctor(actorRole) ? { AND: [customerFilter, baseWhere] } : customerFilter,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, phone: true },
      take: 5,
    }),
    prisma.pet.findMany({
      where: isDoctor(actorRole) ? { AND: [petFilter, { customer: { appointments: { some: { doctorId: actorId } } } }] } : petFilter,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, species: true, customer: { select: { name: true } } },
      take: 5,
    }),
    prisma.appointment.findMany({
      where: isDoctor(actorRole) ? { AND: [appointmentFilter, { doctorId: actorId }] } : appointmentFilter,
      orderBy: { date: 'desc' },
      select: { id: true, date: true, status: true, pet: { select: { name: true } }, customer: { select: { name: true } } },
      take: 5,
    }),
    prisma.medicalRecord.findMany({
      where: isDoctor(actorRole)
        ? { doctorId: actorId, OR: [{ diagnosis: likeQuery }, { treatment: likeQuery }, { prescription: likeQuery }, { chiefComplaint: likeQuery }] }
        : { OR: [{ diagnosis: likeQuery }, { treatment: likeQuery }, { prescription: likeQuery }, { chiefComplaint: likeQuery }] },
      orderBy: { date: 'desc' },
      select: { id: true, diagnosis: true, treatment: true, pet: { select: { name: true } } },
      take: 5,
    }),
  ]);

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
    const [invoices, products] = await Promise.all([
      prisma.invoice.findMany({
        where: invoiceFilter,
        orderBy: { date: 'desc' },
        select: { id: true, invoiceNumber: true, totalAmount: true },
        take: 5,
      }),
      prisma.product.findMany({
        where: productFilter,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, stock: true },
        take: 5,
      }),
    ]);

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
