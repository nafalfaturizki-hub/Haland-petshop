'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma, getOrCreateGuestCustomer } from '@/lib/db';
import { canPerformAction, enforceActionPermission, getPermissionDeniedAuditDescription, isStaffRole } from '@/lib/permissions';
import { getAuthorizedRoutes } from '@/lib/permission-matrix';
import { notifyUser } from '@/lib/notifications-helper';
import { calculatePosTotals, getPaymentStatus, roundCurrency, validatePosCheckout } from '@/lib/pos';
import { calculateFinalTotal, posCheckoutPayloadSchema, validateDiscount, validateStockAvailabilityForCheckout } from '@/lib/pos-validation';
import { getActorRole } from '@/lib/utils';
import { generateInvoiceNumber } from '@/lib/numbering';
import { deductProductStock, validateStockAvailability } from '@/lib/inventory-helpers';

const productSearchSchema = z.object({
  query: z.string().trim().min(1, 'Pencarian tidak boleh kosong.'),
});

const listPosProductsSchema = z.object({
  categoryId: z.string().trim().optional().or(z.literal('')),
  query: z.string().trim().optional().or(z.literal('')),
  skip: z.coerce.number().int().min(0).optional(),
  take: z.coerce.number().int().min(1).optional(),
});

const createPosSaleSchema = posCheckoutPayloadSchema;

const getPosTransactionHistorySchema = z.object({
  startDate: z.string().trim().optional().or(z.literal('')),
  endDate: z.string().trim().optional().or(z.literal('')),
  customerId: z.string().trim().optional().or(z.literal('')),
  cashierId: z.string().trim().optional().or(z.literal('')),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(10),
});

function normalizeSearchQuery(query: string) {
  return query.trim().toLowerCase();
}

function mapProductResult(product: { id: string; name: string; sku: string | null; barcode: string | null; sellPrice: number; stock: number; category: { name: string } | null; imageUrl: string | null; }) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    sellPrice: product.sellPrice,
    stock: product.stock,
    categoryName: product.category?.name ?? null,
    imageUrl: product.imageUrl,
  };
}

export async function listPosProducts(input: z.infer<typeof listPosProductsSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = listPosProductsSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data produk tidak valid.' };
  }

  if (!canPerformAction(actorRole, 'pos', 'read')) {
    return { success: false, message: 'Anda tidak berwenang mencari produk.' };
  }

  const normalizedQuery = normalizeSearchQuery(parsed.data.query ?? '');
  const categoryId = parsed.data.categoryId?.trim() || undefined;
  const shouldSearch = Boolean(normalizedQuery);

  const whereClause: any = {
    isArchived: false,
    status: 'ACTIVE',
    ...(categoryId ? { categoryId } : {}),
  };

  if (shouldSearch) {
    whereClause.OR = [
      { name: { contains: normalizedQuery, mode: 'insensitive' } },
      { sku: { contains: normalizedQuery, mode: 'insensitive' } },
      { barcode: { contains: normalizedQuery, mode: 'insensitive' } },
      { brand: { contains: normalizedQuery, mode: 'insensitive' } },
      { description: { contains: normalizedQuery, mode: 'insensitive' } },
    ];
  }

  const products = await prisma.product.findMany({
    where: whereClause,
    orderBy: [
      { createdAt: 'desc' },
      { name: 'asc' },
    ],
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      sellPrice: true,
      stock: true,
      category: { select: { name: true } },
      imageUrl: true,
    },
    skip: parsed.data.skip ?? 0,
    take: parsed.data.take ?? 24,
  });

  return { success: true, products: products.map(mapProductResult) };
}

export async function listProductCategories() {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!canPerformAction(actorRole, 'pos', 'read') || !getAuthorizedRoutes(actorRole).includes('pos')) {
    return { success: false, message: 'Anda tidak berwenang mengakses kategori produk.' };
  }

  const categories = await prisma.productCategory.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      _count: { select: { products: true } },
    },
  });

  return {
    success: true,
    categories: categories.map((category: any) => ({
      id: category.id,
      name: category.name,
      activeProductCount: category._count.products,
    })),
  };
}

export async function searchProducts(input: z.infer<typeof productSearchSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = productSearchSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Query pencarian tidak valid.' };
  }

  if (!canPerformAction(actorRole, 'pos', 'read')) {
    return { success: false, message: 'Anda tidak berwenang mencari produk.' };
  }

  const result = await listPosProducts({ query: parsed.data.query, take: 24 });
  return result;
}

export async function validatePosSale(input: z.infer<typeof createPosSaleSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = session?.user?.id;
  const parsed = createPosSaleSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false as const, message: parsed.error.issues[0]?.message ?? 'Data transaksi tidak valid.' };
  }

  const permissionCheck = await enforceActionPermission({
    role: actorRole,
    actorId,
    module: 'pos',
    action: 'create',
    denyMessage: 'Anda tidak berwenang melakukan penjualan POS.',
    logDenied: async () => {
      await prisma.auditLog.create({
        data: {
          userId: actorId ?? 'unknown',
          action: 'PERMISSION_DENIED',
          entity: 'PosSale',
          entityId: 'pos-sale-denied',
          description: getPermissionDeniedAuditDescription(actorRole, 'pos', 'create'),
        },
      });
    },
  });

  if (!permissionCheck.allowed) {
    return { success: false as const, message: permissionCheck.message };
  }

  const subtotal = roundCurrency(parsed.data.items.reduce((sum, item) => sum + (item.price * item.qty), 0));
  const discountValue = parsed.data.discountAmount ?? 0;
  const discountValidation = validateDiscount({ discountType: parsed.data.discountType, discountAmount: discountValue, subtotal });
  if (!discountValidation.ok) {
    return { success: false as const, message: discountValidation.message };
  }

  const totals = calculateFinalTotal({ subtotal, discountType: parsed.data.discountType, discountAmount: discountValue, taxRate: parsed.data.taxRate ?? 0 });
  const validation = validatePosCheckout({
    customerId: parsed.data.customerId ?? '',
    walkInName: parsed.data.walkInName ?? '',
    items: parsed.data.items.map((item) => ({ qty: item.qty, price: item.price })),
    discountType: parsed.data.discountType,
    discountAmount: discountValue,
    paymentMethod: parsed.data.paymentMethod,
    paymentAmount: parsed.data.paymentAmount,
    subtotal,
    taxRate: parsed.data.taxRate ?? 0,
  });

  if (!validation.ok) {
    return { success: false as const, message: validation.message };
  }

  const stockValidation = validateStockAvailabilityForCheckout(
    parsed.data.items.map((item) => ({ qty: item.qty, productId: item.productId })),
    Object.fromEntries((await prisma.product.findMany({ where: { id: { in: parsed.data.items.map((item) => item.productId) } }, select: { id: true, stock: true } })).map((product: any) => [product.id, product.stock])),
  );

  if (!stockValidation.ok) {
    return { success: false as const, message: stockValidation.message };
  }

  return {
    success: true as const,
    actorRole,
    actorId,
    parsedData: parsed.data,
    subtotal,
    totals,
  };
}

export async function createPosSale(input: z.infer<typeof createPosSaleSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = session?.user?.id;

  try {
    const validation = await validatePosSale(input);
    if (!validation.success) {
      return { success: false, message: validation.message };
    }

    const parsed = validation.parsedData;
    const hasManualBuyer = Boolean(parsed.walkInName?.trim());
    const hasSelectedCustomer = Boolean(parsed.customerId?.trim());
    const subtotal = validation.subtotal;
    const discountValue = parsed.discountAmount ?? 0;
    const computedTotals = validation.totals;

    let resolvedCustomerId: string;
    if (hasManualBuyer && !hasSelectedCustomer) {
      const guestCustomer = await getOrCreateGuestCustomer();
      resolvedCustomerId = guestCustomer.id;
    } else {
      const customer = await prisma.customer.findUnique({ where: { id: parsed.customerId! } });
      if (!customer) {
        return { success: false, message: 'Pelanggan tidak ditemukan.' };
      }
      resolvedCustomerId = customer.id;
    }

    const items = parsed.items;
    const invoiceNumber = await generateInvoiceNumber();
    const productStockDeductionItems = items.map((item) => ({ productId: item.productId, qty: item.qty }));

    if (productStockDeductionItems.length > 0) {
      const stockAvailability = await validateStockAvailability(prisma as any, productStockDeductionItems);
      if (!stockAvailability.ok) {
        return { success: false, message: stockAvailability.message };
      }
    }

    const invoiceResult = await prisma.$transaction(async (tx: any) => {
      const productLookups = await Promise.all(
        items.map((item) => tx.product.findUnique({ where: { id: item.productId } })),
      );

      const validatedItems = items.map((item, index) => {
        const product = productLookups[index];
        if (!product) {
          throw new Error(`Produk ${item.description} tidak ditemukan.`);
        }

        if (roundCurrency(item.price) !== roundCurrency(product.sellPrice)) {
          throw new Error(`Harga produk ${product.name} sudah berubah. Segarkan halaman dan coba lagi.`);
        }

        return {
          product,
          qty: item.qty,
          description: item.description,
          price: product.sellPrice,
          subtotal: roundCurrency(item.qty * product.sellPrice),
        };
      });

      const subtotal = roundCurrency(validatedItems.reduce((sum, item) => sum + item.subtotal, 0));
      const taxRate = parsed.taxRate ?? 0;
      const discountValue = parsed.discountAmount ?? 0;
      const transactionTotals = calculateFinalTotal({ subtotal, discountType: parsed.discountType, discountAmount: discountValue, taxRate });

      const status = getPaymentStatus(parsed.paymentAmount, transactionTotals.totalAmount);

      const createdInvoice = await tx.invoice.create({
        data: {
          customerId: resolvedCustomerId,
          walkInName: hasManualBuyer ? parsed.walkInName?.trim() : null,
          createdById: actorId ?? null,
          invoiceNumber,
          status,
          subtotal: transactionTotals.subtotal,
          discountAmount: transactionTotals.discountAmount,
          taxRate: transactionTotals.taxRate,
          taxAmount: transactionTotals.taxAmount,
          totalAmount: transactionTotals.totalAmount,
          items: {
            create: validatedItems.map((item) => ({
              type: 'PRODUK',
              description: item.description,
              qty: item.qty,
              price: item.price,
              subtotal: item.subtotal,
              productId: item.product.id,
            })),
          },
          payments: {
            create: {
              method: parsed.paymentMethod,
              amount: roundCurrency(parsed.paymentAmount),
            },
          },
        },
        include: {
          customer: true,
          items: true,
          payments: true,
        },
      });

      const deductionResult = await deductProductStock(tx, productStockDeductionItems);
      if (!deductionResult.ok) {
        throw new Error('Stok produk berubah, transaksi dibatalkan.');
      }

      for (const item of validatedItems) {
        await tx.stockMovement.create({
          data: {
            productId: item.product.id,
            type: 'OUT',
            quantity: item.qty,
            note: `Penjualan POS - ${invoiceNumber}`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actorId ?? 'unknown',
          action: 'CREATE',
          entity: 'Invoice',
          entityId: createdInvoice.id,
          description: `Penjualan POS ${invoiceNumber}`,
        } as any,
      });

      return { invoice: createdInvoice, totals: transactionTotals };
    });

    const { invoice, totals: invoiceTotals } = invoiceResult;

    const customerUser = await prisma.customer.findUnique({ where: { id: resolvedCustomerId }, select: { userId: true } });
    await notifyUser(customerUser?.userId ?? actorId, 'Penjualan POS selesai', `Transaksi ${invoice.invoiceNumber} berhasil dicatat.`, 'pos');

    revalidatePath('/pos');
    revalidatePath('/billing');
    revalidatePath('/dashboard');
    revalidatePath('/portal/invoices');

    return {
      success: true,
      invoice,
      receiptHtml: generateReceiptHTML({ invoice, customerName: invoice.walkInName?.trim() || 'Pelanggan' }),
      changeAmount: roundCurrency(parsed.paymentAmount - invoiceTotals.totalAmount),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transaksi POS gagal.';
    return { success: false, message: message || 'Terjadi kesalahan saat memproses transaksi.' };
  }
}

export function generateReceiptHTML(input: { invoice: any; customerName: string }) {
  const lines = (input.invoice.items ?? []).map((item: any) => `
    <tr>
      <td>${item.description}</td>
      <td>${item.qty}</td>
      <td>${item.price.toLocaleString('id-ID')}</td>
      <td>${item.subtotal.toLocaleString('id-ID')}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
  <html>
    <head><meta charset="utf-8" /><title>Struk ${input.invoice.invoiceNumber}</title></head>
    <body style="font-family: Arial, sans-serif; padding: 24px; color: #111;">
      <h2>Struk Penjualan</h2>
      <p><strong>No. Invoice:</strong> ${input.invoice.invoiceNumber}</p>
      <p><strong>Pelanggan:</strong> ${input.customerName}</p>
      <p><strong>Tanggal:</strong> ${new Date(input.invoice.date).toLocaleString('id-ID')}</p>
      <table style="width:100%; border-collapse:collapse; margin-top: 12px;">
        <thead>
          <tr><th style="text-align:left; border-bottom:1px solid #ccc; padding:8px;">Produk</th><th style="text-align:left; border-bottom:1px solid #ccc; padding:8px;">Qty</th><th style="text-align:left; border-bottom:1px solid #ccc; padding:8px;">Harga</th><th style="text-align:left; border-bottom:1px solid #ccc; padding:8px;">Subtotal</th></tr>
        </thead>
        <tbody>${lines}</tbody>
      </table>
      <p style="margin-top: 12px;"><strong>Subtotal:</strong> ${input.invoice.subtotal.toLocaleString('id-ID')}</p>
      <p><strong>Diskon:</strong> ${input.invoice.discountAmount.toLocaleString('id-ID')}</p>
      <p><strong>Pajak:</strong> ${input.invoice.taxAmount.toLocaleString('id-ID')}</p>
      <p><strong>Total:</strong> ${input.invoice.totalAmount.toLocaleString('id-ID')}</p>
      <p><strong>Status:</strong> ${input.invoice.status}</p>
    </body>
  </html>`;
}

export async function createPosSaleWithRetry(input: z.infer<typeof createPosSaleSchema>) {
  let lastResult: { success: boolean; message?: string; invoice?: any; receiptHtml?: string; changeAmount?: number } | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await createPosSale(input);
    lastResult = result;
    if (result.success) {
      return result;
    }

    if (attempt === 1) {
      break;
    }
  }

  return lastResult ?? { success: false, message: 'Transaksi POS gagal.' };
}

export async function getPosTransactionHistory(input: z.infer<typeof getPosTransactionHistorySchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = session?.user?.id;
  const parsed = getPosTransactionHistorySchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Parameter riwayat transaksi tidak valid.' };
  }

  if (!actorId || !canPerformAction(actorRole, 'pos', 'read') || !getAuthorizedRoutes(actorRole).includes('pos')) {
    return { success: false, message: 'Anda tidak berwenang melihat riwayat transaksi.' };
  }

  const page = parsed.data.page ?? 1;
  const pageSize = parsed.data.pageSize ?? 10;
  const where: any = {
    appointmentId: null,
    medicalRecordId: null,
  };

  if (parsed.data.startDate || parsed.data.endDate) {
    where.date = {};
    if (parsed.data.startDate) {
      where.date.gte = new Date(parsed.data.startDate);
    }
    if (parsed.data.endDate) {
      const endDate = new Date(parsed.data.endDate);
      endDate.setHours(23, 59, 59, 999);
      where.date.lte = endDate;
    }
  }

  if (parsed.data.customerId) {
    where.customerId = parsed.data.customerId;
  }

  if (parsed.data.cashierId) {
    where.createdById = parsed.data.cashierId;
  }

  const [totalCount, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { name: true, isGuest: true } },
        items: true,
        payments: true,
      },
    }),
  ]);

  const cashierIds = [...new Set(invoices.map((invoice: any) => invoice.createdById).filter(Boolean) as string[])];
  const cashiers = cashierIds.length > 0 ? await prisma.user.findMany({
    where: { id: { in: cashierIds } },
    select: { id: true, name: true },
  }) : [];
  const cashierMap = new Map(cashiers.map((cashier: any) => [cashier.id, cashier.name]));

  const transactions = invoices.map((invoice: any) => {
    const itemCount = invoice.items.reduce((sum: number, item: any) => sum + item.qty, 0);
    const paymentMethod = invoice.payments[0]?.method ?? 'NON_CASH';

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.date,
      customerName: invoice.walkInName?.trim() || invoice.customer?.name || 'Pelanggan',
      cashierName: invoice.createdById ? cashierMap.get(invoice.createdById) ?? 'Kasir' : '—',
      itemCount,
      totalAmount: invoice.totalAmount,
      status: invoice.status,
      paymentMethod,
      paymentAmount: invoice.payments.reduce((sum: number, payment: any) => sum + payment.amount, 0),
    };
  });

  return {
    success: true,
    transactions,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    },
  };
}

export async function getPosTransactionDetail(invoiceId: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = session?.user?.id;

  if (!actorId || !canPerformAction(actorRole, 'pos', 'read') || !getAuthorizedRoutes(actorRole).includes('pos')) {
    return { success: false, message: 'Anda tidak berwenang melihat detail transaksi.' };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: { select: { name: true, isGuest: true } },
      items: true,
      payments: true,
    },
  });

  if (!invoice) {
    return { success: false, message: 'Transaksi tidak ditemukan.' };
  }

  return {
    success: true,
    invoice: {
      ...invoice,
      customerName: invoice.walkInName?.trim() || invoice.customer?.name || 'Pelanggan',
      itemCount: invoice.items.reduce((sum: number, item: any) => sum + item.qty, 0),
      paymentMethod: invoice.payments[0]?.method ?? 'NON_CASH',
      paymentAmount: invoice.payments.reduce((sum: number, payment: any) => sum + payment.amount, 0),
    },
  };
}
