'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Package, PencilLine, Archive, RotateCcw } from 'lucide-react';
import { archiveProduct, createProduct, listProductCategories, listProducts, restoreProduct, updateProduct, listSuppliers } from '@/actions/product';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { formatCurrency } from '@/lib/utils';

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  description: string | null;
  category: { name: string } | null;
  supplier: { name: string } | null;
  buyPrice: number;
  sellPrice: number;
  costPrice: number;
  unit: string | null;
  stock: number;
  minStock: number;
  maxStock: number | null;
  status: string;
  imageUrl: string | null;
  isArchived: boolean;
};

export default function PetshopProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    brand: '',
    description: '',
    categoryId: '',
    supplierId: '',
    unit: 'PCS',
    buyPrice: '0',
    sellPrice: '0',
    costPrice: '0',
    stock: '0',
    minStock: '0',
    maxStock: '',
    status: 'ACTIVE' as 'ACTIVE' | 'ARCHIVED',
    imageUrl: '',
  });

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [productsResult, categoriesResult, suppliersResult] = await Promise.all([listProducts(), listProductCategories(), listSuppliers()]);

    if (productsResult.success) setProducts(productsResult.products as any[]);
    if (categoriesResult.success) setCategories(categoriesResult.categories as any[]);
    if (suppliersResult.success) setSuppliers(suppliersResult.suppliers as any[]);
    setLoading(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      setMessage('Nama produk wajib diisi.');
      return;
    }

    setSubmitting(true);
    const payload = {
      id: editingId ?? undefined,
      name: form.name,
      sku: form.sku || undefined,
      barcode: form.barcode || undefined,
      brand: form.brand || undefined,
      description: form.description || undefined,
      categoryId: form.categoryId || undefined,
      supplierId: form.supplierId || undefined,
      unit: form.unit || undefined,
      buyPrice: parseFloat(form.buyPrice),
      sellPrice: parseFloat(form.sellPrice),
      costPrice: parseFloat(form.costPrice),
      stock: parseInt(form.stock, 10),
      minStock: parseInt(form.minStock, 10),
      maxStock: form.maxStock ? parseInt(form.maxStock, 10) : undefined,
      status: form.status,
      imageUrl: form.imageUrl || undefined,
    };

    const result = editingId ? await updateProduct(payload as any) : await createProduct(payload as any);

    if (result.success) {
      setMessage(editingId ? 'Produk diperbarui.' : 'Produk ditambahkan.');
      setEditingId(null);
      setForm({ name: '', sku: '', barcode: '', brand: '', description: '', categoryId: '', supplierId: '', unit: 'PCS', buyPrice: '0', sellPrice: '0', costPrice: '0', stock: '0', minStock: '0', maxStock: '', status: 'ACTIVE', imageUrl: '' });
      await loadData();
      setSubmitting(false);
      return;
    }
    setMessage(result.message ?? 'Gagal menyimpan produk.');
    setSubmitting(false);
  }

  async function handleArchive(id: string) {
    const result = await archiveProduct(id);
    if (result.success) {
      setMessage('Produk diarsipkan.');
      await loadData();
      return;
    }
    setMessage(result.message ?? 'Gagal mengarsipkan produk.');
  }

  async function handleRestore(id: string) {
    const result = await restoreProduct(id);
    if (result.success) {
      setMessage('Produk dipulihkan.');
      await loadData();
      return;
    }
    setMessage(result.message ?? 'Gagal memulihkan produk.');
  }

  function startEdit(product: ProductRow) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      sku: product.sku || '',
      barcode: product.barcode || '',
      brand: product.brand || '',
      description: product.description || '',
      categoryId: product.category?.name ? categories.find((c) => c.name === product.category?.name)?.id ?? '' : '',
      supplierId: product.supplier?.name ? suppliers.find((s) => s.name === product.supplier?.name)?.id ?? '' : '',
      unit: product.unit ?? 'PCS',
      buyPrice: String(product.buyPrice),
      sellPrice: String(product.sellPrice),
      costPrice: String(product.costPrice),
      stock: String(product.stock),
      minStock: String(product.minStock),
      maxStock: product.maxStock ? String(product.maxStock) : '',
      status: product.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
      imageUrl: product.imageUrl || '',
    });
  }

  const columns: Array<{ key: keyof ProductRow; header: string; render?: (row: ProductRow) => ReactNode }> = [
    { key: 'name', header: 'Nama Produk', render: (row) => <div><p className="font-medium text-zinc-900">{row.name}</p><p className="text-xs text-zinc-500">{row.sku ?? '-'}</p></div> },
    { key: 'category', header: 'Kategori', render: (row) => row.category?.name ?? '-' },
    { key: 'supplier', header: 'Supplier', render: (row) => row.supplier?.name ?? '-' },
    { key: 'buyPrice', header: 'Harga Beli', render: (row) => formatCurrency(row.buyPrice) },
    { key: 'sellPrice', header: 'Harga Jual', render: (row) => formatCurrency(row.sellPrice) },
    { key: 'stock', header: 'Stok', render: (row) => <span className={row.stock <= row.minStock ? 'font-semibold text-red-600' : 'text-zinc-900'}>{row.stock}</span> },
    { key: 'status', header: 'Status', render: (row) => <span className={row.status === 'ARCHIVED' ? 'rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700' : 'rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700'}>{row.status === 'ARCHIVED' ? 'Diarsipkan' : 'Aktif'}</span> },
    { key: 'id', header: 'Aksi', render: (row) => <div className="flex flex-wrap gap-2"><button type="button" onClick={() => startEdit(row)} className="rounded-lg border border-zinc-200 px-3 py-1 text-xs text-zinc-700"><PencilLine className="mr-1 inline h-3 w-3" />Edit</button>{row.status === 'ARCHIVED' ? <button type="button" onClick={() => void handleRestore(row.id)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700"><RotateCcw className="mr-1 inline h-3 w-3" />Pulihkan</button> : <button type="button" onClick={() => void handleArchive(row.id)} className="rounded-lg border border-zinc-200 px-3 py-1 text-xs text-zinc-700"><Archive className="mr-1 inline h-3 w-3" />Arsip</button>}</div> },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Modul Petshop</p>
        <h1 className="text-xl font-semibold text-zinc-900">Kelola produk</h1>
      </div>

      {message ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">{message}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          {loading ? <div className="text-sm text-zinc-500">Memuat produk...</div> : products.length === 0 ? <EmptyState title="Belum ada produk" description="Tambah produk untuk memulai." /> : <DataTable title="Daftar produk" columns={columns} rows={products} emptyMessage="Belum ada produk." />}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-900">
            <Package className="h-4 w-4" />
            <h2 className="text-base font-semibold">{editingId ? 'Edit produk' : 'Tambah produk'}</h2>
          </div>

          <label className="block text-sm text-zinc-600">
            Nama
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-zinc-600">
              SKU
              <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="block text-sm text-zinc-600">
              Barcode
              <input type="text" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-zinc-600">
              Brand
              <input type="text" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="block text-sm text-zinc-600">
              Unit
              <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
          </div>

          <label className="block text-sm text-zinc-600">
            Deskripsi
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" rows={2} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-zinc-600">
              Kategori
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="">Pilih kategori</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="block text-sm text-zinc-600">
              Supplier
              <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="">Pilih supplier</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-zinc-600">
              Harga Beli
              <input type="number" step="0.01" value={form.buyPrice} onChange={(e) => setForm({ ...form, buyPrice: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="block text-sm text-zinc-600">
              Harga Jual
              <input type="number" step="0.01" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm text-zinc-600">
              Harga Pokok
              <input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="block text-sm text-zinc-600">
              Stok Awal
              <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="block text-sm text-zinc-600">
              Min Stok
              <input type="number" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-zinc-600">
              Max Stok
              <input type="number" min="0" value={form.maxStock} onChange={(e) => setForm({ ...form, maxStock: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="block text-sm text-zinc-600">
              Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'ACTIVE' | 'ARCHIVED' })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="ACTIVE">Aktif</option>
                <option value="ARCHIVED">Diarsipkan</option>
              </select>
            </label>
          </div>

          <label className="block text-sm text-zinc-600">
            URL Gambar
            <input type="text" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={submitting} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70">
              {submitting ? 'Menyimpan...' : editingId ? 'Simpan' : 'Tambah'}
            </button>
            {editingId ? (
              <button type="button" onClick={() => { setEditingId(null); setForm({ name: '', sku: '', barcode: '', brand: '', description: '', categoryId: '', supplierId: '', unit: 'PCS', buyPrice: '0', sellPrice: '0', costPrice: '0', stock: '0', minStock: '0', maxStock: '', status: 'ACTIVE', imageUrl: '' }); }} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700">
                Batal
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
