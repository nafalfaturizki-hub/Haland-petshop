'use client';

import { Trash2 } from 'lucide-react';
import { type CartItem } from '@/utils/pos-helpers';

function formatCurrency(value: number) {
  return value.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
}

type CartSummaryProps = {
  items: CartItem[];
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
};

export function CartSummary({ items, onQuantityChange, onRemoveItem }: CartSummaryProps) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Keranjang</h2>
          <p className="text-sm text-zinc-500">{items.length} item</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.productId} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{item.name}</p>
                <p className="text-xs text-zinc-500">{formatCurrency(item.price)}</p>
              </div>
              <button type="button" onClick={() => onRemoveItem(item.productId)} className="rounded-full border border-zinc-200 bg-white p-2 text-zinc-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button type="button" className="h-8 w-8 rounded-full border border-zinc-200 bg-white text-sm" onClick={() => onQuantityChange(item.productId, item.qty - 1)}>-</button>
                <span className="min-w-8 text-center text-sm font-medium text-zinc-700">{item.qty}</span>
                <button type="button" className="h-8 w-8 rounded-full border border-zinc-200 bg-white text-sm" onClick={() => onQuantityChange(item.productId, item.qty + 1)}>+</button>
              </div>
              <div className="text-sm font-semibold text-zinc-900">{formatCurrency(item.price * item.qty)}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
