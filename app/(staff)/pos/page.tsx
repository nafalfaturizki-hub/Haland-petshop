'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Invoice } from '@prisma/client';
import { toast } from 'sonner';
import { CheckCircle2, History, Printer, ShoppingBag, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { createPosSaleWithRetry, listPosProducts, listProductCategories, validatePosSale } from '@/actions/pos';
import { getInvoiceLookups } from '@/actions/invoice';
import { calculatePosTotals, getPaymentSummary, roundCurrency } from '@/lib/pos';
import { validateBeforeCheckout } from '@/lib/pos-validation';
import { usePolling } from '@/hooks/use-polling';
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus';
import { usePermissions } from '@/hooks/use-permissions';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { ProductCatalog } from '@/components/POS/ProductCatalog';
import { CheckoutSummary } from '@/components/POS/CheckoutSummary';

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
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
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
      setCheckoutError('Anda tidak memiliki izin untuk melakukan transaksi POS.');
      toast.error('Anda tidak memiliki izin untuk melakukan transaksi POS.');
      return;
    }
    if (submitting) return;
    if (cart.length === 0) {
      setCheckoutError('Keranjang kosong.');
      toast.error('Keranjang kosong.');
      return;
    }
    if (buyerMode === 'REGISTERED' && !customerId) {
      setCheckoutError('Pilih pelanggan terdaftar atau beralih ke input manual.');
      toast.error('Pilih pelanggan terdaftar atau beralih ke input manual.');
      return;
    }
    if (buyerMode === 'MANUAL' && !walkInName.trim()) {
      setCheckoutError('Isi nama pembeli manual.');
      toast.error('Isi nama pembeli manual.');
      return;
    }

    const validation = validateBeforeCheckout({
      buyerMode,
      customerId,
      walkInName,
      items: cart.map((item) => ({ productId: item.productId, qty: item.qty, price: item.price })),
      discountType,
      discountAmount: discountValue,
      paymentMethod,
      paymentAmount: payment,
      subtotal,
      taxRate: Number(taxRate) || 0,
    });

    if (!validation.ok) {
      setCheckoutError(validation.message);
      toast.error(validation.message);
      return;
    }

    setSubmitting(true);
    setCheckoutError(null);

    if (checkoutTimeoutRef.current) {
      window.clearTimeout(checkoutTimeoutRef.current);
    }

    checkoutTimeoutRef.current = window.setTimeout(() => {
      setSubmitting(false);
      checkoutTimeoutRef.current = null;
      setCheckoutError('Waktu pemrosesan transaksi habis. Silakan coba lagi.');
      toast.error('Waktu pemrosesan transaksi habis. Silakan coba lagi.');
    }, 15000);

    try {
      const validationResult = await validatePosSale({
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

      if (!validationResult.success) {
        setCheckoutError(validationResult.message ?? 'Validasi checkout gagal.');
        toast.error(validationResult.message ?? 'Validasi checkout gagal.');
        return;
      }

      const result = await createPosSaleWithRetry({
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
        setCheckoutError(result.message ?? 'Gagal menyimpan transaksi.');
        toast.error(result.message ?? 'Gagal menyimpan transaksi.');
        return;
      }

      setCreatedInvoice(result.invoice ?? null);
      setReceiptHtml(result.receiptHtml ?? null);
      setCart([]);
      setDiscountAmount('0');
      setPaymentAmount('0');
      setTaxRate('0');
      setCheckoutError(null);
      toast.success(`Transaksi berhasil. ${result.changeAmount && result.changeAmount > 0 ? `Kembalian ${formatCurrency(result.changeAmount)}.` : 'Pembayaran lunas.'}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat memproses transaksi. Silakan coba lagi.';
      setCheckoutError(message);
      toast.error(message);
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
    if (!receiptHtml && !createdInvoice) return;
    const popup = window.open('', '_blank');
    if (popup) {
      popup.document.write(receiptHtml ?? `<!DOCTYPE html><html><body><p>Struk tidak tersedia.</p></body></html>`);
      popup.document.close();
      popup.focus();
      popup.print();
    }
  }

  const checkoutPanel = (
    <CheckoutSummary
      buyerMode={buyerMode}
      customers={customers}
      customerId={customerId}
      walkInName={walkInName}
      cart={cart}
      subtotal={subtotal}
      discountType={discountType}
      discountAmount={discountAmount}
      taxRate={taxRate}
      paymentMethod={paymentMethod}
      paymentAmount={paymentAmount}
      computedDiscount={computedDiscount}
      totals={totals}
      paymentSummary={paymentSummary}
      paymentError={paymentError}
      checkoutError={checkoutError}
      submitting={submitting}
      createdInvoice={createdInvoice}
      canManageSales={canManageSales}
      onBuyerModeChange={(mode) => {
        setBuyerMode(mode);
        if (mode === 'REGISTERED') {
          setWalkInName('');
        }
      }}
      onCustomerChange={setCustomerId}
      onWalkInNameChange={setWalkInName}
      onDiscountTypeChange={setDiscountType}
      onDiscountAmountChange={setDiscountAmount}
      onTaxRateChange={setTaxRate}
      onPaymentMethodChange={setPaymentMethod}
      onPaymentAmountChange={setPaymentAmount}
      onQuantityChange={updateQty}
      onRemoveItem={removeFromCart}
      onClearCart={() => setCart([])}
      onCheckout={handleCheckout}
      onPrint={handlePrint}
    />
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
        <ProductCatalog
          products={products}
          categories={categories}
          activeCategoryId={activeCategoryId}
          loadingProducts={loadingProducts}
          hasMoreProducts={hasMoreProducts}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onCategoryChange={setActiveCategoryId}
          onSearch={handleSearch}
          onLoadMore={loadMoreProducts}
          onAddToCart={addToCart}
        />

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
              <p className="mt-2 font-semibold text-zinc-900">{createdInvoice.walkInName?.trim() || 'Pelanggan'}</p>
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
