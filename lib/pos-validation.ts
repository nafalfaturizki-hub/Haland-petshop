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

export type CheckoutItem = { productId?: string; qty: number; price: number };

export type CheckoutValidationInput = {
  buyerMode?: 'REGISTERED' | 'MANUAL';
  customerId: string;
  walkInName: string;
  items: CheckoutItem[];
  discountType: 'PERCENTAGE' | 'FIXED';
  discountAmount: number;
  paymentMethod: 'CASH' | 'NON_CASH';
  paymentAmount: number;
  subtotal: number;
  taxRate: number;
  stockByProductId?: Record<string, number>;
};

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

export function validateBeforeCheckout(input: CheckoutValidationInput) {
  const normalizedItems = input.items.filter((item) => item.qty > 0);
  const hasManualBuyer = Boolean(input.walkInName?.trim());
  const hasSelectedCustomer = Boolean(input.customerId?.trim());

  if (normalizedItems.length === 0) {
    return { ok: false as const, message: 'Keranjang kosong.' };
  }

  if (input.buyerMode === 'REGISTERED' && !hasSelectedCustomer) {
    return { ok: false as const, message: 'Pilih pelanggan terdaftar atau beralih ke input manual.' };
  }

  if (input.buyerMode === 'MANUAL' && !hasManualBuyer) {
    return { ok: false as const, message: 'Isi nama pembeli manual.' };
  }

  if (!hasManualBuyer && !hasSelectedCustomer) {
    return { ok: false as const, message: 'Pelanggan wajib dipilih atau isi nama pembeli manual.' };
  }

  const discountValidation = validateDiscount({
    discountType: input.discountType,
    discountAmount: input.discountAmount,
    subtotal: input.subtotal,
  });

  if (!discountValidation.ok) {
    return { ok: false as const, message: discountValidation.message };
  }

  if (input.paymentMethod === 'CASH') {
    const totals = calculateFinalTotal({
      subtotal: input.subtotal,
      discountType: input.discountType,
      discountAmount: input.discountAmount,
      taxRate: input.taxRate,
    });

    if (input.paymentAmount < totals.totalAmount) {
      return { ok: false as const, message: 'Jumlah pembayaran kurang dari total transaksi.' };
    }
  }

  // F6: Final total must be greater than zero. Reject over-discounted carts
  // (e.g. discount that zeroes out or inverts the bill).
  const finalTotals = calculateFinalTotal({
    subtotal: input.subtotal,
    discountType: input.discountType,
    discountAmount: input.discountAmount,
    taxRate: input.taxRate,
  });

  if (finalTotals.totalAmount <= 0) {
    return { ok: false as const, message: 'Total tagihan harus lebih dari nol. Periksa kembali diskon yang diterapkan.' };
  }

  if (input.stockByProductId) {
    const stockItems = normalizedItems.filter((item): item is CheckoutItem & { productId: string } => Boolean(item.productId));
    const stockValidation = validateStockAvailabilityForCheckout(
      stockItems.map((item) => ({ productId: item.productId, qty: item.qty })),
      input.stockByProductId,
    );

    if (!stockValidation.ok) {
      return stockValidation;
    }
  }

  return { ok: true as const };
}

export function validatePosCheckout(input: CheckoutValidationInput) {
  return validateBeforeCheckout(input);
}
