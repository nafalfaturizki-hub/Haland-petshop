'use client';

import { ArrowRight, Banknote, Printer } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type CheckoutSummaryProps = {
  buyerMode: 'REGISTERED' | 'MANUAL';
  customers: Array<{ id: string; name: string }>;
  customerId: string;
  walkInName: string;
  cart: Array<{ productId: string; name: string; qty: number; price: number; stock: number }>;
  subtotal: number;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountAmount: string;
  taxRate: string;
  paymentMethod: 'CASH' | 'NON_CASH';
  paymentAmount: string;
  computedDiscount: number;
  totals: { taxAmount: number; totalAmount: number };
  paymentSummary: { changeAmount: number; shortageAmount: number; isSufficient: boolean; status: string };
  paymentError: string;
  checkoutError: string | null;
  submitting: boolean;
  createdInvoice: any | null;
  canManageSales: boolean;
  onBuyerModeChange: (mode: 'REGISTERED' | 'MANUAL') => void;
  onCustomerChange: (value: string) => void;
  onWalkInNameChange: (value: string) => void;
  onDiscountTypeChange: (type: 'PERCENTAGE' | 'FIXED') => void;
  onDiscountAmountChange: (value: string) => void;
  onTaxRateChange: (value: string) => void;
  onPaymentMethodChange: (value: 'CASH' | 'NON_CASH') => void;
  onPaymentAmountChange: (value: string) => void;
  onQuantityChange: (productId: string, qty: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onCheckout: (event?: React.FormEvent | React.MouseEvent) => void;
  onPrint: () => void;
};

export function CheckoutSummary({ buyerMode, customers, customerId, walkInName, cart, subtotal, discountType, discountAmount, taxRate, paymentMethod, paymentAmount, computedDiscount, totals, paymentSummary, paymentError, checkoutError, submitting, createdInvoice, canManageSales, onBuyerModeChange, onCustomerChange, onWalkInNameChange, onDiscountTypeChange, onDiscountAmountChange, onTaxRateChange, onPaymentMethodChange, onPaymentAmountChange, onQuantityChange, onRemoveItem, onClearCart, onCheckout, onPrint }: CheckoutSummaryProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-zinc-700">
        <Banknote className="h-4 w-4" />
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Ringkasan pembayaran</h2>
          <p className="text-sm text-zinc-500">Atur pelanggan, diskon, dan pembayaran.</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
            <button type="button" onClick={() => onBuyerModeChange('REGISTERED')} className={`rounded-full border px-3 py-2 text-sm ${buyerMode === 'REGISTERED' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700'}`}>Pelanggan terdaftar</button>
            <button type="button" onClick={() => onBuyerModeChange('MANUAL')} className={`rounded-full border px-3 py-2 text-sm ${buyerMode === 'MANUAL' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700'}`}>Input manual</button>
          </div>
          {buyerMode === 'REGISTERED' ? (
            <label className="block text-sm text-zinc-600">
              Pelanggan terdaftar
              <select value={customerId} onChange={(event) => onCustomerChange(event.target.value)} className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900">
                <option value="">Pilih pelanggan</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </label>
          ) : (
            <label className="block text-sm text-zinc-600">
              Nama pembeli
              <input type="text" value={walkInName} onChange={(event) => onWalkInNameChange(event.target.value)} placeholder="Nama pembeli" className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900" />
            </label>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-zinc-600">
                <tr><th className="px-3 py-2">Produk</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Subtotal</th><th className="px-3 py-2">Aksi</th></tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.productId} className="border-t border-zinc-200">
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2"><input type="number" min={1} max={item.stock} value={item.qty} onChange={(event) => onQuantityChange(item.productId, Number(event.target.value))} className="w-16 rounded-2xl border border-zinc-200 px-2 py-1 text-sm" /></td>
                    <td className="px-3 py-2">{formatCurrency(item.price * item.qty)}</td>
                    <td className="px-3 py-2"><button type="button" onClick={() => onRemoveItem(item.productId)} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700">Hapus</button></td>
                  </tr>
                ))}
                {cart.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-zinc-500">Keranjang kosong.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-3">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            <div className="flex items-center justify-between"><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
            <div className="mt-1 flex items-center justify-between text-sm text-zinc-600"><span>Diskon</span><span>{discountType === 'PERCENTAGE' ? `${discountAmount}%` : formatCurrency(Number(discountAmount))}</span></div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            <div className="flex items-center justify-between"><span>Diskon terhitung</span><strong>{formatCurrency(computedDiscount)}</strong></div>
            <div className="mt-1 flex items-center justify-between text-sm text-zinc-600"><span>Pajak</span><span>{formatCurrency(totals.taxAmount)}</span></div>
          </div>
          <div className="rounded-2xl bg-zinc-950 px-3 py-3 text-sm text-white">
            <div className="flex items-center justify-between"><span className="font-medium">Total</span><strong>{formatCurrency(totals.totalAmount)}</strong></div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-zinc-600">Diskon<input type="number" step="0.01" min="0" max={discountType === 'PERCENTAGE' ? 100 : undefined} value={discountAmount} onChange={(event) => onDiscountAmountChange(event.target.value)} className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900" /></label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onDiscountTypeChange('PERCENTAGE')} className={`rounded-full border px-3 py-2 text-sm ${discountType === 'PERCENTAGE' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700'}`}>%</button>
            <button type="button" onClick={() => onDiscountTypeChange('FIXED')} className={`rounded-full border px-3 py-2 text-sm ${discountType === 'FIXED' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700'}`}>Rp</button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-zinc-600">Pajak (%)<input type="number" step="0.01" min="0" value={taxRate} onChange={(event) => onTaxRateChange(event.target.value)} className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900" /></label>
          <label className="block text-sm text-zinc-600">Metode Pembayaran<select value={paymentMethod} onChange={(event) => onPaymentMethodChange(event.target.value as 'CASH' | 'NON_CASH')} className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"><option value="CASH">Tunai</option><option value="NON_CASH">Non-tunai</option></select></label>
        </div>

        <label className="block text-sm text-zinc-600">Jumlah Bayar<input type="number" step="0.01" min="0" value={paymentAmount} onChange={(event) => onPaymentAmountChange(event.target.value)} className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900" /></label>

        {paymentMethod === 'CASH' ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800"><div className="flex items-center justify-between"><span>Kembalian</span><strong>{formatCurrency(paymentSummary.changeAmount)}</strong></div>{paymentError ? <p className="mt-1 text-xs text-red-600">{paymentError}</p> : null}</div> : null}

        {checkoutError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{checkoutError}</div> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onClearCart} className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">Bersihkan</button>
            <button type="button" onClick={(event) => onCheckout(event)} disabled={submitting || cart.length === 0 || !canManageSales} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"><ArrowRight className="h-4 w-4" /> {submitting ? 'Proses...' : 'Bayar'}</button>
          </div>
          {createdInvoice ? <button type="button" onClick={onPrint} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"><Printer className="h-4 w-4" /> Cetak</button> : null}
        </div>
      </div>
    </section>
  );
}
