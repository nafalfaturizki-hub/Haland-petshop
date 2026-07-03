'use client';

import { useEffect, useMemo, useState } from 'react';
import { CreditCard, FileIcon, Printer, Plus, Trash2, Wallet } from 'lucide-react';
import { DataTable } from '@/components/shared/data-table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cancelInvoice, createInvoice, getInvoiceLookups, listInvoices, recordInvoicePayment } from '@/actions/invoice';

type InvoiceItemForm = {
  type: 'KONSULTASI' | 'TINDAKAN' | 'OBAT' | 'PET_HOTEL' | 'PRODUK';
  description: string;
  qty: string;
  price: string;
};

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  subtotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  taxRate?: number;
  notes?: string | null;
  date: string;
  customer: { name: string };
  items?: Array<{ id: string; description: string; qty: number; price: number; subtotal: number; type: string }>;
  payments?: Array<{ id: string; amount: number; method: string; date: string }>;
};

type CustomerOption = { id: string; name: string };

export default function BillingPage() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [message, setMessage] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    discountAmount: '0',
    taxRate: '0',
    notes: '',
    initialPaymentAmount: '0',
    initialPaymentMethod: 'CASH' as 'CASH' | 'NON_CASH',
  });
  const [itemForm, setItemForm] = useState<InvoiceItemForm>({ type: 'KONSULTASI', description: '', qty: '1', price: '0' });
  const [items, setItems] = useState<InvoiceItemForm[]>([]);
  const [paymentForm, setPaymentForm] = useState({ amount: '0', method: 'CASH' as 'CASH' | 'NON_CASH' });

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    const [lookupResult, invoicesResult] = await Promise.all([getInvoiceLookups(), listInvoices()]);
    if (lookupResult.success) setCustomers(lookupResult.customers ?? []);
    if (invoicesResult.success) setInvoices((invoicesResult.invoices ?? []).map((inv: any) => ({ ...inv, date: (inv.date as Date).toISOString() })));
  }

  const selectedInvoice = useMemo(() => invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null, [invoices, selectedInvoiceId]);

  function addItem() {
    if (!itemForm.description.trim()) {
      setMessage('Deskripsi item harus diisi.');
      return;
    }
    if (Number(itemForm.qty) <= 0 || Number(itemForm.price) < 0) {
      setMessage('Jumlah dan harga harus valid.');
      return;
    }

    setItems((current) => [...current, itemForm]);
    setItemForm({ ...itemForm, description: '', qty: '1', price: '0' });
    setMessage('');
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, idx) => idx !== index));
  }

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.qty) * Number(item.price), 0), [items]);
  const discount = Number(form.discountAmount) || 0;
  const taxRate = Number(form.taxRate) || 0;
  const taxableAmount = Math.max(0, subtotal - discount);
  const taxAmount = taxableAmount * (taxRate / 100);
  const totalAmount = taxableAmount + taxAmount;

  async function handleCreateInvoice(event: React.FormEvent) {
    event.preventDefault();
    if (!form.customerId) {
      setMessage('Pilih pelanggan.');
      return;
    }
    if (items.length === 0) {
      setMessage('Tambahkan minimal satu item invoice.');
      return;
    }

    setSubmitting(true);
    const result = await createInvoice({
      customerId: form.customerId,
      items: items.map((item) => ({
        type: item.type,
        description: item.description,
        qty: Number(item.qty),
        price: Number(item.price),
      })),
      discountAmount: discount,
      taxRate,
      notes: form.notes,
      initialPaymentAmount: Number(form.initialPaymentAmount),
      initialPaymentMethod: form.initialPaymentMethod,
    });

    if (!result.success) {
      setMessage(result.message ?? 'Gagal membuat invoice.');
      setSubmitting(false);
      return;
    }

    setMessage('Invoice berhasil dibuat.');
    setItems([]);
    setForm({ customerId: '', discountAmount: '0', taxRate: '0', notes: '', initialPaymentAmount: '0', initialPaymentMethod: 'CASH' });
    await loadData();
    setSubmitting(false);
  }

  async function handleRecordPayment(amount: number) {
    if (!selectedInvoiceId) return;
    if (!amount || amount <= 0) {
      setMessage('Jumlah pembayaran harus lebih besar dari nol.');
      return;
    }

    const result = await recordInvoicePayment({ invoiceId: selectedInvoiceId, method: paymentForm.method, amount });
    if (!result.success) {
      setMessage(result.message ?? 'Gagal mencatat pembayaran.');
      return;
    }
    setMessage('Pembayaran berhasil dicatat.');
    setPaymentForm({ amount: '0', method: 'CASH' });
    await loadData();
  }

  async function handleCancelInvoice() {
    if (!selectedInvoiceId) return;
    const result = await cancelInvoice({ id: selectedInvoiceId });
    if (!result.success) {
      setMessage(result.message ?? 'Gagal membatalkan invoice.');
      return;
    }
    setMessage('Invoice dibatalkan.');
    setSelectedInvoiceId(null);
    await loadData();
  }

  function printInvoice(invoice: any) {
    const paymentTotal = (invoice.payments ?? []).reduce((sum: number, payment: any) => sum + payment.amount, 0);
    const html = `<!DOCTYPE html><html><head><title>Invoice ${invoice.invoiceNumber}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1,h2,h3{margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{padding:8px;border:1px solid #ccc;text-align:left}strong{display:inline-block;width:140px}</style></head><body><h1>Invoice</h1><p><strong>No. Invoice:</strong> ${invoice.invoiceNumber}</p><p><strong>Pelanggan:</strong> ${invoice.customer.name}</p><p><strong>Tanggal:</strong> ${formatDate(invoice.date)}</p><p><strong>Status:</strong> ${invoice.status}</p><table><thead><tr><th>Jenis</th><th>Deskripsi</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>${(invoice.items ?? []).map((item: any) => `<tr><td>${item.type}</td><td>${item.description}</td><td>${item.qty}</td><td>${formatCurrency(item.price)}</td><td>${formatCurrency(item.subtotal)}</td></tr>`).join('')}</tbody></table><p><strong>Subtotal:</strong> ${formatCurrency(invoice.subtotal ?? 0)}</p><p><strong>Diskon:</strong> ${formatCurrency(invoice.discountAmount ?? 0)}</p><p><strong>Pajak:</strong> ${formatCurrency(invoice.taxAmount ?? 0)}</p><p><strong>Total:</strong> ${formatCurrency(invoice.totalAmount)}</p><p><strong>Pembayaran:</strong> ${formatCurrency(paymentTotal)}</p></body></html>`;
    const popup = window.open('', '_blank');
    if (popup) {
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      popup.print();
    }
  }

  function downloadInvoice(invoice: any) {
    const paymentTotal = (invoice.payments ?? []).reduce((sum: number, payment: any) => sum + payment.amount, 0);
    const html = `<!DOCTYPE html><html><head><title>Invoice ${invoice.invoiceNumber}</title></head><body><h1>Invoice</h1><p>No. Invoice: ${invoice.invoiceNumber}</p><p>Pelanggan: ${invoice.customer.name}</p><p>Tanggal: ${formatDate(invoice.date)}</p><p>Status: ${invoice.status}</p><p>Subtotal: ${formatCurrency(invoice.subtotal ?? 0)}</p><p>Diskon: ${formatCurrency(invoice.discountAmount ?? 0)}</p><p>Pajak: ${formatCurrency(invoice.taxAmount ?? 0)}</p><p>Total: ${formatCurrency(invoice.totalAmount)}</p><p>Pembayaran: ${formatCurrency(paymentTotal)}</p></body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.invoiceNumber}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const tableRows = invoices.map((invoice) => ({
    ...invoice,
    date: formatDate(invoice.date),
    totalAmount: invoice.totalAmount,
    customer: invoice.customer,
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-500">Modul Billing</p>
            <h1 className="text-xl font-semibold text-zinc-900">Invoice gabungan</h1>
          </div>
          <div className="flex items-center gap-2 text-zinc-700">
            <FileIcon className="h-5 w-5" />
            <span className="text-sm">Owner & Admin Klinik</span>
          </div>
        </div>
      </div>

      {message ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-zinc-700">
            <Plus className="h-4 w-4" />
            <h2 className="text-base font-semibold">Buat invoice baru</h2>
          </div>

          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <label className="block text-sm text-zinc-600">
              Pelanggan
              <select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="">Pilih pelanggan</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="block text-sm text-zinc-600">
                Jenis item
                <select value={itemForm.type} onChange={(event) => setItemForm({ ...itemForm, type: event.target.value as InvoiceItemForm['type'] })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                  <option value="KONSULTASI">KONSULTASI</option>
                  <option value="TINDAKAN">TINDAKAN</option>
                  <option value="OBAT">OBAT</option>
                  <option value="PET_HOTEL">PET_HOTEL</option>
                  <option value="PRODUK">PRODUK</option>
                </select>
              </label>

              <label className="block text-sm text-zinc-600">
                Qty
                <input type="number" min="1" value={itemForm.qty} onChange={(event) => setItemForm({ ...itemForm, qty: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
              </label>

              <label className="block text-sm text-zinc-600">
                Harga
                <input type="number" min="0" step="0.01" value={itemForm.price} onChange={(event) => setItemForm({ ...itemForm, price: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
              </label>
            </div>

            <label className="block text-sm text-zinc-600">
              Deskripsi
              <input type="text" value={itemForm.description} onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>

            <button type="button" onClick={addItem} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
              <Plus className="h-4 w-4" /> Tambah item
            </button>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-sm text-zinc-700">Item invoice saat ini</div>
              {items.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">Belum ada item.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {items.map((item, index) => (
                    <div key={`${item.description}-${index}`} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-zinc-700">
                        <p className="font-medium">{item.type}</p>
                        <p>{item.description}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-zinc-600">
                        <span>{item.qty} x {formatCurrency(Number(item.price))}</span>
                        <button type="button" onClick={() => removeItem(index)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700">Hapus</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm text-zinc-600">
                Diskon (Rp)
                <input type="number" min="0" value={form.discountAmount} onChange={(event) => setForm({ ...form, discountAmount: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
              </label>
              <label className="block text-sm text-zinc-600">
                Pajak (%)
                <input type="number" min="0" max="100" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
              </label>
            </div>

            <label className="block text-sm text-zinc-600">
              Catatan
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm text-zinc-600">
                Bayar awal (opsional)
                <input type="number" min="0" step="0.01" value={form.initialPaymentAmount} onChange={(event) => setForm({ ...form, initialPaymentAmount: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
              </label>
              <label className="block text-sm text-zinc-600">
                Metode pembayaran awal
                <select value={form.initialPaymentMethod} onChange={(event) => setForm({ ...form, initialPaymentMethod: event.target.value as 'CASH' | 'NON_CASH' })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                  <option value="CASH">Tunai</option>
                  <option value="NON_CASH">Non-tunai</option>
                </select>
              </label>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <div className="flex items-center justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex items-center justify-between"><span>Diskon</span><span>{formatCurrency(discount)}</span></div>
              <div className="flex items-center justify-between"><span>Pajak</span><span>{formatCurrency(taxAmount)}</span></div>
              <div className="mt-2 flex items-center justify-between text-base font-semibold text-zinc-900"><span>Total</span><span>{formatCurrency(totalAmount)}</span></div>
            </div>

            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70">
              <CreditCard className="h-4 w-4" /> {submitting ? 'Menyimpan...' : 'Simpan invoice'}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-zinc-700">
            <Wallet className="h-4 w-4" />
            <h2 className="text-base font-semibold">Daftar invoice</h2>
          </div>

          <DataTable
            title="Invoice terbaru"
            columns={[
              { key: 'invoiceNumber', header: 'No. Invoice' },
              { key: 'customer', header: 'Pelanggan', render: (row) => row.customer.name },
              { key: 'date', header: 'Tanggal' },
              { key: 'status', header: 'Status' },
              { key: 'totalAmount', header: 'Total', render: (row) => formatCurrency(row.totalAmount) },
              {
                key: 'id',
                header: 'Aksi',
                render: (row) => (
                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceId(row.id)}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700"
                  >
                    Pilih
                  </button>
                ),
              },
            ]}
            rows={tableRows}
            emptyMessage="Belum ada invoice"
          />

          <div className="mt-4 space-y-3">
            {selectedInvoice ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-zinc-600">Invoice terpilih</p>
                    <h3 className="text-lg font-semibold text-zinc-900">{selectedInvoice.invoiceNumber}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => printInvoice(selectedInvoice)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                      <Printer className="h-4 w-4" /> Cetak
                    </button>
                    <button type="button" onClick={() => downloadInvoice(selectedInvoice)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">Download</button>
                    <button type="button" onClick={handleCancelInvoice} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      <Trash2 className="h-4 w-4" /> Batalkan
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-zinc-700">
                  <p><strong>Pelanggan:</strong> {selectedInvoice.customer.name}</p>
                  <p><strong>Tanggal:</strong> {selectedInvoice.date}</p>
                  <p><strong>Status:</strong> {selectedInvoice.status}</p>
                  <p><strong>Subtotal:</strong> {formatCurrency(selectedInvoice.subtotal ?? 0)}</p>
                  <p><strong>Diskon:</strong> {formatCurrency(selectedInvoice.discountAmount ?? 0)}</p>
                  <p><strong>Pajak:</strong> {formatCurrency(selectedInvoice.taxAmount ?? 0)}</p>
                  <p><strong>Total:</strong> {formatCurrency(selectedInvoice.totalAmount)}</p>
                  <p><strong>Sisa tagihan:</strong> {formatCurrency(Math.max(0, (selectedInvoice.totalAmount ?? 0) - ((selectedInvoice.payments ?? []).reduce((sum: number, payment: any) => sum + payment.amount, 0))))}</p>
                  {selectedInvoice.notes ? <p><strong>Catatan:</strong> {selectedInvoice.notes}</p> : null}
                </div>
                <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3">
                  <p className="text-sm font-semibold text-zinc-900">Catat pembayaran</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder="Jumlah pembayaran" />
                    <select value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value as 'CASH' | 'NON_CASH' }))} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                      <option value="CASH">Tunai</option>
                      <option value="NON_CASH">Non-tunai</option>
                    </select>
                    <button type="button" onClick={() => void handleRecordPayment(Number(paymentForm.amount))} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Simpan</button>
                  </div>
                </div>
                <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3">
                  <p className="text-sm font-semibold text-zinc-900">Riwayat pembayaran</p>
                  {(selectedInvoice.payments ?? []).length === 0 ? <p className="mt-2 text-sm text-zinc-500">Belum ada pembayaran.</p> : <ul className="mt-2 space-y-2 text-sm text-zinc-700">{(selectedInvoice.payments ?? []).map((payment: any) => <li key={payment.id} className="flex items-center justify-between"><span>{formatDate(payment.date)} • {payment.method}</span><span>{formatCurrency(payment.amount)}</span></li>)}</ul>}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">Pilih invoice dari daftar untuk melihat detail.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
