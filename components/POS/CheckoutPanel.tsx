'use client';

type CheckoutPanelProps = {
  subtotal: number;
  discountAmount: number;
  total: number;
  paymentType: string;
  paymentAmount: number;
  changeAmount: number;
  errorMessage?: string;
  successMessage?: string;
  isSubmitting: boolean;
  onPaymentTypeChange: (value: string) => void;
  onPaymentAmountChange: (value: number) => void;
  onDiscountChange: (value: number) => void;
  onSubmit: () => void;
};

export function CheckoutPanel({ subtotal, discountAmount, total, paymentType, paymentAmount, changeAmount, errorMessage, successMessage, isSubmitting, onPaymentTypeChange, onPaymentAmountChange, onDiscountChange, onSubmit }: CheckoutPanelProps) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold text-zinc-900">Checkout</h2>
      <div className="mt-4 space-y-3 rounded-2xl bg-zinc-50 p-4">
        <div className="flex items-center justify-between text-sm text-zinc-600">
          <span>Subtotal</span>
          <span>{subtotal.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-zinc-600">
          <span>Diskon</span>
          <input type="number" value={discountAmount} min={0} onChange={(event) => onDiscountChange(Number(event.target.value))} className="w-24 rounded-lg border border-zinc-200 px-3 py-2 text-right" />
        </div>
        <div className="flex items-center justify-between text-base font-semibold text-zinc-900">
          <span>Total</span>
          <span>{total.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="text-sm font-medium text-zinc-700">
          Metode pembayaran
          <select value={paymentType} onChange={(event) => onPaymentTypeChange(event.target.value)} className="mt-1 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm">
            <option value="cash">Tunai</option>
            <option value="transfer">Transfer</option>
            <option value="qris">QRIS</option>
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Jumlah bayar
          <input type="number" value={paymentAmount} min={0} onChange={(event) => onPaymentAmountChange(Number(event.target.value))} className="mt-1 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm" />
        </label>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
          <div className="flex items-center justify-between">
            <span>Kembalian</span>
            <span className="font-semibold text-zinc-900">{changeAmount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      </div>

      {errorMessage ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</div> : null}
      {successMessage ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</div> : null}

      <button type="button" onClick={onSubmit} disabled={isSubmitting} className="mt-4 w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400">
        {isSubmitting ? 'Memproses...' : 'Selesaikan transaksi'}
      </button>
    </section>
  );
}
