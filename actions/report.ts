'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const STAFF_ROLES = ['OWNER', 'ADMIN_KLINIK', 'DOKTER'];

function getActorRole(session: Awaited<ReturnType<typeof auth>>) {
  return (session?.user as { role?: string } | undefined)?.role;
}

function getActorId(session: Awaited<ReturnType<typeof auth>>) {
  return session?.user?.id;
}

function isDoctor(role?: string) {
  return role === 'DOKTER';
}

export async function getReportSummary() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  if (!STAFF_ROLES.includes(actorRole ?? '')) {
    return { success: false, message: 'Anda tidak berwenang melihat laporan.', data: null };
  }

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  if (isDoctor(actorRole)) {
    const [myAppointmentsToday, waitingAppointments, medicalRecordsThisMonth] = await Promise.all([
      prisma.appointment.count({
        where: { doctorId: actorId, date: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
      }),
      prisma.appointment.count({
        where: { doctorId: actorId, status: 'WAITING' },
      }),
      prisma.medicalRecord.count({
        where: {
          doctorId: actorId,
          date: { gte: new Date(today.getFullYear(), today.getMonth(), 1), lt: new Date(today.getFullYear(), today.getMonth() + 1, 1) },
        },
      }),
    ]);

    return {
      success: true,
      message: 'Ringkasan laporan dokter berhasil dimuat.',
      data: {
        role: 'DOKTER',
        summary: {
          myAppointmentsToday,
          waitingAppointments,
          medicalRecordsThisMonth,
        },
      },
    };
  }

  const [totalCustomers, totalPets, appointmentsToday, occupiedRooms, allProducts, unpaidInvoices, revenueToday, salesToday] = await Promise.all([
    prisma.customer.count(),
    prisma.pet.count(),
    prisma.appointment.count({
      where: { date: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
    }),
    prisma.petHotelBooking.count({ where: { status: 'CHECKED_IN' } }),
    prisma.product.findMany({ select: { stock: true, minStock: true } }),
    prisma.invoice.count({ where: { status: 'UNPAID' } }),
    prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: { date: { gte: start, lt: end }, status: 'PAID' },
    }),
    prisma.invoice.count({ where: { date: { gte: start, lt: end }, status: 'PAID' } }),
  ]);

  const lowStockCount = allProducts.filter((product) => product.stock < product.minStock).length;

  return {
    success: true,
    message: 'Ringkasan laporan berhasil dimuat.',
    data: {
      role: actorRole,
      summary: {
        totalCustomers,
        totalPets,
        appointmentsToday,
        occupiedRooms,
        lowStockCount,
        unpaidInvoices,
        revenueToday: revenueToday._sum.totalAmount ?? 0,
        salesToday,
      },
    },
  };
}
