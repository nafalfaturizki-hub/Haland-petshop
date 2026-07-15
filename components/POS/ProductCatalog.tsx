'use client';

import { Search, ShoppingBag } from 'lucide-react';
import { type ProductRow } from '@/utils/pos-helpers';

type ProductCatalogProps = {
  products: ProductRow[];
  categories: Array<{ id: string; name: string; activeProductCount: number }>;
  activeCategoryId: string;
  loadingProducts: boolean;
  hasMoreProducts: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSearch: (event: React.FormEvent) => void;
  onLoadMore: () => void;
  onAddToCart: (product: ProductRow) => void;
};

export function ProductCatalog({ products, categories, activeCategoryId, loadingProducts, hasMoreProducts, searchQuery, onSearchQueryChange, onCategoryChange, onSearch, onLoadMore, onAddToCart }: ProductCatalogProps) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <form onSubmit={onSearch} className="flex flex-col gap-3">
        <div className="grid gap-3 lg:grid-cols-[1.6fr_auto]">
          <label className="block text-sm font-medium text-zinc-700">Cari produk atau scan barcode</label>
          <div className="flex gap-2">
            <input value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} placeholder="Cari produk" className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm" />
            <button type="submit" className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700">
              <Search className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onCategoryChange('')} className={`rounded-full border px-3 py-2 text-sm ${activeCategoryId === '' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700'}`}>Semua</button>
          {categories.map((category) => (
            <button key={category.id} type="button" onClick={() => onCategoryChange(category.id)} className={`rounded-full border px-3 py-2 text-sm ${activeCategoryId === category.id ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700'}`}>
              {category.name} ({category.activeProductCount})
            </button>
          ))}
        </div>
      </form>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <div key={product.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{product.name}</p>
                <p className="mt-1 text-xs text-zinc-500">{product.categoryName ?? 'Tanpa kategori'}</p>
              </div>
              <div className="rounded-full bg-white px-2.5 py-1 text-xs text-zinc-600">{product.stock} stok</div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(product.sellPrice)}</p>
              </div>
              <button type="button" onClick={() => onAddToCart(product)} className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700">
                <ShoppingBag className="h-4 w-4" /> Tambah
              </button>
            </div>
          </div>
        ))}
      </div>

      {loadingProducts ? <div className="mt-4 text-sm text-zinc-500">Memuat produk...</div> : null}
      {!loadingProducts && hasMoreProducts ? <button type="button" onClick={onLoadMore} className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700">Muat lebih banyak</button> : null}
    </section>
  );
}
