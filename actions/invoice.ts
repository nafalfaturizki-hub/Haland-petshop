'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createNotification } from '@/actions/notification';
import { auth } from '@/lib/auth';
import { prisma, createAuditLog, getCustomerForSession } from '@/lib/db';
import { isStaffRole } from '@/lib/permissions';
import { getActorRole, getActorId, roundCurrency, normalizeOptionalText } from '@/lib/utils';

const invoiceItemSchema = z.object({
  type: z.enum(['KONSULTASI', 'TINDAKAN', 'OBAT', 'PET_HOTEL', 'PRODUK']),
  description: z.string().trim().min(1, 'Deskripsi item wajib diisi.'),
  qty: z.coerce.number().int().min(1, 'Kuantitas minimal 1.'),
  price: z.coerce.number().min(0, 'Harga tidak boleh negatif.'),
  productId: z.string().trim().optional().or(z.literal('')),
  procedureId: z.string().trim().optional().or(z.literal('')),
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

async function notifyInvoiceChange(userId: string | null | undefined, title: string, message: string) {
  if (!userId) {
    return;
  }

  try {
    await createNotification({ userId, title, message, type: 'invoice' });
  } catch {
    // ignore notification errors so invoice workflows remain resilient
  }
}

export async function getInvoiceLookups() {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang mengakses data ini.' };
  }

  const [customers, appointments, medicalRecords, doctors, procedures] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
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

export async function listInvoices() {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melihat invoice.' };
  }

  const invoices = await prisma.invoice.findMany({
    orderBy: { date: 'desc' },
    include: {
      customer: { select: { id: true, name: true } },
      items: true,
      payments: true,
    },
  });

  return { success: true, invoices };
}

export async function getInvoiceById(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!isStaffRole(actorRole)) {
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

export async function createInvoice(input: z.infer<typeof createInvoiceSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = createInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data invoice tidak valid.' };
  }

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang membuat invoice.' };
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

  const [products, procedures] = await Promise.all([
    Promise.all(productIds.map((productId) => prisma.product.findUnique({ where: { id: productId } }))),
    Promise.all(procedureIds.map((procedureId) => prisma.procedure.findUnique({ where: { id: procedureId } }))),
  ]);

  const productsById = new Map(
    products.filter((product): product is Exclude<typeof product, null> => Boolean(product)).map((product) => [product.id, product]),
  );

  const proceduresById = new Map(
    procedures.filter((procedure): procedure is Exclude<typeof procedure, null> => Boolean(procedure)).map((procedure) => [procedure.id, procedure]),
  );

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
      };
    }

    return {
      type: item.type,
      description: item.description,
      qty: item.qty,
      price: roundCurrency(item.price),
      subtotal: roundCurrency(item.qty * item.price),
      productId: item.productId || null,
      procedureId: null,
    };
  });

  const subtotal = roundCurrency(invoiceItems.reduce((sum, item) => sum + item.subtotal, 0));
  const discountAmount = roundCurrency(Math.min(parsed.data.discountAmount ?? 0, subtotal));
  const taxRate = roundCurrency(parsed.data.taxRate ?? 0);
  const taxableAmount = roundCurrency(Math.max(0, subtotal - discountAmount));
  const taxAmount = roundCurrency(taxableAmount * (taxRate / 100));
  const totalAmount = roundCurrency(taxableAmount + taxAmount);

  if (totalAmount < 0) {
    return { success: false, message: 'Nilai tagihan tidak valid.' };
  }

  const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const initialPaymentAmount = roundCurrency(parsed.data.initialPaymentAmount ?? 0);
  const initialPaymentMethod = parsed.data.initialPaymentMethod ?? 'CASH';

  if (initialPaymentAmount > totalAmount) {
    return { success: false, message: 'Pembayaran awal tidak boleh melebihi total tagihan.' };
  }

  const status = initialPaymentAmount <= 0 ? 'UNPAID' : initialPaymentAmount >= totalAmount ? 'PAID' : 'PARTIAL_PAYMENT';

  const invoice = await prisma.$transaction(async (tx) => {
    const createdInvoice = await tx.invoice.create({
      data: {
        customerId: parsed.data.customerId,
        appointmentId: parsed.data.appointmentId || null,
        medicalRecordId: parsed.data.medicalRecordId || null,
        petId: parsed.data.petId || null,
        doctorId: parsed.data.doctorId || null,
        invoiceNumber,
        status,
        subtotal,
        discountAmount,
        taxRate,
        taxAmount,
        totalAmount,
        notes: normalizeOptionalText(parsed.data.notes),
        createdById: actorId,
        items: {
          create: invoiceItems.map((item) => ({
            type: item.type,
            description: item.description,
            qty: item.qty,
            price: item.price,
            subtotal: item.subtotal,
            productId: item.productId,
            procedureId: item.procedureId,
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

    return createdInvoice;
  });

  await createAuditLog(actorId, 'CREATE', 'Invoice', invoice.id, `Membuat invoice ${invoice.invoiceNumber}`);
  await notifyInvoiceChange(customer.userId, 'Invoice dibuat', `Invoice ${invoice.invoiceNumber} telah dibuat untuk Anda.`);
  revalidatePath('/billing');
  revalidatePath('/portal/invoices');
  revalidatePath('/dashboard');

  return { success: true, invoice };
}

export async function recordInvoicePayment(input: z.infer<typeof recordPaymentSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = recordPaymentSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data pembayaran tidak valid.' };
  }

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang mencatat pembayaran.' };
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

  const aggregate = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: { invoiceId: parsed.data.invoiceId },
  });

  const totalPaid = roundCurrency(aggregate._sum.amount ?? 0);
  const outstanding = roundCurrency(invoice.totalAmount - totalPaid);

  if (parsed.data.amount > outstanding) {
    return { success: false, message: 'Jumlah pembayaran melebihi sisa tagihan.' };
  }

  const updatedInvoice = await prisma.$transaction(async (tx) => {
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
  });

  await createAuditLog(actorId, 'PAYMENT', 'Invoice', updatedInvoice.id, `Mencatat pembayaran invoice ${updatedInvoice.invoiceNumber}`);
  await notifyInvoiceChange(invoice.customerId ? (await prisma.customer.findUnique({ where: { id: invoice.customerId }, select: { userId: true } }))?.userId : null, 'Pembayaran tercatat', `Pembayaran untuk invoice ${updatedInvoice.invoiceNumber} telah diterima.`);
  revalidatePath('/billing');
  revalidatePath('/portal/invoices');
  revalidatePath('/dashboard');

  return { success: true, invoice: updatedInvoice };
}

export async function cancelInvoice(input: z.infer<typeof cancelInvoiceSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = cancelInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang membatalkan invoice.' };
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: parsed.data.id } });
  if (!invoice) {
    return { success: false, message: 'Invoice tidak ditemukan.' };
  }

  if (invoice.status === 'CANCELLED') {
    return { success: false, message: 'Invoice sudah dibatalkan.' };
  }

  if (invoice.status === 'PAID') {
    return { success: false, message: 'Invoice yang sudah lunas tidak bisa dibatalkan.' };
  }

  const updatedInvoice = await prisma.invoice.update({
    where: { id: parsed.data.id },
    data: { status: 'CANCELLED' },
    include: { customer: true, items: true, payments: true },
  });

  await createAuditLog(actorId, 'CANCEL', 'Invoice', updatedInvoice.id, `Membatalkan invoice ${updatedInvoice.invoiceNumber}`);
  await notifyInvoiceChange(invoice.customerId ? (await prisma.customer.findUnique({ where: { id: invoice.customerId }, select: { userId: true } }))?.userId : null, 'Invoice dibatalkan', `Invoice ${updatedInvoice.invoiceNumber} telah dibatalkan.`);
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
