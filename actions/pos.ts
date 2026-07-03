'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { calculatePosTotals, getPaymentStatus, roundCurrency } from '@/lib/pos';

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

function getActorRole(session: Awaited<ReturnType<typeof auth>>) {
  return (session?.user as { role?: string } | undefined)?.role;
}

function isStaff(role?: string) {
  return role === 'OWNER' || role === 'ADMIN_KLINIK';
}

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

  if (!isStaff(actorRole)) {
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

  if (!actorId || !isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melakukan penjualan POS.' };
  }

  const customer = await prisma.customer.findUnique({ where: { id: parsed.data.customerId } });
  if (!customer) {
    return { success: false, message: 'Pelanggan tidak ditemukan.' };
  }

  const items = parsed.data.items;
  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.qty * item.price, 0));
  const taxRate = parsed.data.taxRate ?? 0;
  const totals = calculatePosTotals(subtotal, parsed.data.discountAmount ?? 0, taxRate);

  if (parsed.data.paymentAmount < totals.totalAmount) {
    return { success: false, message: 'Jumlah pembayaran kurang dari total transaksi.' };
  }

  const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const status = getPaymentStatus(parsed.data.paymentAmount, totals.totalAmount);

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const productLookups = await Promise.all(
        items.map((item) => tx.product.findUnique({ where: { id: item.productId } })),
      );

      for (let index = 0; index < productLookups.length; index += 1) {
        const product = productLookups[index];
        const item = items[index];

        if (!product) {
          throw new Error(`Produk ${item.description} tidak ditemukan.`);
        }

        if (product.stock < item.qty) {
          throw new Error(`Stok produk ${product.name} tidak cukup.`);
        }
      }

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
            create: items.map((item) => ({
              type: 'PRODUK',
              description: item.description,
              qty: item.qty,
              price: item.price,
              subtotal: roundCurrency(item.qty * item.price),
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

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          throw new Error(`Produk ${item.description} tidak ditemukan.`);
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: product.stock - item.qty },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
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

      return createdInvoice;
    });

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
