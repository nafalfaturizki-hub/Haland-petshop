import { Prisma } from '@prisma/client';

export type StockDeductionItem = { productId: string; qty: number };

export async function validateStockAvailability(
  tx: Prisma.TransactionClient,
  items: StockDeductionItem[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  for (const item of items) {
    const product = await tx.product.findUnique({ where: { id: item.productId } });
    if (!product) {
      return { ok: false, message: `Produk tidak ditemukan.` };
    }
    if (product.stock < item.qty) {
      return {
        ok: false,
        message: `Stok produk "${product.name}" tidak mencukupi (tersedia: ${product.stock}, diminta: ${item.qty}).`,
      };
    }
  }
  return { ok: true };
}

export async function deductProductStock(
  tx: Prisma.TransactionClient,
  items: StockDeductionItem[],
): Promise<{ ok: true } | { ok: false; productId: string }> {
  for (const item of items) {
    const result = await tx.product.updateMany({
      where: { id: item.productId, stock: { gte: item.qty } },
      data: { stock: { decrement: item.qty } },
    });
    if (result.count === 0) {
      return { ok: false, productId: item.productId };
    }
  }
  return { ok: true };
}

export async function restoreProductStock(
  tx: Prisma.TransactionClient,
  items: StockDeductionItem[],
): Promise<void> {
  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.qty } },
    });
  }
}
