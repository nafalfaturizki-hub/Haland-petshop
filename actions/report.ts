'use server';

import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isDoctor } from '@/lib/permissions';

import { getActorRole, getActorId } from '@/lib/utils';
const REPORT_TYPES = [
  'revenue',
  'appointments',
  'medical-records',
  'customers',
  'pets',
  'inventory',
  'products',
  'pos',
  'invoices',
  'pet-hotel',
  'activity',
  'audit',
] as const;

const reportFilterSchema = z.object({
  reportType: z.enum(REPORT_TYPES).default('revenue'),
  range: z.enum(['today', 'yesterday', 'week', 'month', 'year', 'custom']).default('month'),
  startDate: z.string().trim().optional().or(z.literal('')),
  endDate: z.string().trim().optional().or(z.literal('')),
  doctorId: z.string().trim().optional().or(z.literal('')),
  customerId: z.string().trim().optional().or(z.literal('')),
  petId: z.string().trim().optional().or(z.literal('')),
  status: z.string().trim().optional().or(z.literal('')),
  category: z.string().trim().optional().or(z.literal('')),
  paymentStatus: z.string().trim().optional().or(z.literal('')),
  roomId: z.string().trim().optional().or(z.literal('')),
  search: z.string().trim().optional().or(z.literal('')),
});

type ReportType = (typeof REPORT_TYPES)[number];

type ReportFilters = z.infer<typeof reportFilterSchema>;

const STAFF_ROLES = ['OWNER', 'ADMIN_KLINIK', 'DOKTER'];

function normalizeOptional(value: string | undefined | null) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
}

function toStartOfDay(value: string | Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toEndOfDay(value: string | Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function getDateRange(range: string, startDate?: string, endDate?: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (range) {
    case 'today':
      return { start: toStartOfDay(today), end: toEndOfDay(today) };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: toStartOfDay(yesterday), end: toEndOfDay(yesterday) };
    }
    case 'week': {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 6);
      return { start: toStartOfDay(weekStart), end: toEndOfDay(today) };
    }
    case 'month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: toStartOfDay(monthStart), end: toEndOfDay(today) };
    }
    case 'year': {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return { start: toStartOfDay(yearStart), end: toEndOfDay(today) };
    }
    case 'custom': {
      if (startDate) {
        return { start: toStartOfDay(startDate), end: endDate ? toEndOfDay(endDate) : undefined };
      }
      return { start: undefined, end: undefined };
    }
    default:
      return { start: undefined, end: undefined };
  }
}

function buildDateWhere(field: string, range: string, startDate?: string, endDate?: string) {
  const { start, end } = getDateRange(range, startDate, endDate);
  if (!start && !end) {
    return undefined;
  }
  return {
    [field]: {
      ...(start ? { gte: start } : {}),
      ...(end ? { lte: end } : {}),
    },
  };
}

function searchMatches(value: unknown, query: string) {
  if (!query) {
    return true;
  }
  if (value == null) {
    return false;
  }
  return String(value).toLowerCase().includes(query.toLowerCase());
}

function applySearch(rows: Array<Record<string, unknown>>, query: string) {
  if (!query) {
    return rows;
  }
  const normalized = query.toLowerCase();
  return rows.filter((row) => Object.values(row).some((value) => searchMatches(value, normalized)));
}

async function getFilterOptions(actorRole?: string) {
  const [doctors, customers, pets, rooms, categories] = await Promise.all([
    prisma.user.findMany({ where: { role: 'DOKTER' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.customer.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.pet.findMany({ select: { id: true, name: true, species: true }, orderBy: { name: 'asc' } }),
    prisma.petHotelRoom.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.productCategory.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return {
    doctors,
    customers,
    pets,
    rooms,
    categories,
    paymentStatuses: ['UNPAID', 'PARTIAL_PAYMENT', 'PAID', 'CANCELLED'],
    appointmentStatuses: ['WAITING', 'IN_PROGRESS', 'DONE', 'CANCELLED'],
    bookingStatuses: ['BOOKED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'],
  };
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
      prisma.appointment.count({ where: { doctorId: actorId, date: { gte: start, lt: end }, status: { not: 'CANCELLED' } } }),
      prisma.appointment.count({ where: { doctorId: actorId, status: 'WAITING' } }),
      prisma.medicalRecord.count({ where: { doctorId: actorId, date: { gte: new Date(today.getFullYear(), today.getMonth(), 1), lt: new Date(today.getFullYear(), today.getMonth() + 1, 1) } } }),
    ]);

    return {
      success: true,
      message: 'Ringkasan laporan dokter berhasil dimuat.',
      data: { role: 'DOKTER', summary: { myAppointmentsToday, waitingAppointments, medicalRecordsThisMonth } },
    };
  }

  const [totalCustomers, totalPets, appointmentsToday, occupiedRooms, allProducts, unpaidInvoices, revenueToday, salesToday] = await Promise.all([
    prisma.customer.count(),
    prisma.pet.count(),
    prisma.appointment.count({ where: { date: { gte: start, lt: end }, status: { not: 'CANCELLED' } } }),
    prisma.petHotelBooking.count({ where: { status: 'CHECKED_IN' } }),
    prisma.product.findMany({ select: { stock: true, minStock: true } }),
    prisma.invoice.count({ where: { status: 'UNPAID' } }),
    prisma.invoice.aggregate({ _sum: { totalAmount: true }, where: { date: { gte: start, lt: end }, status: 'PAID' } }),
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

export async function getReportData(input: ReportFilters) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  if (!STAFF_ROLES.includes(actorRole ?? '')) {
    return { success: false, message: 'Anda tidak berwenang melihat laporan.', data: null };
  }

  const parsed = reportFilterSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: 'Filter tidak valid.', data: null };
  }

  const filters = parsed.data;
  const normalizedSearch = normalizeOptional(filters.search);
  const reportType = filters.reportType as ReportType;
  const dateWhere = buildDateWhere('date', filters.range, filters.startDate, filters.endDate);
  const dateWhereAppointments = buildDateWhere('date', filters.range, filters.startDate, filters.endDate);
  const dateWhereMedical = buildDateWhere('date', filters.range, filters.startDate, filters.endDate);
  const dateWhereInvoices = buildDateWhere('date', filters.range, filters.startDate, filters.endDate);
  const dateWhereHotel = buildDateWhere('checkInDate', filters.range, filters.startDate, filters.endDate);
  const dateWhereAudit = buildDateWhere('date', filters.range, filters.startDate, filters.endDate);

  const commonWhere: Record<string, unknown> = {};

  if (filters.doctorId) {
    commonWhere.doctorId = filters.doctorId;
  }
  if (filters.customerId) {
    commonWhere.customerId = filters.customerId;
  }
  if (filters.petId) {
    commonWhere.petId = filters.petId;
  }
  if (filters.status) {
    commonWhere.status = filters.status;
  }
  if (filters.category) {
    commonWhere.categoryId = filters.category;
  }
  if (filters.paymentStatus) {
    commonWhere.status = filters.paymentStatus;
  }

  if (isDoctor(actorRole)) {
    commonWhere.doctorId = actorId;
  }

  try {
    const filterOptions = await getFilterOptions(actorRole);

    switch (reportType) {
      case 'revenue': {
        const invoiceWhere: Record<string, unknown> = {
          ...(dateWhereInvoices ?? {}),
          ...(filters.paymentStatus ? { status: filters.paymentStatus as never } : {}),
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
        };
        const invoices = await prisma.invoice.findMany({
          where: invoiceWhere,
          include: {
            customer: { select: { name: true } },
            payments: { select: { amount: true } },
          },
          orderBy: { date: 'desc' },
        });
        const filtered = applySearch(invoices.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customer: invoice.customer.name,
          date: invoice.date.toISOString().slice(0, 10),
          status: invoice.status,
          total: invoice.totalAmount,
          subtotal: invoice.subtotal,
          balance: invoice.totalAmount - invoice.payments.reduce<number>((sum, payment) => sum + Number(payment.amount), 0),
        })), normalizedSearch);
        const totalRevenue = filtered.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
        const paidCount = filtered.filter((row) => row.status === 'PAID').length;
        const outstandingBalance = filtered.reduce((sum, row) => sum + Number(row.balance ?? 0), 0);
        return {
          success: true,
          message: 'Laporan pendapatan berhasil dimuat.',
          data: {
            reportType,
            summary: {
              totalRevenue,
              paidInvoices: paidCount,
              outstandingBalance,
              averageInvoice: filtered.length > 0 ? totalRevenue / filtered.length : 0,
            },
            rows: filtered,
            series: [],
            chartType: 'bar',
            columns: ['invoiceNumber', 'customer', 'date', 'status', 'total'],
            options: filterOptions,
          },
        };
      }

      case 'appointments': {
        const appointmentWhere: Record<string, unknown> = {
          ...(dateWhereAppointments ?? {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...(filters.petId ? { petId: filters.petId } : {}),
        };
        const appointments = await prisma.appointment.findMany({
          where: appointmentWhere,
          include: {
            pet: { select: { name: true } },
            customer: { select: { name: true } },
            doctor: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
        });
        const rows = applySearch(appointments.map((appointment) => ({
          id: appointment.id,
          date: appointment.date.toISOString().slice(0, 10),
          pet: appointment.pet.name,
          customer: appointment.customer.name,
          doctor: appointment.doctor?.name ?? '-',
          status: appointment.status,
        })), normalizedSearch);
        const total = rows.length;
        const completed = rows.filter((row) => row.status === 'DONE').length;
        const pending = rows.filter((row) => row.status === 'WAITING' || row.status === 'IN_PROGRESS').length;
        return {
          success: true,
          message: 'Laporan janji temu berhasil dimuat.',
          data: {
            reportType,
            summary: { totalAppointments: total, completedAppointments: completed, pendingAppointments: pending },
            rows,
            series: [
              { label: 'Selesai', value: completed },
              { label: 'Menunggu', value: pending },
              { label: 'Batal', value: rows.filter((row) => row.status === 'CANCELLED').length },
            ],
            chartType: 'pie',
            columns: ['date', 'pet', 'customer', 'doctor', 'status'],
            options: filterOptions,
          },
        };
      }

      case 'medical-records': {
        const records = await prisma.medicalRecord.findMany({
          where: {
            ...(dateWhereMedical ?? {}),
            ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
            ...(filters.customerId ? { customerId: filters.customerId } : {}),
            ...(filters.petId ? { petId: filters.petId } : {}),
            ...(filters.status ? { status: filters.status } : {}),
          },
          include: { pet: { select: { name: true } }, customer: { select: { name: true } }, doctor: { select: { name: true } } },
          orderBy: { date: 'desc' },
        });
        const rows = applySearch(records.map((record) => ({
          id: record.id,
          recordNumber: record.recordNumber,
          date: record.date.toISOString().slice(0, 10),
          pet: record.pet.name,
          customer: record.customer.name,
          doctor: record.doctor.name,
          status: record.status,
        })), normalizedSearch);
        return {
          success: true,
          message: 'Laporan rekam medis berhasil dimuat.',
          data: {
            reportType,
            summary: {
              totalRecords: rows.length,
              openRecords: rows.filter((row) => row.status === 'OPEN').length,
              closedRecords: rows.filter((row) => row.status !== 'OPEN').length,
            },
            rows,
            series: [
              { label: 'Buka', value: rows.filter((row) => row.status === 'OPEN').length },
              { label: 'Tutup', value: rows.filter((row) => row.status !== 'OPEN').length },
            ],
            chartType: 'pie',
            columns: ['recordNumber', 'date', 'pet', 'customer', 'doctor', 'status'],
            options: filterOptions,
          },
        };
      }

      case 'customers': {
        const customers = await prisma.customer.findMany({
          where: {
            ...(filters.search ? { name: { contains: filters.search, mode: 'insensitive' } } : {}),
          },
          include: { pets: true, invoices: true },
          orderBy: { name: 'asc' },
        });
        const rows = customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          phone: customer.phone ?? '-',
          pets: customer.pets.length,
          invoices: customer.invoices.length,
        }));
        return {
          success: true,
          message: 'Laporan pelanggan berhasil dimuat.',
          data: {
            reportType,
            summary: {
              totalCustomers: rows.length,
              customersWithPets: rows.filter((row) => row.pets > 0).length,
              customersWithInvoices: rows.filter((row) => row.invoices > 0).length,
            },
            rows,
            series: [
              { label: 'Memiliki hewan', value: rows.filter((row) => row.pets > 0).length },
              { label: 'Tanpa hewan', value: rows.filter((row) => row.pets === 0).length },
            ],
            chartType: 'bar',
            columns: ['name', 'phone', 'pets', 'invoices'],
            options: filterOptions,
          },
        };
      }

      case 'pets': {
        const pets = await prisma.pet.findMany({
          where: {
            ...(filters.customerId ? { customerId: filters.customerId } : {}),
            ...(filters.status ? { gender: filters.status } : {}),
          },
          include: { customer: { select: { name: true } }, medicalRecords: true, appointments: true },
          orderBy: { name: 'asc' },
        });
        const rows = pets.map((pet) => ({
          id: pet.id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed ?? '-',
          owner: pet.customer.name,
          medicalRecords: pet.medicalRecords.length,
          appointments: pet.appointments.length,
        }));
        const speciesCounts = rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.species] = (acc[row.species] ?? 0) + 1;
          return acc;
        }, {});
        return {
          success: true,
          message: 'Laporan hewan berhasil dimuat.',
          data: {
            reportType,
            summary: {
              totalPets: rows.length,
              petsWithMedicalRecords: rows.filter((row) => row.medicalRecords > 0).length,
              petsWithAppointments: rows.filter((row) => row.appointments > 0).length,
            },
            rows,
            series: Object.entries(speciesCounts).map(([label, value]) => ({ label, value })),
            chartType: 'bar',
            columns: ['name', 'species', 'breed', 'owner', 'medicalRecords', 'appointments'],
            options: filterOptions,
          },
        };
      }

      case 'inventory': {
        const products = await prisma.product.findMany({
          where: {
            ...(filters.category ? { categoryId: filters.category } : {}),
            ...(filters.status ? { status: filters.status as never } : {}),
          },
          include: { category: { select: { name: true } }, stockMovements: { where: { date: { ...(dateWhere ?? {}) } } } },
          orderBy: { name: 'asc' },
        });
        const rows = products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku ?? '-',
          category: product.category?.name ?? '-',
          stock: product.stock,
          minStock: product.minStock,
          value: product.stock * product.sellPrice,
          movements: product.stockMovements.length,
        }));
        const inventoryValue = rows.reduce((sum, row) => sum + Number(row.value ?? 0), 0);
        const lowStock = rows.filter((row) => row.stock < row.minStock).length;
        return {
          success: true,
          message: 'Laporan inventaris berhasil dimuat.',
          data: {
            reportType,
            summary: {
              totalProducts: rows.length,
              lowStockProducts: lowStock,
              outOfStockProducts: rows.filter((row) => row.stock === 0).length,
              inventoryValue,
            },
            rows,
            series: [
              { label: 'Stok aman', value: rows.filter((row) => row.stock >= row.minStock).length },
              { label: 'Stok rendah', value: lowStock },
            ],
            chartType: 'pie',
            columns: ['name', 'sku', 'category', 'stock', 'minStock', 'value'],
            options: filterOptions,
          },
        };
      }

      case 'products': {
        const invoices = await prisma.invoice.findMany({
          where: {
            ...(dateWhereInvoices ?? {}),
            ...(filters.customerId ? { customerId: filters.customerId } : {}),
            status: 'PAID' as never,
          },
          include: { items: true },
          orderBy: { date: 'desc' },
        });
        const rows = invoices.flatMap((invoice) => invoice.items.filter((item) => item.type === 'PRODUK').map((item) => ({
          id: item.id,
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.date.toISOString().slice(0, 10),
          description: item.description,
          qty: item.qty,
          subtotal: item.subtotal,
        })));
        const grouped = rows.reduce<Record<string, { name: string; qty: number; revenue: number }>>((acc, row) => {
          const key = String(row.description);
          if (!acc[key]) acc[key] = { name: key, qty: 0, revenue: 0 };
          acc[key].qty += Number(row.qty ?? 0);
          acc[key].revenue += Number(row.subtotal ?? 0);
          return acc;
        }, {});
        const productRows = Object.values(grouped).sort((a, b) => b.revenue - a.revenue);
        return {
          success: true,
          message: 'Laporan produk berhasil dimuat.',
          data: {
            reportType,
            summary: {
              totalProductsSold: rows.reduce((sum, row) => sum + Number(row.qty ?? 0), 0),
              productCount: productRows.length,
              topProductRevenue: productRows[0]?.revenue ?? 0,
            },
            rows: productRows.map((row) => ({ ...row, revenue: row.revenue })),
            series: productRows.slice(0, 5).map((row) => ({ label: row.name, value: row.revenue })),
            chartType: 'bar',
            columns: ['name', 'qty', 'revenue'],
            options: filterOptions,
          },
        };
      }

      case 'pos': {
        const invoices = await prisma.invoice.findMany({
          where: {
            ...(dateWhereInvoices ?? {}),
            ...(filters.customerId ? { customerId: filters.customerId } : {}),
            status: 'PAID' as never,
          },
          include: { customer: { select: { name: true } } },
          orderBy: { date: 'desc' },
        });
        const rows = invoices.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customer: invoice.customer.name,
          date: invoice.date.toISOString().slice(0, 10),
          total: invoice.totalAmount,
          paymentStatus: invoice.status,
        }));
        return {
          success: true,
          message: 'Laporan POS berhasil dimuat.',
          data: {
            reportType,
            summary: {
              totalPosSales: rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0),
              posTransactions: rows.length,
              averageTransaction: rows.length > 0 ? rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0) / rows.length : 0,
            },
            rows,
            series: [
              { label: 'Transaksi', value: rows.length },
              { label: 'Nilai penjualan', value: rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0) },
            ],
            chartType: 'bar',
            columns: ['invoiceNumber', 'customer', 'date', 'total', 'paymentStatus'],
            options: filterOptions,
          },
        };
      }

      case 'invoices': {
        const invoices = await prisma.invoice.findMany({
          where: {
            ...(dateWhereInvoices ?? {}),
            ...(filters.customerId ? { customerId: filters.customerId } : {}),
            ...(filters.paymentStatus ? { status: filters.paymentStatus as never } : {}),
          },
          include: { customer: { select: { name: true } } },
          orderBy: { date: 'desc' },
        });
        const rows = invoices.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customer: invoice.customer.name,
          date: invoice.date.toISOString().slice(0, 10),
          status: invoice.status,
          total: invoice.totalAmount,
        }));
        const totalInvoices = rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
        return {
          success: true,
          message: 'Laporan invoice berhasil dimuat.',
          data: {
            reportType,
            summary: {
              totalInvoices: rows.length,
              totalInvoiceValue: totalInvoices,
              paidInvoices: rows.filter((row) => row.status === 'PAID').length,
              unpaidInvoices: rows.filter((row) => row.status === 'UNPAID').length,
            },
            rows,
            series: [
              { label: 'Lunas', value: rows.filter((row) => row.status === 'PAID').length },
              { label: 'Belum dibayar', value: rows.filter((row) => row.status === 'UNPAID').length },
            ],
            chartType: 'pie',
            columns: ['invoiceNumber', 'customer', 'date', 'status', 'total'],
            options: filterOptions,
          },
        };
      }

      case 'pet-hotel': {
        const bookings = await prisma.petHotelBooking.findMany({
          where: {
            ...(dateWhereHotel ?? {}),
            ...(filters.roomId ? { roomId: filters.roomId } : {}),
            ...(filters.status ? { status: filters.status as never } : {}),
            ...(filters.petId ? { petId: filters.petId } : {}),
          },
          include: { pet: { select: { name: true } }, room: { select: { name: true } } },
          orderBy: { checkInDate: 'desc' },
        });
        const rows = bookings.map((booking) => ({
          id: booking.id,
          bookingNumber: booking.bookingNumber ?? '-',
          pet: booking.pet.name,
          room: booking.room?.name ?? '-',
          checkInDate: booking.checkInDate.toISOString().slice(0, 10),
          checkOutDate: booking.checkOutDate.toISOString().slice(0, 10),
          status: booking.status,
        }));
        const occupied = rows.filter((row) => row.status === 'CHECKED_IN').length;
        return {
          success: true,
          message: 'Laporan pet hotel berhasil dimuat.',
          data: {
            reportType,
            summary: {
              totalBookings: rows.length,
              checkedInBookings: occupied,
              checkedOutBookings: rows.filter((row) => row.status === 'CHECKED_OUT').length,
              cancelledBookings: rows.filter((row) => row.status === 'CANCELLED').length,
            },
            rows,
            series: [
              { label: 'Book', value: rows.filter((row) => row.status === 'BOOKED').length },
              { label: 'Check-in', value: occupied },
            ],
            chartType: 'bar',
            columns: ['bookingNumber', 'pet', 'room', 'checkInDate', 'checkOutDate', 'status'],
            options: filterOptions,
          },
        };
      }

      case 'activity':
      case 'audit': {
        const logs = await prisma.auditLog.findMany({
          where: {
            ...(dateWhereAudit ?? {}),
            ...(filters.doctorId ? { userId: filters.doctorId } : {}),
            ...(filters.status ? { action: filters.status } : {}),
          },
          include: { user: { select: { name: true } } },
          orderBy: { date: 'desc' },
        });
        const rows = logs.map((log) => ({
          id: log.id,
          date: log.date.toISOString().slice(0, 10),
          user: log.user.name,
          action: log.action,
          entity: log.entity,
          description: log.description ?? '-',
        }));
        return {
          success: true,
          message: 'Log aktivitas berhasil dimuat.',
          data: {
            reportType,
            summary: {
              totalActivityEntries: rows.length,
              uniqueUsers: new Set(rows.map((row) => row.user)).size,
              latestAction: rows[0]?.action ?? '-',
            },
            rows,
            series: [
              { label: 'CREATE', value: rows.filter((row) => row.action === 'CREATE').length },
              { label: 'UPDATE', value: rows.filter((row) => row.action === 'UPDATE').length },
              { label: 'DELETE', value: rows.filter((row) => row.action === 'DELETE').length },
            ],
            chartType: 'bar',
            columns: ['date', 'user', 'action', 'entity', 'description'],
            options: filterOptions,
          },
        };
      }

      default:
        return { success: false, message: 'Jenis laporan belum tersedia.', data: null };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Gagal memuat laporan.',
      data: null,
    };
  }
}
