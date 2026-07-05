'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createNotification } from '@/actions/notification';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isStaffRole } from '@/lib/permissions';
import { calculatePosTotals, getPaymentStatus, roundCurrency } from '@/lib/pos';
import { getActorRole } from '@/lib/utils';

const productSearchSchema = z.object({
  query: z.string().trim().min(1, 'Pencarian tidak boleh kosong.'),
});

const createPosSaleSchema = z.object({
  customerId: z.string().trim().min(1, 'Pilih pelanggan terlebih dahulu.'),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1, 'Produk tidak valid.'),
        qty: z.coerce.number().int().positive('Kuantitas harus lebih dari nol.'),
        price: z.coerce.number().min(0, 'Harga tidak boleh negatif.'),
        description: z.string().trim().min(1, 'Deskripsi produk wajib diisi.'),
      }),
    )
    .min(1, 'Keranjang tidak boleh kosong.'),
  discountAmount: z.coerce.number().min(0, 'Diskon tidak boleh negatif.').optional(),
  paymentMethod: z.enum(['CASH', 'NON_CASH'], { errorMap: () => ({ message: 'Metode pembayaran tidak valid.' }) }),
  paymentAmount: z.coerce.number().min(0, 'Jumlah pembayaran tidak boleh negatif.'),
  taxRate: z.coerce.number().min(0, 'Pajak tidak boleh negatif.').optional(),
});



function normalizeSearchQuery(query: string) {
  return query.trim().toLowerCase();
}

export async function searchProducts(input: z.infer<typeof productSearchSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = productSearchSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Query pencarian tidak valid.' };
  }

  if (!isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang mencari produk.' };
  }

  const normalizedQuery = normalizeSearchQuery(parsed.data.query);

  const products = await prisma.product.findMany({
    where: {
      isArchived: false,
      status: 'ACTIVE',
      OR: [
        { name: { contains: normalizedQuery, mode: 'insensitive' } },
        { sku: { contains: normalizedQuery, mode: 'insensitive' } },
        { barcode: { contains: normalizedQuery, mode: 'insensitive' } },
        { brand: { contains: normalizedQuery, mode: 'insensitive' } },
        { description: { contains: normalizedQuery, mode: 'insensitive' } },
      ],
    },
    orderBy: { name: 'asc' },
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
    take: 20,
  });

  const result = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    sellPrice: product.sellPrice,
    stock: product.stock,
    categoryName: product.category?.name ?? null,
    imageUrl: product.imageUrl,
  }));

  return { success: true, products: result };
}

export async function createPosSale(input: z.infer<typeof createPosSaleSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = session?.user?.id;
  const parsed = createPosSaleSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data transaksi tidak valid.' };
  }

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melakukan penjualan POS.' };
  }

  const customer = await prisma.customer.findUnique({ where: { id: parsed.data.customerId } });
  if (!customer) {
    return { success: false, message: 'Pelanggan tidak ditemukan.' };
  }

  const items = parsed.data.items;

  const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    const invoiceResult = await prisma.$transaction(async (tx) => {
      const productLookups = await Promise.all(
        items.map((item) => tx.product.findUnique({ where: { id: item.productId } })),
      );

      const validatedItems = items.map((item, index) => {
        const product = productLookups[index];
        if (!product) {
          throw new Error(`Produk ${item.description} tidak ditemukan.`);
        }

        if (product.stock < item.qty) {
          throw new Error(`Stok produk ${product.name} tidak cukup.`);
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
      const taxRate = parsed.data.taxRate ?? 0;
      const totals = calculatePosTotals(subtotal, parsed.data.discountAmount ?? 0, taxRate);

      if (parsed.data.paymentAmount < totals.totalAmount) {
        throw new Error('Jumlah pembayaran kurang dari total transaksi.');
      }

      const status = getPaymentStatus(parsed.data.paymentAmount, totals.totalAmount);

      const createdInvoice = await tx.invoice.create({
        data: {
          customerId: parsed.data.customerId,
          invoiceNumber,
          status,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxRate: totals.taxRate,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
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
              method: parsed.data.paymentMethod,
              amount: roundCurrency(parsed.data.paymentAmount),
            },
          },
        },
        include: {
          customer: true,
          items: true,
          payments: true,
        },
      });

      for (const item of validatedItems) {
        const result = await tx.product.updateMany({
          where: { id: item.product.id, stock: { gte: item.qty } },
          data: { stock: { decrement: item.qty } },
        });

        if (result.count === 0) {
          throw new Error('Stok produk tidak mencukupi atau berubah, transaksi dibatalkan.');
        }

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
          userId: actorId,
          action: 'CREATE',
          entity: 'Invoice',
          entityId: createdInvoice.id,
          description: `Penjualan POS ${invoiceNumber}`,
        },
      });

      return { invoice: createdInvoice, totals };
    });

    const { invoice, totals } = invoiceResult;

    const customerUser = await prisma.customer.findUnique({ where: { id: parsed.data.customerId }, select: { userId: true } });
    await createNotification({
      userId: customerUser?.userId ?? actorId,
      title: 'Penjualan POS selesai',
      message: `Transaksi ${invoice.invoiceNumber} berhasil dicatat.`,
      type: 'pos',
    }).catch(() => undefined);

    revalidatePath('/pos');
    revalidatePath('/billing');
    revalidatePath('/dashboard');
    revalidatePath('/portal/invoices');

    return {
      success: true,
      invoice,
      changeAmount: roundCurrency(parsed.data.paymentAmount - totals.totalAmount),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transaksi POS gagal.';
    return { success: false, message };
  }
}
