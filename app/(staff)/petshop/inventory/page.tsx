'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Warehouse, ArrowDown, ArrowUp, RefreshCw, Package } from 'lucide-react';
import { listInventory, recordStockMovement, listStockMovements } from '@/actions/inventory';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';

type InventoryRow = {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  category: { name: string } | null;
  supplier: { name: string } | null;
};

export default function InventoryPage() {
  const [products, setProducts] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [form, setForm] = useState({ type: 'IN' as 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN' | 'DAMAGED' | 'EXPIRED' | 'CORRECTION', quantity: '', note: '' });
  const [movements, setMovements] = useState<any[]>([]);
  const [showMovements, setShowMovements] = useState(false);

  useEffect(() => {
    void loadInventory();
  }, []);

  async function loadInventory() {
    setLoading(true);
    const result = await listInventory();
    if (result.success) {
      setProducts(result.products as InventoryRow[]);
    }
    setLoading(false);
  }

  async function handleMovement(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedProduct) {
      setMessage('Pilih produk terlebih dahulu.');
      return;
    }

    setSubmitting(true);
    const result = await recordStockMovement({
      productId: selectedProduct,
      type: form.type,
      quantity: parseInt(form.quantity, 10),
      note: form.note || undefined,
    });

    if (result.success) {
      const label = form.type === 'IN' ? 'masuk' : form.type === 'OUT' ? 'keluar' : form.type === 'ADJUSTMENT' ? 'disesuaikan' : form.type === 'RETURN' ? 'dikembalikan' : form.type === 'DAMAGED' ? 'rusak' : form.type === 'EXPIRED' ? 'kedaluwarsa' : 'dikoreksi';
      setMessage(`Stok berhasil ${label}.`);
      setForm({ type: 'IN', quantity: '', note: '' });
      await loadInventory();
      setSubmitting(false);
      return;
    }
    setMessage(result.message ?? 'Gagal mencatat pergerakan stok.');
    setSubmitting(false);
  }

  async function showMovementHistory() {
    if (!selectedProduct) {
      setMessage('Pilih produk terlebih dahulu.');
      return;
    }

    const result = await listStockMovements(selectedProduct);
    if (result.success) {
      setMovements(result.movements ?? []);
      setShowMovements(true);
    }
  }

  const columns: Array<{ key: keyof InventoryRow; header: string; render?: (row: InventoryRow) => ReactNode }> = [
    { key: 'name', header: 'Produk', render: (row) => <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600"><Package className="h-4 w-4" /></div><div><p className="font-medium text-zinc-900">{row.name}</p><p className="text-xs text-zinc-500">{row.category?.name ?? '-'}</p></div></div> },
    { key: 'stock', header: 'Stok', render: (row) => <span className={row.stock <= row.minStock ? 'font-semibold text-red-600' : 'text-zinc-900'}>{row.stock}</span> },
    { key: 'minStock', header: 'Min Stok' },
    { key: 'supplier', header: 'Supplier', render: (row) => row.supplier?.name ?? '-' },
  ];

  const selectedProductName = products.find((p) => p.id === selectedProduct)?.name;

  return (
    <ProtectedRoute module="petshop" action="read">
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Modul Inventori</p>
        <h1 className="text-xl font-semibold text-zinc-900">Kelola stok produk</h1>
      </div>

      {message ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">{message}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          {loading ? <div className="text-sm text-zinc-500">Memuat inventori...</div> : products.length === 0 ? <EmptyState title="Belum ada produk" description="Tambah produk di menu Produk terlebih dahulu." /> : <DataTable title="Daftar stok produk" columns={columns} rows={products} emptyMessage="Belum ada produk." pageSize={8} />}
        </div>

        <form onSubmit={handleMovement} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-900">
            <Warehouse className="h-4 w-4" />
            <h2 className="text-base font-semibold">Pergerakan stok</h2>
          </div>

          <label className="block text-sm text-zinc-600">
            Produk
            <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
              <option value="">Pilih produk</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stok: {p.stock})
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-zinc-600">
            Jenis
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
              <option value="IN">Masuk</option>
              <option value="OUT">Keluar</option>
              <option value="ADJUSTMENT">Penyesuaian</option>
              <option value="RETURN">Retur</option>
              <option value="DAMAGED">Rusak</option>
              <option value="EXPIRED">Kedaluwarsa</option>
              <option value="CORRECTION">Koreksi</option>
            </select>
          </label>

          <label className="block text-sm text-zinc-600">
            Jumlah
            <input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>

          <label className="block text-sm text-zinc-600">
            Catatan
            <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" rows={2} />
          </label>

          <button type="submit" disabled={submitting} className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70">
            {submitting ? 'Menyimpan...' : 'Catat Pergerakan'}
          </button>

          {selectedProduct && (
            <button type="button" onClick={() => void showMovementHistory()} className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700">
              Lihat Riwayat
            </button>
          )}
        </form>
      </div>

      {showMovements && selectedProductName && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">Riwayat: {selectedProductName}</h2>
          {movements.length === 0 ? (
            <p className="text-sm text-zinc-500">Belum ada riwayat pergerakan.</p>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm">
                  <div className="flex items-center gap-3">
                    {m.type === 'IN' ? <ArrowDown className="h-4 w-4 text-green-600" /> : m.type === 'OUT' ? <ArrowUp className="h-4 w-4 text-red-600" /> : <RefreshCw className="h-4 w-4 text-blue-600" />}
                    <div>
                      <p className="font-medium text-zinc-900">{m.type === 'IN' ? 'Masuk' : m.type === 'OUT' ? 'Keluar' : m.type === 'ADJUSTMENT' ? 'Penyesuaian' : m.type === 'RETURN' ? 'Retur' : m.type === 'DAMAGED' ? 'Rusak' : m.type === 'EXPIRED' ? 'Kedaluwarsa' : 'Koreksi'} {m.quantity} unit</p>
                      <p className="text-xs text-zinc-500">{m.note ?? 'Tanpa catatan'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">{new Date(m.date).toLocaleDateString('id-ID')}</p>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => setShowMovements(false)} className="mt-4 rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700">
            Tutup
          </button>
        </div>
      )}
    </div>
    </ProtectedRoute>
  );
}
