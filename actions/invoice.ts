'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { sanitizeText } from '@/lib/sanitize';
import { prisma, createAuditLog, getCustomerForSession } from '@/lib/db';
import { getAuthorizedRoutes } from '@/lib/permission-matrix';
import { getActorRole, getActorId, roundCurrency } from '@/lib/utils';
import { generateInvoiceNumber } from '@/lib/numbering';
import { deductProductStock, restoreProductStock, validateStockAvailability } from '@/lib/inventory-helpers';
import { notifyUser } from '@/lib/notifications-helper';
import { enforceActionPermission, getPermissionDeniedAuditDescription, isStaffRole } from '@/lib/permissions';

const invoiceItemSchema = z.object({
  type: z.enum(['KONSULTASI', 'TINDAKAN', 'OBAT', 'PET_HOTEL', 'PRODUK']),
  description: z.string().trim().min(1, 'Deskripsi item wajib diisi.'),
  qty: z.coerce.number().int().min(1, 'Kuantitas minimal 1.'),
  price: z.coerce.number().min(0, 'Harga tidak boleh negatif.'),
  productId: z.string().trim().optional().or(z.literal('')),
  procedureId: z.string().trim().optional().or(z.literal('')),
  petHotelBookingId: z.string().trim().optional().or(z.literal('')),
});

const createInvoiceSchema = z.object({
  customerId: z.string().trim().min(1, 'Pelanggan wajib dipilih.'),
  appointmentId: z.string().trim().optional().or(z.literal('')),
  medicalRecordId: z.string().trim().optional().or(z.literal('')),
  petId: z.string().trim().optional().or(z.literal('')),
  doctorId: z.string().trim().optional().or(z.literal('')),
  items: z.array(invoiceItemSchema).min(1, 'Minimal satu item invoice.'),
  discountAmount: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
  initialPaymentAmount: z.coerce.number().min(0).optional(),
  initialPaymentMethod: z.enum(['CASH', 'NON_CASH']).optional(),
});

const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  method: z.enum(['CASH', 'NON_CASH']),
  amount: z.coerce.number().min(0.01, 'Jumlah pembayaran minimal Rp 1.'),
});

const cancelInvoiceSchema = z.object({ id: z.string().min(1) });


/** Fetch lookup data (customers, products, procedures) for invoice create form. */
export async function getInvoiceLookups() {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!isStaffRole(actorRole) || !getAuthorizedRoutes(actorRole).includes('billing')) {
    return { success: false, message: 'Anda tidak berwenang mengakses data ini.' };
  }

  const [customers, appointments, medicalRecords, doctors, procedures] = await Promise.all([
    prisma.customer.findMany({ where: { isGuest: false }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.appointment.findMany({
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        pet: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.medicalRecord.findMany({
      orderBy: { date: 'desc' },
      select: {
        id: true,
        recordNumber: true,
        date: true,
        treatment: true,
        prescription: true,
        pet: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({ where: { role: 'DOKTER' }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.procedure.findMany({ orderBy: { name: 'asc' }, select: { id: true, code: true, name: true, price: true } }),
  ]);

  return { success: true, customers, appointments, medicalRecords, doctors, procedures };
}

export async function listInvoices(page = 1, pageSize = 50) {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!isStaffRole(actorRole) || !getAuthorizedRoutes(actorRole).includes('billing')) {
    return { success: false, message: 'Anda tidak berwenang melihat invoice.' };
  }

  const skip = (page - 1) * pageSize;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { date: 'desc' },
      skip,
      take: pageSize,
      include: {
        customer: { select: { id: true, name: true } },
        items: true,
        payments: true,
      },
    }),
    prisma.invoice.count(),
  ]);

  return { success: true, invoices, total, page, pageSize };
}

export async function getInvoiceById(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!isStaffRole(actorRole) || !getAuthorizedRoutes(actorRole).includes('billing')) {
    return { success: false, message: 'Anda tidak berwenang melihat invoice.' };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true } },
      items: true,
      payments: true,
    },
  });

  if (!invoice) {
    return { success: false, message: 'Invoice tidak ditemukan.' };
  }

  return { success: true, invoice };
}

/** Create invoice with validation, stock deduction, and atomic transaction. Retries on invoice number conflict. */
export async function createInvoice(input: z.infer<typeof createInvoiceSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = createInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data invoice tidak valid.' };
  }

  const permissionCheck = await enforceActionPermission({
    role: actorRole,
    actorId,
    module: 'billing',
    action: 'create',
    denyMessage: 'Anda tidak berwenang membuat invoice.',
    logDenied: async () => {
      await createAuditLog(actorId ?? 'unknown', 'PERMISSION_DENIED', 'Invoice', null, getPermissionDeniedAuditDescription(actorRole, 'billing', 'create'));
    },
  });

  if (!permissionCheck.allowed) {
    return { success: false, message: permissionCheck.message };
  }

  // Validasi: hanya OWNER dan ADMIN_KLINIK yang boleh membuat invoice dengan item KONSULTASI atau OBAT
  const hasManualPriceItems = parsed.data.items.some((item) => ['KONSULTASI', 'OBAT'].includes(item.type));
  if (hasManualPriceItems && actorRole !== 'OWNER' && actorRole !== 'ADMIN_KLINIK') {
    return {
      success: false,
      message: 'Hanya pemilik klinik atau admin klinik yang dapat membuat invoice dengan item Konsultasi atau Obat.',
    };
  }

  const customer = await prisma.customer.findUnique({ where: { id: parsed.data.customerId } });
  if (!customer) {
    return { success: false, message: 'Pelanggan tidak ditemukan.' };
  }

  if (parsed.data.petId) {
    const pet = await prisma.pet.findFirst({ where: { id: parsed.data.petId, customerId: customer.id } });
    if (!pet) {
      return { success: false, message: 'Hewan tidak terhubung ke pelanggan ini.' };
    }
  }

  if (parsed.data.appointmentId) {
    const appointment = await prisma.appointment.findFirst({ where: { id: parsed.data.appointmentId, customerId: customer.id } });
    if (!appointment) {
      return { success: false, message: 'Appointment tidak terhubung ke pelanggan ini.' };
    }
  }

  if (parsed.data.medicalRecordId) {
    const medicalRecord = await prisma.medicalRecord.findFirst({ where: { id: parsed.data.medicalRecordId, customerId: customer.id } });
    if (!medicalRecord) {
      return { success: false, message: 'Rekam medis tidak terhubung ke pelanggan ini.' };
    }
  }

  if (parsed.data.doctorId) {
    const doctor = await prisma.user.findFirst({ where: { id: parsed.data.doctorId, role: 'DOKTER' } });
    if (!doctor) {
      return { success: false, message: 'Dokter tidak ditemukan.' };
    }
  }

  const productIds = parsed.data.items
    .filter((item) => item.type === 'PRODUK' && item.productId)
    .map((item) => item.productId as string);

  const procedureIds = parsed.data.items
    .filter((item) => item.type === 'TINDAKAN' && item.procedureId)
    .map((item) => item.procedureId as string);

  const petHotelBookingIds = parsed.data.items
    .filter((item) => item.type === 'PET_HOTEL' && item.petHotelBookingId)
    .map((item) => item.petHotelBookingId as string);

  const productStockDeductionItems = parsed.data.items
    .filter((item) => item.type === 'PRODUK' && item.productId)
    .map((item) => ({ productId: item.productId as string, qty: item.qty }));

  if (productStockDeductionItems.length > 0) {
    const stockAvailability = await validateStockAvailability(prisma, productStockDeductionItems);
    if (!stockAvailability.ok) {
      return { success: false, message: stockAvailability.message };
    }
  }

  const [products, procedures, bookings] = await Promise.all([
    Promise.all(productIds.map((productId) => prisma.product.findUnique({ where: { id: productId } }))),
    Promise.all(procedureIds.map((procedureId) => prisma.procedure.findUnique({ where: { id: procedureId } }))),
    petHotelBookingIds.length > 0
      ? prisma.petHotelBooking.findMany({ where: { id: { in: petHotelBookingIds } }, include: { room: true } })
      : Promise.resolve([]),
  ]);

  const productsById = new Map<string, NonNullable<(typeof products)[number]>>();
  for (const p of products) {
    if (p) productsById.set(p.id, p);
  }

  const proceduresById = new Map<string, NonNullable<(typeof procedures)[number]>>();
  for (const pr of procedures) {
    if (pr) proceduresById.set(pr.id, pr);
  }

  const bookingsById = new Map<string, (typeof bookings)[number]>();
  for (const b of bookings) {
    bookingsById.set(b.id, b);
  }

  const invoiceItems = parsed.data.items.map((item) => {
    if (item.type === 'PRODUK') {
      if (!item.productId) {
        throw new Error(`Produk harus dipilih untuk item PRODUK: ${item.description}.`);
      }

      const product = productsById.get(item.productId);
      if (!product) {
        throw new Error(`Produk untuk item ${item.description} tidak ditemukan.`);
      }

      const price = roundCurrency(product.sellPrice);

      return {
        type: item.type,
        description: item.description || product.name,
        qty: item.qty,
        price,
        subtotal: roundCurrency(item.qty * price),
        productId: product.id,
        procedureId: null,
        petHotelBookingId: null,
      };
    }

    if (item.type === 'TINDAKAN' && item.procedureId) {
      const procedure = proceduresById.get(item.procedureId);
      if (!procedure) {
        throw new Error(`Tindakan untuk item ${item.description} tidak ditemukan.`);
      }

      const price = roundCurrency(procedure.price);

      return {
        type: item.type,
        description: item.description || procedure.name,
        qty: item.qty,
        price,
        subtotal: roundCurrency(item.qty * price),
        productId: null,
        procedureId: procedure.id,
        petHotelBookingId: null,
      };
    }

    if (item.type === 'PET_HOTEL' && item.petHotelBookingId) {
      const booking = bookingsById.get(item.petHotelBookingId);
      if (!booking) {
        throw new Error(`Booking pet hotel untuk item ${item.description} tidak ditemukan.`);
      }

      if (!booking.room) {
        throw new Error(`Kamar pet hotel belum ditentukan untuk booking ini. Silakan tentukan kamar sebelum membuat invoice.`);
      }

      // Calculate nights: from checkInDate to checkOutDate, rounded up per day
      const nights = Math.ceil((booking.checkOutDate.getTime() - booking.checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      if (nights <= 0) {
        throw new Error(`Durasi menginap tidak valid untuk booking ini.`);
      }

      // Calculate price from room.pricePerNight * nights, IGNORE client-submitted price
      const pricePerNight = roundCurrency(booking.room.pricePerNight);
      const totalPrice = roundCurrency(pricePerNight * nights);

      return {
        type: item.type,
        description: item.description || `${booking.room.name} (${nights} malam)`,
        qty: 1, // Pet hotel bookings are not quantity-based
        price: totalPrice,
        subtotal: totalPrice,
        productId: null,
        procedureId: null,
        petHotelBookingId: booking.id,
      };
    }

    // For KONSULTASI, OBAT, and other types: use client-submitted price
    // Note: In the future, KONSULTASI and OBAT should have validated prices or be restricted by role
    return {
      type: item.type,
      description: item.description,
      qty: item.qty,
      price: roundCurrency(item.price),
      subtotal: roundCurrency(item.qty * item.price),
      productId: item.productId || null,
      procedureId: null,
      petHotelBookingId: item.petHotelBookingId || null,
    };
  });

  const subtotal = roundCurrency(invoiceItems.reduce((sum, item) => sum + item.subtotal, 0));
  const discountAmount = roundCurrency(Math.min(parsed.data.discountAmount ?? 0, subtotal));
  const taxRate = roundCurrency(parsed.data.taxRate ?? 0);
  const taxableAmount = roundCurrency(Math.max(0, subtotal - discountAmount));
  const taxAmount = roundCurrency(taxableAmount * (taxRate / 100));
  const totalAmount = roundCurrency(taxableAmount + taxAmount);

  if (totalAmount <= 0) {
    // F6: Prevent invoices with zero/negative totals (e.g. over-discounted).
    return { success: false, message: 'Total tagihan harus lebih dari nol. Periksa kembali diskon yang diterapkan.' };
  }

  const invoiceNumber = await generateInvoiceNumber();
  const initialPaymentAmount = roundCurrency(parsed.data.initialPaymentAmount ?? 0);
  const initialPaymentMethod = parsed.data.initialPaymentMethod ?? 'CASH';

  if (initialPaymentAmount > totalAmount) {
    return { success: false, message: 'Pembayaran awal tidak boleh melebihi total tagihan.' };
  }

  const status = initialPaymentAmount <= 0 ? 'UNPAID' : initialPaymentAmount >= totalAmount ? 'PAID' : 'PARTIAL_PAYMENT';

  let invoice;

  // SECURITY: Retry on unique constraint violation (TOCTOU race condition for invoice number)
  let lastError: Error | null = null;
  for (let retryAttempt = 0; retryAttempt < 3; retryAttempt += 1) {
    try {
      invoice = await prisma.$transaction(async (tx) => {
        // Generate invoice number for each attempt to handle race condition
        const currentInvoiceNumber = retryAttempt === 0 ? invoiceNumber : await generateInvoiceNumber();

        const createdInvoice = await tx.invoice.create({
          data: {
            customerId: parsed.data.customerId,
            appointmentId: parsed.data.appointmentId || null,
            medicalRecordId: parsed.data.medicalRecordId || null,
            petId: parsed.data.petId || null,
            doctorId: parsed.data.doctorId || null,
            invoiceNumber: currentInvoiceNumber,
            status,
            subtotal,
            discountAmount,
            taxRate,
            taxAmount,
            totalAmount,
            notes: sanitizeText(parsed.data.notes ?? '', 1000),
            createdById: actorId,
            items: {
              create: invoiceItems.map((item) => ({
                type: item.type,
description: sanitizeText(item.description, 200),
                qty: item.qty,
                price: item.price,
                subtotal: item.subtotal,
                productId: item.productId,
                procedureId: item.procedureId,
                petHotelBookingId: item.petHotelBookingId,
              })),
            },
            ...(initialPaymentAmount > 0
              ? {
                  payments: {
                    create: {
                      method: initialPaymentMethod,
                      amount: initialPaymentAmount,
                    },
                  },
                }
              : {}),
          },
          include: {
            customer: true,
            items: true,
            payments: true,
          },
        });

        if (productStockDeductionItems.length > 0) {
          const deductionResult = await deductProductStock(tx, productStockDeductionItems);
          if (!deductionResult.ok) {
            throw new Error('Stok produk berubah, transaksi dibatalkan.');
          }
        }

        for (const item of invoiceItems.filter((invoiceItem) => invoiceItem.type === 'PRODUK' && invoiceItem.productId)) {
          await tx.stockMovement.create({
            data: {
              productId: item.productId as string,
              type: 'OUT',
              quantity: item.qty,
              note: `Penjualan invoice ${currentInvoiceNumber}`,
            },
          });
        }

        return createdInvoice;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      break; // Success, exit retry loop
    } catch (error) {
      lastError = error as Error;
      
      if (error instanceof Error) {
        if (error.message === 'Stok produk berubah, transaksi dibatalkan.') {
          return { success: false, message: 'Stok produk berubah saat transaksi diproses, silakan coba lagi.' };
        }
        
        // Check for unique constraint violation on invoiceNumber (P2002)
        if (error.message.includes('Unique constraint failed') && error.message.includes('invoiceNumber')) {
          if (retryAttempt < 2) {
            // Retry with new invoice number
            continue;
          }
        }
      }
      
      throw error;
    }
  }

  if (!invoice) {
    throw lastError || new Error('Gagal membuat invoice setelah retry.');
  }

  await createAuditLog(actorId ?? 'unknown', 'CREATE', 'Invoice', invoice.id, `Membuat invoice ${invoice.invoiceNumber}`);
  await notifyUser(customer.userId, 'Invoice dibuat', `Invoice ${invoice.invoiceNumber} telah dibuat untuk Anda.`, 'invoice');
  revalidatePath('/billing');
  revalidatePath('/portal/invoices');
  revalidatePath('/dashboard');

  return { success: true, invoice };
}

/** Record a payment against an invoice. Uses atomic transaction to prevent overpayment race conditions. */
export async function recordInvoicePayment(input: z.infer<typeof recordPaymentSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = recordPaymentSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data pembayaran tidak valid.' };
  }

  const permissionCheck = await enforceActionPermission({
    role: actorRole,
    actorId,
    module: 'billing',
    action: 'update',
    denyMessage: 'Anda tidak berwenang mencatat pembayaran.',
    logDenied: async () => {
      await createAuditLog(actorId ?? 'unknown', 'PERMISSION_DENIED', 'InvoicePayment', null, getPermissionDeniedAuditDescription(actorRole, 'billing', 'payment'));
    },
  });

  if (!permissionCheck.allowed) {
    return { success: false, message: permissionCheck.message };
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: parsed.data.invoiceId } });
  if (!invoice) {
    return { success: false, message: 'Invoice tidak ditemukan.' };
  }

  if (invoice.status === 'CANCELLED') {
    return { success: false, message: 'Invoice yang dibatalkan tidak bisa dibayar.' };
  }

  if (invoice.status === 'PAID') {
    return { success: false, message: 'Invoice sudah lunas.' };
  }

  try {
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // ATOMIC: Check outstanding within transaction to prevent race condition
      // This prevents two simultaneous payments from both succeeding and causing overpayment
      const aggregate = await tx.payment.aggregate({
        _sum: { amount: true },
        where: { invoiceId: parsed.data.invoiceId },
      });

      const totalPaid = roundCurrency(aggregate._sum.amount ?? 0);
      const outstanding = roundCurrency(invoice.totalAmount - totalPaid);

      if (parsed.data.amount > outstanding) {
        throw new Error('Jumlah pembayaran melebihi sisa tagihan.');
      }

      const payment = await tx.payment.create({
        data: {
          invoiceId: parsed.data.invoiceId,
          method: parsed.data.method,
          amount: roundCurrency(parsed.data.amount),
        },
      });

      const nextPaid = roundCurrency(totalPaid + payment.amount);
      const nextStatus = nextPaid >= invoice.totalAmount ? 'PAID' : 'PARTIAL_PAYMENT';

      const updated = await tx.invoice.update({
        where: { id: parsed.data.invoiceId },
        data: { status: nextStatus },
        include: { customer: true, items: true, payments: true },
      });

      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await createAuditLog(actorId ?? 'unknown', 'PAYMENT', 'Invoice', updatedInvoice.id, `Mencatat pembayaran invoice ${updatedInvoice.invoiceNumber}`);
    await notifyUser(invoice.customerId ? (await prisma.customer.findUnique({ where: { id: invoice.customerId }, select: { userId: true } }))?.userId : null, 'Pembayaran tercatat', `Pembayaran untuk invoice ${updatedInvoice.invoiceNumber} telah diterima.`, 'invoice');
    revalidatePath('/billing');
    revalidatePath('/portal/invoices');
    revalidatePath('/dashboard');

    return { success: true, invoice: updatedInvoice };
  } catch (error) {
    if (error instanceof Error && error.message === 'Jumlah pembayaran melebihi sisa tagihan.') {
      return { success: false, message: 'Jumlah pembayaran melebihi sisa tagihan.' };
    }
    throw error;
  }
}

export async function cancelInvoice(input: z.infer<typeof cancelInvoiceSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = cancelInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  const permissionCheck = await enforceActionPermission({
    role: actorRole,
    actorId,
    module: 'billing',
    action: 'delete',
    denyMessage: 'Anda tidak berwenang membatalkan invoice.',
    logDenied: async () => {
      await createAuditLog(actorId ?? 'unknown', 'PERMISSION_DENIED', 'Invoice', null, getPermissionDeniedAuditDescription(actorRole, 'billing', 'delete'));
    },
  });

  if (!permissionCheck.allowed) {
    return { success: false, message: permissionCheck.message };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: parsed.data.id },
    include: { items: true },
  });
  if (!invoice) {
    return { success: false, message: 'Invoice tidak ditemukan.' };
  }

  if (invoice.status === 'CANCELLED') {
    return { success: false, message: 'Invoice sudah dibatalkan.' };
  }

  if (invoice.status === 'PAID') {
    return { success: false, message: 'Invoice yang sudah lunas tidak bisa dibatalkan.' };
  }

  const productStockDeductionItems = invoice.items
    .filter((item: { type: string; productId: string | null; qty: number }) => item.type === 'PRODUK' && item.productId)
    .map((item: { productId: string | null; qty: number }) => ({ productId: item.productId as string, qty: item.qty }));

  const updatedInvoice = await prisma.$transaction(async (tx) => {
    const updated = await tx.invoice.update({
      where: { id: parsed.data.id },
      data: { status: 'CANCELLED' },
      include: { customer: true, items: true, payments: true },
    });

    if (productStockDeductionItems.length > 0) {
      await restoreProductStock(tx, productStockDeductionItems);
      await Promise.all(
        productStockDeductionItems.map((item: { productId: string; qty: number }) =>
          tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'RETURN',
              quantity: item.qty,
              note: `Produk dikembalikan dari pembatalan invoice ${updated.invoiceNumber}`,
            },
          }),
        ),
      );
    }

    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await createAuditLog(actorId ?? 'unknown', 'CANCEL', 'Invoice', updatedInvoice.id, `Membatalkan invoice ${updatedInvoice.invoiceNumber}`);
  await notifyUser(invoice.customerId ? (await prisma.customer.findUnique({ where: { id: invoice.customerId }, select: { userId: true } }))?.userId : null, 'Invoice dibatalkan', `Invoice ${updatedInvoice.invoiceNumber} telah dibatalkan.`, 'invoice');
  revalidatePath('/billing');
  revalidatePath('/portal/invoices');
  revalidatePath('/dashboard');

  return { success: true, invoice: updatedInvoice };
}

export async function getStaffBillingSummary() {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang mengakses ringkasan ini.' };
  }

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const invoiceCount = await prisma.invoice.count({
    where: {
      date: { gte: start, lt: end },
      status: { not: 'CANCELLED' },
    },
  });

  const revenueResult = await prisma.invoice.aggregate({
    _sum: { totalAmount: true },
    where: { date: { gte: start, lt: end }, status: 'PAID' },
  });

  return { success: true, invoiceCount, revenueToday: revenueResult._sum.totalAmount ?? 0 };
}

export async function getPortalInvoices() {
  const session = await auth();
  const actorId = getActorId(session);

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const customer = await getCustomerForSession(actorId);
  if (!customer) {
    return { success: false, message: 'Data pelanggan tidak ditemukan.' };
  }

  const invoices = await prisma.invoice.findMany({
    where: { customerId: customer.id },
    orderBy: { date: 'desc' },
    include: {
      items: true,
      payments: true,
    },
  });

  return { success: true, invoices };
}

export async function getPortalInvoiceSummary() {
  const session = await auth();
  const actorId = getActorId(session);

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const customer = await getCustomerForSession(actorId);
  if (!customer) {
    return { success: false, message: 'Data pelanggan tidak ditemukan.' };
  }

  const unpaidCount = await prisma.invoice.count({
    where: { customerId: customer.id, status: { in: ['UNPAID', 'PARTIAL_PAYMENT'] } } ,
  });

  return { success: true, unpaidCount };
}
