import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFinalTotal, validateDiscount, validateStockAvailabilityForCheckout } from '../lib/pos-validation';

test('validateDiscount rejects negative and excessive percentage discounts', () => {
  assert.equal(validateDiscount({ discountType: 'PERCENTAGE', discountAmount: -5, subtotal: 100000 }).ok, false);
  assert.equal(validateDiscount({ discountType: 'PERCENTAGE', discountAmount: 101, subtotal: 100000 }).ok, false);
  assert.equal(validateDiscount({ discountType: 'FIXED', discountAmount: 150000, subtotal: 100000 }).ok, false);
});

test('calculateFinalTotal computes discounted total and tax correctly', () => {
  const result = calculateFinalTotal({
    subtotal: 100000,
    discountType: 'PERCENTAGE',
    discountAmount: 10,
    taxRate: 10,
  });

  assert.equal(result.discountAmount, 10000);
  assert.equal(result.taxAmount, 9000);
  assert.equal(result.totalAmount, 99000);
});

test('validateStockAvailabilityForCheckout rejects when requested quantity exceeds stock', () => {
  const result = validateStockAvailabilityForCheckout(
    [{ productId: 'p1', qty: 3 }],
    { p1: 2 },
  );

  assert.equal(result.ok, false);
  assert.equal(result.message, 'Stok produk tidak mencukupi untuk beberapa item.');
});
