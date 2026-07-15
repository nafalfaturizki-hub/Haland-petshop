import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createPosSaleWithRetry, listPosProducts, listProductCategories, validatePosSale } from '@/actions/pos';
import { getInvoiceLookups } from '@/actions/invoice';
import { calculatePosTotals, getPaymentSummary, roundCurrency, validatePosCheckout } from '@/lib/pos';
import { usePolling } from '@/hooks/use-polling';
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus';
import { usePermissions } from '@/hooks/use-permissions';
import { getPosCartSubtotal, type CartItem, type CategoryChip, type CustomerOption, type ProductRow } from '@/utils/pos-helpers';

const CART_STORAGE_KEY = 'haland-pos-cart';

export function usePosState() {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryChip[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [buyerMode, setBuyerMode] = useState<'REGISTERED' | 'MANUAL'>('REGISTERED');
  const [walkInName, setWalkInName] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [paymentAmount, setPaymentAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'NON_CASH'>('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [taxRate, setTaxRate] = useState('0');
  const [createdInvoice, setCreatedInvoice] = useState<any | null>(null);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'catalog' | 'checkout'>('catalog');
  const skipRef = useRef(0);
  const checkoutTimeoutRef = useRef<number | null>(null);
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

  useRefetchOnFocus(loadCustomers);
  usePolling(loadCustomers, 30000);

  const addToCart = useCallback((product: ProductRow) => {
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
  }, []);

  const updateQty = useCallback((productId: string, qty: number) => {
    setCart((current) =>
      current
        .map((item) => (item.productId === productId ? { ...item, qty: Math.max(1, Math.min(qty, item.stock)) } : item))
        .filter((item) => item.qty > 0),
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((current) => current.filter((item) => item.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const resetCheckout = useCallback(() => {
    setDiscountAmount('0');
    setPaymentAmount('0');
    setTaxRate('0');
    setCheckoutError(null);
    setCreatedInvoice(null);
    setReceiptHtml(null);
    setCustomerId('');
    setWalkInName('');
    setBuyerMode('REGISTERED');
    setCurrentStep('catalog');
  }, []);

  const subtotal = useMemo(() => getPosCartSubtotal(cart), [cart]);
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

  const handleSearch = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    await loadProducts(false);
  }, [loadProducts]);

  const handleCheckout = useCallback(async () => {
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
        items: cart.map((item) => ({ productId: item.productId, qty: item.qty, price: item.price, description: item.name })),
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
        items: cart.map((item) => ({ productId: item.productId, qty: item.qty, price: item.price, description: item.name })),
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

      setCreatedInvoice(result.invoice);
      setReceiptHtml(result.receiptHtml ?? null);
      clearCart();
      resetCheckout();
      toast.success(`Transaksi berhasil. ${result.changeAmount && result.changeAmount > 0 ? `Kembalian ${formatCurrency(result.changeAmount)}.` : 'Pembayaran lunas.'}`);
    } catch (error) {
      console.error(error);
      setCheckoutError('Terjadi kesalahan saat memproses transaksi. Silakan coba lagi.');
      toast.error('Terjadi kesalahan saat memproses transaksi. Silakan coba lagi.');
    } finally {
      if (checkoutTimeoutRef.current) {
        window.clearTimeout(checkoutTimeoutRef.current);
      }
      checkoutTimeoutRef.current = null;
      setSubmitting(false);
    }
  }, [canManageSales, cart, buyerMode, customerId, walkInName, discountType, discountValue, paymentMethod, payment, subtotal, taxRate, submitting, clearCart]);

  return {
    searchQuery,
    setSearchQuery,
    products,
    categories,
    activeCategoryId,
    setActiveCategoryId,
    loadingProducts,
    hasMoreProducts,
    customers,
    cart,
    customerId,
    setCustomerId,
    buyerMode,
    setBuyerMode,
    walkInName,
    setWalkInName,
    discountType,
    setDiscountType,
    discountAmount,
    setDiscountAmount,
    paymentAmount,
    setPaymentAmount,
    paymentMethod,
    setPaymentMethod,
    taxRate,
    setTaxRate,
    submitting,
    createdInvoice,
    receiptHtml,
    checkoutError,
    currentStep,
    setCurrentStep,
    canManageSales,
    isRestrictedStaff,
    subtotal,
    computedDiscount,
    totals,
    paymentSummary,
    paymentError,
    addToCart,
    updateQty,
    removeFromCart,
    clearCart,
    handleSearch,
    loadMoreProducts,
    handleCheckout,
    setCheckoutError,
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}
