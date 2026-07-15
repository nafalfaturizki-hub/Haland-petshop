import { z } from 'zod';

export const posCheckoutPayloadSchema = z.object({
  customerId: z.string().trim().optional().or(z.literal('')),
  walkInName: z.string().trim().max(100).optional().or(z.literal('')),
  items: z.array(
    z.object({
      productId: z.string().trim().min(1, 'Produk tidak valid.'),
      qty: z.coerce.number().int().positive('Kuantitas harus lebih dari nol.'),
      price: z.coerce.number().min(0, 'Harga tidak boleh negatif.'),
      description: z.string().trim().min(1, 'Deskripsi produk wajib diisi.'),
    }),
  ).min(1, 'Keranjang tidak boleh kosong.'),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
  discountAmount: z.coerce.number().min(0, 'Diskon tidak boleh negatif.').optional().default(0),
  paymentMethod: z.enum(['CASH', 'NON_CASH'], { errorMap: () => ({ message: 'Metode pembayaran tidak valid.' }) }),
  paymentAmount: z.coerce.number().min(0, 'Jumlah pembayaran tidak boleh negatif.'),
  taxRate: z.coerce.number().min(0, 'Pajak tidak boleh negatif.').optional().default(0),
  subtotal: z.coerce.number().min(0, 'Subtotal tidak boleh negatif.').optional(),
});

export type PosCheckoutPayload = z.infer<typeof posCheckoutPayloadSchema>;

function normalizeCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function validateDiscount(input: { discountType: 'PERCENTAGE' | 'FIXED'; discountAmount: number; subtotal: number }) {
  if (input.discountAmount < 0) {
    return { ok: false as const, message: 'Diskon tidak boleh negatif.' };
  }

  if (input.discountType === 'PERCENTAGE') {
    if (input.discountAmount > 100) {
      return { ok: false as const, message: 'Diskon persentase tidak boleh lebih dari 100%.' };
    }

    return { ok: true as const };
  }

  if (input.discountAmount > Math.max(0, input.subtotal)) {
    return { ok: false as const, message: 'Diskon nominal tidak boleh melebihi subtotal.' };
  }

  return { ok: true as const };
}

export function calculateFinalTotal(input: { subtotal: number; discountType: 'PERCENTAGE' | 'FIXED'; discountAmount: number; taxRate: number }) {
  const normalizedSubtotal = normalizeCurrency(Math.max(0, input.subtotal));
  const normalizedDiscount = normalizeCurrency(Math.max(0, input.discountAmount));
  const discountAmount = input.discountType === 'PERCENTAGE'
    ? normalizeCurrency((normalizedSubtotal * Math.min(normalizedDiscount, 100)) / 100)
    : normalizeCurrency(Math.min(normalizedDiscount, normalizedSubtotal));
  const discountedSubtotal = normalizeCurrency(Math.max(0, normalizedSubtotal - discountAmount));
  const normalizedTaxRate = normalizeCurrency(Math.max(0, input.taxRate));
  const taxAmount = normalizeCurrency((discountedSubtotal * normalizedTaxRate) / 100);
  const totalAmount = normalizeCurrency(discountedSubtotal + taxAmount);

  return {
    subtotal: normalizedSubtotal,
    discountAmount,
    taxRate: normalizedTaxRate,
    taxAmount,
    totalAmount,
  };
}

export function validateStockAvailabilityForCheckout(
  items: Array<{ qty: number; productId: string }>,
  stockByProductId: Record<string, number>,
) {
  const insufficient = items.find((item) => (stockByProductId[item.productId] ?? 0) < item.qty);
  if (insufficient) {
    return { ok: false as const, message: 'Stok produk tidak mencukupi untuk beberapa item.' };
  }

  return { ok: true as const };
}
