'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, Banknote, Bone, CheckCircle2, History, Package, Pill, Plus, Printer, Search, ShoppingBag, X } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { createPosSale, listPosProducts, listProductCategories } from '@/actions/pos';
import { getInvoiceLookups } from '@/actions/invoice';
import { calculatePosTotals, getPaymentSummary, roundCurrency, validatePosCheckout } from '@/lib/pos';
import { usePolling } from '@/hooks/use-polling';
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus';
import { usePermissions } from '@/hooks/use-permissions';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  sellPrice: number;
  stock: number;
  categoryName: string | null;
  imageUrl: string | null;
};

type CartItem = {
  productId: string;
  name: string;
  qty: number;
  price: number;
  stock: number;
};

type CustomerOption = { id: string; name: string };

type CategoryChip = { id: string; name: string; activeProductCount: number };

export default function PosPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryChip[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const skipRef = useRef(0);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [buyerMode, setBuyerMode] = useState<'REGISTERED' | 'MANUAL'>('REGISTERED');
  const [walkInName, setWalkInName] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [paymentAmount, setPaymentAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'NON_CASH'>('CASH');
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [taxRate, setTaxRate] = useState('0');
  const [createdInvoice, setCreatedInvoice] = useState<any | null>(null);
  const checkoutTimeoutRef = useRef<number | null>(null);
  const CART_STORAGE_KEY = 'haland-pos-cart';
  const { canPerform, isOwner, isAdmin } = usePermissions();
  const canManageSales = canPerform('pos', 'create');
  const isRestrictedStaff = !isOwner && !isAdmin;

  const loadCustomers = useCallback(async () => {
    const result = await getInvoiceLookups();
    if (result.success) {
      setCustomers(result.customers ?? []);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    const result = await listProductCategories();
    if (result.success) {
      setCategories(result.categories ?? []);
    } else {
      toast.error(result.message ?? 'Gagal memuat kategori produk.');
    }
  }, []);

  const loadProducts = useCallback(async (append = false) => {
    if (!append) {
      skipRef.current = 0;
    }
    setLoadingProducts(true);

    const result = await listPosProducts({
      categoryId: activeCategoryId || undefined,
      query: searchQuery.trim() || undefined,
      skip: append ? skipRef.current : 0,
      take: 24,
    });

    setLoadingProducts(false);

    if (!result.success) {
      if (!append) {
        setProducts([]);
      }
      setHasMoreProducts(false);
      toast.error(result.message ?? 'Gagal memuat produk.');
      return;
    }

    const fetchedProducts = result.products ?? [];
    if (append) {
      setProducts((current) => [...current, ...fetchedProducts]);
      skipRef.current += fetchedProducts.length;
    } else {
      setProducts(fetchedProducts);
      skipRef.current = fetchedProducts.length;
    }

    setHasMoreProducts(fetchedProducts.length === 24);
  }, [activeCategoryId, searchQuery]);

  const loadMoreProducts = useCallback(async () => {
    if (!hasMoreProducts || loadingProducts) return;
    await loadProducts(true);
  }, [hasMoreProducts, loadingProducts, loadProducts]);

  useEffect(() => {
    void loadCustomers();
    void loadCategories();
  }, [loadCustomers, loadCategories]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedCart = window.localStorage.getItem(CART_STORAGE_KEY);
      if (!savedCart) return;

      const parsedCart = JSON.parse(savedCart) as CartItem[];
      if (Array.isArray(parsedCart)) {
        setCart(parsedCart);
      }
    } catch {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts(false);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [activeCategoryId, searchQuery, loadProducts]);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    await loadProducts(false);
  }

  function addToCart(product: ProductRow) {
    if (product.stock <= 0) {
      toast.error('Stok produk tidak cukup.');
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) =>
          item.productId === product.id
            ? { ...item, qty: Math.min(item.qty + 1, product.stock) }
            : item,
        );
      }

      return [...current, { productId: product.id, name: product.name, qty: 1, price: product.sellPrice, stock: product.stock }];
    });
  }

  function updateQty(productId: string, qty: number) {
    setCart((current) =>
      current
        .map((item) => (item.productId === productId ? { ...item, qty: Math.max(1, Math.min(qty, item.stock)) } : item))
        .filter((item) => item.qty > 0),
    );
  }

  function removeFromCart(productId: string) {
    setCart((current) => current.filter((item) => item.productId !== productId));
  }

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.qty * item.price, 0), [cart]);
  const discountValue = Number(discountAmount) || 0;
  const computedDiscount = useMemo(() => {
    if (discountType === 'PERCENTAGE') {
      return roundCurrency(Math.min(Math.max(discountValue, 0), 100) * subtotal / 100);
    }
    return roundCurrency(Math.min(Math.max(discountValue, 0), subtotal));
  }, [discountType, discountValue, subtotal]);
  const totals = useMemo(() => calculatePosTotals(subtotal, computedDiscount, Number(taxRate) || 0), [subtotal, computedDiscount, taxRate]);
  const payment = Number(paymentAmount) || 0;
  const paymentSummary = useMemo(() => getPaymentSummary(payment, totals.totalAmount, paymentMethod), [payment, paymentMethod, totals.totalAmount]);
  const paymentError = paymentMethod === 'CASH' && !paymentSummary.isSufficient ? `Jumlah bayar kurang ${formatCurrency(paymentSummary.shortageAmount)}.` : '';

  async function handleCheckout(event?: React.FormEvent | React.MouseEvent) {
    event?.preventDefault?.();
    if (!canManageSales) {
      toast.error('Anda tidak memiliki izin untuk melakukan transaksi POS.');
      return;
    }
    if (submitting) return;
    if (cart.length === 0) {
      toast.error('Keranjang kosong.');
      return;
    }
    if (buyerMode === 'REGISTERED' && !customerId) {
      toast.error('Pilih pelanggan terdaftar atau beralih ke input manual.');
      return;
    }
    if (buyerMode === 'MANUAL' && !walkInName.trim()) {
      toast.error('Isi nama pembeli manual.');
      return;
    }
    const validation = validatePosCheckout({
      customerId,
      walkInName,
      items: cart.map((item) => ({ qty: item.qty, price: item.price })),
      discountType,
      discountAmount: discountValue,
      paymentMethod,
      paymentAmount: payment,
      subtotal,
      taxRate: Number(taxRate) || 0,
    });

    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    setSubmitting(true);

    if (checkoutTimeoutRef.current) {
      window.clearTimeout(checkoutTimeoutRef.current);
    }

    checkoutTimeoutRef.current = window.setTimeout(() => {
      setSubmitting(false);
      checkoutTimeoutRef.current = null;
      toast.error('Waktu pemrosesan transaksi habis. Silakan coba lagi.');
    }, 15000);

    try {
      const result = await createPosSale({
        customerId: buyerMode === 'REGISTERED' ? customerId || undefined : undefined,
        walkInName: buyerMode === 'MANUAL' ? walkInName.trim() : undefined,
        items: cart.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          price: item.price,
          description: item.name,
        })),
        discountType,
        discountAmount: discountValue,
        paymentMethod,
        paymentAmount: payment,
        taxRate: Number(taxRate) || 0,
      });

      if (!result.success) {
        toast.error(result.message ?? 'Gagal menyimpan transaksi.');
        return;
      }

      setCreatedInvoice(result.invoice);
      setCart([]);
      setDiscountAmount('0');
      setPaymentAmount('0');
      setTaxRate('0');
      toast.success(`Transaksi berhasil. ${paymentSummary.changeAmount > 0 ? `Kembalian ${formatCurrency(paymentSummary.changeAmount)}.` : 'Pembayaran lunas.'}`);
    } catch (error) {
      console.error(error);
      toast.error('Terjadi kesalahan saat memproses transaksi. Silakan coba lagi.');
    } finally {
      if (checkoutTimeoutRef.current) {
        window.clearTimeout(checkoutTimeoutRef.current);
      }
      checkoutTimeoutRef.current = null;
      setSubmitting(false);
    }
  }

  useRefetchOnFocus(loadCustomers);
  usePolling(loadCustomers, 30000);

  function handlePrint() {
    if (!createdInvoice) return;
    const customerName = createdInvoice.walkInName?.trim() || createdInvoice.customer?.name || 'Pelanggan';
    const html = `<!DOCTYPE html><html><head><title>Struk ${createdInvoice.invoiceNumber}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1,h2,h3{margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{padding:8px;border:1px solid #ccc;text-align:left}strong{display:inline-block;width:120px}</style></head><body><h1>Struk Penjualan</h1><p><strong>No. Invoice:</strong> ${createdInvoice.invoiceNumber}</p><p><strong>Pelanggan:</strong> ${customerName}</p><p><strong>Tanggal:</strong> ${formatDate(createdInvoice.date)}</p><table><thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>${createdInvoice.items.map((item: any) => `<tr><td>${item.description}</td><td>${item.qty}</td><td>${formatCurrency(item.price)}</td><td>${formatCurrency(item.subtotal)}</td></tr>`).join('')}</tbody></table><p><strong>Total:</strong> ${formatCurrency(createdInvoice.totalAmount)}</p><p><strong>Dibayar:</strong> ${formatCurrency(createdInvoice.payments?.[0]?.amount ?? 0)}</p><p><strong>Status:</strong> ${createdInvoice.status}</p></body></html>`;
    const popup = window.open('', '_blank');
    if (popup) {
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      popup.print();
    }
  }

  const checkoutPanel = (
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
            <button
              type="button"
              onClick={() => {
                setBuyerMode('REGISTERED');
                setWalkInName('');
              }}
              className={`rounded-full border px-3 py-2 text-sm ${buyerMode === 'REGISTERED' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700'}`}
            >
              Pelanggan terdaftar
            </button>
            <button
              type="button"
              onClick={() => setBuyerMode('MANUAL')}
              className={`rounded-full border px-3 py-2 text-sm ${buyerMode === 'MANUAL' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700'}`}
            >
              Input manual
            </button>
          </div>
          {buyerMode === 'REGISTERED' ? (
            <label className="block text-sm text-zinc-600">
              Pelanggan terdaftar
              <select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900"
              >
                <option value="">Pilih pelanggan</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block text-sm text-zinc-600">
              Nama pembeli
              <input
                type="text"
                value={walkInName}
                onChange={(event) => setWalkInName(event.target.value)}
                placeholder="Nama pembeli"
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900"
              />
            </label>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-zinc-600">
                <tr>
                  <th className="px-3 py-2">Produk</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Subtotal</th>
                  <th className="px-3 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.productId} className="border-t border-zinc-200">
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={item.stock}
                        value={item.qty}
                        onChange={(event) => updateQty(item.productId, Number(event.target.value))}
                        className="w-16 rounded-2xl border border-zinc-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">{formatCurrency(item.price * item.qty)}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => removeFromCart(item.productId)} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700">
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-sm text-zinc-500">Keranjang kosong.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-3">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            <div className="flex items-center justify-between"><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
            <div className="mt-1 flex items-center justify-between text-sm text-zinc-600"><span>Diskon</span><span>{discountType === 'PERCENTAGE' ? `${discountValue}%` : formatCurrency(discountValue)}</span></div>
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
          <label className="block text-sm text-zinc-600">
            Diskon
            <input type="number" step="0.01" min="0" max={discountType === 'PERCENTAGE' ? 100 : undefined} value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDiscountType('PERCENTAGE')}
              className={`rounded-full border px-3 py-2 text-sm ${discountType === 'PERCENTAGE' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700'}`}
            >
              %
            </button>
            <button
              type="button"
              onClick={() => setDiscountType('FIXED')}
              className={`rounded-full border px-3 py-2 text-sm ${discountType === 'FIXED' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700'}`}
            >
              Rp
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-zinc-600">
            Pajak (%)
            <input type="number" step="0.01" min="0" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900" />
          </label>
          <label className="block text-sm text-zinc-600">
            Metode Pembayaran
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as 'CASH' | 'NON_CASH')} className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900">
              <option value="CASH">Tunai</option>
              <option value="NON_CASH">Non-tunai</option>
            </select>
          </label>
        </div>

        <label className="block text-sm text-zinc-600">
          Jumlah Bayar
          <input type="number" step="0.01" min="0" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900" />
        </label>

        {paymentMethod === 'CASH' ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
            <div className="flex items-center justify-between"><span>Kembalian</span><strong>{formatCurrency(paymentSummary.changeAmount)}</strong></div>
            {paymentError ? <p className="mt-1 text-xs text-red-600">{paymentError}</p> : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setCart([])} className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
              Bersihkan
            </button>
            <button type="button" onClick={(event) => void handleCheckout(event)} disabled={submitting || cart.length === 0 || !canManageSales} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70">
              <ArrowRight className="h-4 w-4" /> {submitting ? 'Proses...' : 'Bayar'}
            </button>
          </div>
          {createdInvoice ? (
            <button type="button" onClick={handlePrint} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
              <Printer className="h-4 w-4" /> Cetak
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );

  return (
    <ProtectedRoute module="pos" action="read">
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-500">Modul POS</p>
            <h1 className="text-xl font-semibold text-zinc-900">Transaksi penjualan produk</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-zinc-700">
            <ShoppingBag className="h-5 w-5" />
            <span className="text-sm">{isRestrictedStaff ? 'Kasir / Staff Terbatas' : 'Owner & Admin Klinik'}</span>
            <Link href="/pos/riwayat" className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
              <History className="h-4 w-4" /> Riwayat transaksi
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.64fr_0.36fr]">
        <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <form onSubmit={handleSearch} className="flex flex-col gap-3">
            <div className="grid gap-3 lg:grid-cols-[1.6fr_auto]">
              <label className="block text-sm font-medium text-zinc-700">Cari produk atau scan barcode</label>
              <div className="flex gap-2">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Nama, SKU, atau barcode"
                  className="flex-1 min-w-0 rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                />
                <button type="submit" className="inline-flex items-center gap-2 rounded-3xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800">
                  <Search className="h-4 w-4" />Cari
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto pb-2">
              <div className="inline-flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCategoryId('')}
                  className={`min-w-max rounded-full border px-4 py-2 text-sm font-medium ${activeCategoryId === '' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700'}`}
                >
                  Semua
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveCategoryId(category.id)}
                    className={`min-w-max rounded-full border px-4 py-2 text-sm font-medium ${activeCategoryId === category.id ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700'}`}
                  >
                    {category.name} ({category.activeProductCount})
                  </button>
                ))}
              </div>
            </div>
          </form>

          <div className="mt-3 grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
            {loadingProducts && products.length === 0 ? (
              Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
                  <div className="mb-3 h-32 rounded-2xl bg-zinc-100" />
                  <div className="space-y-2">
                    <div className="h-3 w-3/4 rounded bg-zinc-200" />
                    <div className="h-3 w-1/2 rounded bg-zinc-200" />
                  </div>
                </div>
              ))
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
                Produk akan muncul di sini.
              </div>
            ) : (
              products.map((product) => (
                <div key={product.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    className="flex h-full w-full flex-row items-center gap-3 p-2 text-left md:flex-col md:items-stretch md:p-3"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 md:h-24 md:w-full md:aspect-square">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-400">
                          {product.categoryName?.toLowerCase().includes('makanan') ? <Bone className="h-6 w-6" /> : product.categoryName?.toLowerCase().includes('obat') ? <Pill className="h-6 w-6" /> : <Package className="h-6 w-6" />}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2 md:space-y-2">
                      <div>
                        <h3 className="truncate text-sm font-semibold text-zinc-900">{product.name}</h3>
                        <p className="text-xs text-zinc-500">{product.categoryName ?? 'Tanpa kategori'}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-zinc-700">
                        <span className="font-semibold text-zinc-900">{formatCurrency(product.sellPrice)}</span>
                        <span className="rounded-full border border-zinc-200 px-2 py-1 text-[10px] text-zinc-500">Stok {product.stock}</span>
                      </div>
                      <div className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-3 py-2 text-center text-xs font-medium text-white transition hover:bg-zinc-800 md:w-full">
                        Tambah
                      </div>
                    </div>
                  </button>
                </div>
              ))
            )}
          </div>

          {hasMoreProducts ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={loadMoreProducts}
                disabled={loadingProducts}
                className="rounded-full border border-zinc-900 bg-white px-5 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingProducts ? 'Memuat...' : 'Muat lebih banyak'}
              </button>
            </div>
          ) : null}
        </section>

        <section className="lg:hidden">
          <div className="mb-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-zinc-500">Ringkasan keranjang</p>
                <p className="text-base font-semibold text-zinc-900">{cart.length} item • {formatCurrency(totals.totalAmount)}</p>
              </div>
              <button
                type="button"
                onClick={() => setCartSheetOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
              >
                Lihat detail
              </button>
            </div>
          </div>
        </section>

        <div className="hidden lg:block">
          {checkoutPanel}
        </div>

        {cartSheetOpen ? (
          <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm px-4 py-6 sm:px-6">
            <div className="w-full max-h-[92vh] overflow-auto rounded-t-[2rem] bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500">Detail pembayaran</p>
                  <h2 className="text-lg font-semibold text-zinc-900">Ringkasan pesanan</h2>
                </div>
                <button type="button" onClick={() => setCartSheetOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition hover:bg-zinc-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {checkoutPanel}
            </div>
          </div>
        ) : null}
      </div>

      {createdInvoice ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-zinc-700">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Transaksi selesai</h2>
                <p className="text-sm text-zinc-500">Invoice siap dicetak.</p>
              </div>
            </div>
            <button type="button" onClick={handlePrint} className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
              <Printer className="h-4 w-4" /> Cetak
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-700">
              <p className="text-zinc-500">Invoice</p>
              <p className="mt-2 font-semibold text-zinc-900">{createdInvoice.invoiceNumber}</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-700">
              <p className="text-zinc-500">Pelanggan</p>
              <p className="mt-2 font-semibold text-zinc-900">{createdInvoice.walkInName?.trim() || createdInvoice.customer.name}</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-700">
              <p className="text-zinc-500">Total</p>
              <p className="mt-2 font-semibold text-zinc-900">{formatCurrency(createdInvoice.totalAmount)}</p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
    </ProtectedRoute>
  );
}
