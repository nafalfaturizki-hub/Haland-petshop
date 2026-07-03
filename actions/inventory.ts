'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const stockMovementSchema = z.object({
  productId: z.string().trim().min(1, 'Produk wajib dipilih.'),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'RETURN', 'DAMAGED', 'EXPIRED', 'CORRECTION']),
  quantity: z.coerce.number().int().min(0, 'Jumlah tidak boleh negatif.'),
  note: z.string().trim().max(1000).optional().or(z.literal('')),
});

function getActorRole(session: Awaited<ReturnType<typeof auth>>) {
  return (session?.user as { role?: string } | undefined)?.role;
}

function getActorId(session: Awaited<ReturnType<typeof auth>>) {
  return session?.user?.id;
}

function isStaff(role?: string) {
  return role === 'OWNER' || role === 'ADMIN_KLINIK';
}

function normalizeOptionalText(value: string | undefined | null) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function createAuditLog(userId: string, action: string, entity: string, entityId: string | null, description: string | null) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      description,
    },
  });
}

export async function listInventory() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || !isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melihat data ini.' };
  }

  const products = await prisma.product.findMany({
    where: { isArchived: false },
    orderBy: { name: 'asc' },
    include: {
      category: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  });

  return { success: true, products };
}

export async function recordStockMovement(input: z.infer<typeof stockMovementSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = stockMovementSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId || !isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang mencatat pergerakan stok.' };
  }

  if (parsed.data.quantity <= 0 && parsed.data.type !== 'ADJUSTMENT') {
    return { success: false, message: 'Jumlah pergerakan harus lebih besar dari nol.' };
  }

  const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product || product.isArchived || product.status === 'ARCHIVED') {
    return { success: false, message: 'Produk tidak aktif untuk perubahan stok.' };
  }

  let newStock = product.stock;
  let movementType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN' | 'DAMAGED' | 'EXPIRED' | 'CORRECTION' = parsed.data.type;

  switch (movementType) {
    case 'IN':
    case 'RETURN':
      newStock += parsed.data.quantity;
      break;
    case 'ADJUSTMENT':
      newStock = parsed.data.quantity;
      break;
    case 'OUT':
    case 'DAMAGED':
    case 'EXPIRED':
    case 'CORRECTION':
      if (product.stock < parsed.data.quantity) {
        return { success: false, message: 'Stok tidak mencukupi untuk pergerakan ini.' };
      }
      newStock -= parsed.data.quantity;
      break;
  }

  const movement = await prisma.$transaction(async (tx) => {
    const updatedProduct = await tx.product.update({
      where: { id: parsed.data.productId },
      data: { stock: newStock },
    });

    const createdMovement = await tx.stockMovement.create({
      data: {
        productId: parsed.data.productId,
        type: parsed.data.type,
        quantity: parsed.data.quantity,
        note: normalizeOptionalText(parsed.data.note),
      },
    });

    await createAuditLog(actorId, 'STOCK_MOVEMENT', 'Product', updatedProduct.id, `${parsed.data.type} stok ${createdMovement.quantity} unit`);

    return { updatedProduct, createdMovement };
  });

  revalidatePath('/petshop/inventory');
  revalidatePath('/petshop/products');
  return { success: true, newStock, movement };
}

export async function listStockMovements(productId: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || !isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melihat data ini.' };
  }

  const movements = await prisma.stockMovement.findMany({
    where: { productId },
    orderBy: { date: 'desc' },
  });

  return { success: true, movements };
}

export async function getLowStockSummary() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || !isStaff(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melihat data ini.' };
  }

  const products = await prisma.product.findMany({
    where: { isArchived: false, status: 'ACTIVE' },
    orderBy: { stock: 'asc' },
  });

  const lowStockProducts = products.filter((p) => p.stock <= p.minStock);

  return { success: true, lowStockCount: lowStockProducts.length };
}
