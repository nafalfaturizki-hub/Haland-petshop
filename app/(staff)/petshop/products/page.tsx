'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Download, FileUp, Package, PencilLine, Archive, RotateCcw, MoreHorizontal, Trash2, CheckSquare } from 'lucide-react';
import { archiveProduct, createProduct, exportProductsToCsv, importProductsFromCsv, listProductCategories, listProducts, restoreProduct, updateProduct, listSuppliers, type ParsedProductRow } from '@/actions/product';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { formatCurrency } from '@/lib/utils';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED' | 'LOW_STOCK'>('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [previewRows, setPreviewRows] = useState<ParsedProductRow[]>([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importing, setImporting] = useState(false);
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
    const [productsResult, categoriesResult, suppliersResult] = await Promise.all([listProducts(false), listProductCategories(), listSuppliers()]);

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

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = filterCategory === 'ALL' || product.category?.name === filterCategory;
    const matchesStatus = filterStatus === 'ALL' ? true : filterStatus === 'ACTIVE' ? product.status !== 'ARCHIVED' : filterStatus === 'ARCHIVED' ? product.status === 'ARCHIVED' : product.stock <= product.minStock;
    return matchesCategory && matchesStatus;
  }), [filterCategory, filterStatus, products]);

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  async function handleDownloadTemplate() {
    const headers = ['name','sku','barcode','brand','categoryName','supplierName','buyPrice','sellPrice','costPrice','stock','minStock','maxStock','unit','status','description','imageUrl'];
    const csv = [headers.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template-produk.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportCsv() {
    const result = await exportProductsToCsv();
    if (!result.success) {
      setMessage(result.message ?? 'Gagal mengekspor produk.');
      return;
    }

    const rows = result.rows ?? [];
    const headers = ['name','sku','barcode','brand','categoryName','supplierName','buyPrice','sellPrice','stock','minStock','maxStock','unit','status'];
    const csv = [headers.join(',')].concat(rows.map((row: any) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'produk.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = text.split(/\r?\n/).slice(1).filter(Boolean).map((line) => {
      const columns = line.split(',');
      return {
        name: columns[0] ?? '',
        sku: columns[1] ?? '',
        barcode: columns[2] ?? '',
        brand: columns[3] ?? '',
        categoryName: columns[4] ?? '',
        supplierName: columns[5] ?? '',
        buyPrice: columns[6] ?? '',
        sellPrice: columns[7] ?? '',
        costPrice: columns[8] ?? '',
        stock: columns[9] ?? '',
        minStock: columns[10] ?? '',
        maxStock: columns[11] ?? '',
        unit: columns[12] ?? '',
        status: columns[13] ?? 'ACTIVE',
        description: columns[14] ?? '',
        imageUrl: columns[15] ?? '',
      } as ParsedProductRow;
    });
    setPreviewRows(rows);
    setShowImportPreview(true);
    event.target.value = '';
  }

  async function handleImportNow() {
    setImporting(true);
    const result = await importProductsFromCsv(previewRows);
    setImporting(false);
    if (result.success) {
      setMessage(`Import selesai: ${result.result?.created ?? 0} dibuat, ${(result.result?.updated ?? 0)} diperbarui, ${(result.result?.failed ?? 0)} gagal.`);
      setPreviewRows([]);
      setShowImportPreview(false);
      await loadData();
      return;
    }
    setMessage(result.message ?? 'Import gagal.');
  }

  const columns: Array<{ key: keyof ProductRow; header: string; render?: (row: ProductRow) => ReactNode }> = [
    { key: 'id', header: '', render: (row) => <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelect(row.id)} className="h-4 w-4 rounded border-zinc-300" /> },
    { key: 'name', header: 'Produk', render: (row) => <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600"><Package className="h-4 w-4" /></div><div><p className="font-medium text-zinc-900">{row.name}</p><p className="text-xs text-zinc-500">{row.sku ?? '-'}</p></div></div> },
    { key: 'category', header: 'Kategori', render: (row) => row.category?.name ?? '-' },
    { key: 'sellPrice', header: 'Harga', render: (row) => formatCurrency(row.sellPrice) },
    { key: 'stock', header: 'Stok', render: (row) => <span className={row.stock <= row.minStock ? 'font-semibold text-red-600' : 'text-zinc-900'}>{row.stock}</span> },
    { key: 'status', header: 'Status', render: (row) => <span className={row.status === 'ARCHIVED' ? 'rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700' : 'rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700'}>{row.status === 'ARCHIVED' ? 'Diarsipkan' : 'Aktif'}</span> },
    { key: 'id', header: 'Aksi', render: (row) => <div className="flex items-center gap-2"><button type="button" onClick={() => startEdit(row)} className="rounded-lg border border-zinc-200 p-2 text-zinc-700"><PencilLine className="h-4 w-4" /></button><button type="button" onClick={() => row.status === 'ARCHIVED' ? void handleRestore(row.id) : void handleArchive(row.id)} className="rounded-lg border border-zinc-200 p-2 text-zinc-700">{row.status === 'ARCHIVED' ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</button></div> },
  ];

  return (
    <ProtectedRoute module="petshop" action="read">
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-zinc-500">Modul Petshop</p>
            <h1 className="text-xl font-semibold text-zinc-900">Kelola produk</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleExportCsv} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"><Download className="h-4 w-4" />Export CSV</button>
            <button type="button" onClick={handleDownloadTemplate} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"><FileUp className="h-4 w-4" />Template</button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white"><FileUp className="h-4 w-4" />Import CSV<input type="file" accept=".csv" className="hidden" onChange={handleFileImport} /></label>
          </div>
        </div>
      </div>

      {message ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">{message}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
              <option value="ALL">Semua kategori</option>
              {categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
            </select>
            <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as any)} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
              <option value="ALL">Semua status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="ARCHIVED">Diarsipkan</option>
              <option value="LOW_STOCK">Stok rendah</option>
            </select>
            {selectedIds.length > 0 ? <button type="button" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">Aksi massal ({selectedIds.length})</button> : null}
          </div>
          {loading ? <div className="text-sm text-zinc-500">Memuat produk...</div> : products.length === 0 ? <EmptyState title="Belum ada produk" description="Tambah produk untuk memulai." /> : <DataTable title="Daftar produk" columns={columns} rows={filteredProducts} emptyMessage="Belum ada produk." />}
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
    </ProtectedRoute>
  );
}
