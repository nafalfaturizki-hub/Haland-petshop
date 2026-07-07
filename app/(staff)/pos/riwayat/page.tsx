'use client';

import { useEffect, useMemo, useState } from 'react';
import { History, Printer, Search } from 'lucide-react';
import { toast } from 'sonner';
import { getPosTransactionDetail, getPosTransactionHistory } from '@/actions/pos';
import { formatCurrency, formatDate } from '@/lib/utils';

type TransactionRow = {
  id: string;
  invoiceNumber: string;
  date: Date | string;
  customerName: string;
  cashierName: string;
  itemCount: number;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  paymentAmount: number;
};

export default function PosHistoryPage() {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', customerId: '', query: '' });
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  async function loadTransactions(nextPage = 1) {
    setLoading(true);
    const result = await getPosTransactionHistory({
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      customerId: filters.customerId || undefined,
      page: nextPage,
      pageSize,
    });

    if (result.success) {
      setRows((result.transactions ?? []) as TransactionRow[]);
      setPage(result.pagination?.page ?? 1);
      setTotalPages(result.pagination?.totalPages ?? 1);
    } else {
      toast.error(result.message ?? 'Gagal memuat riwayat transaksi.');
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadTransactions(1);
  }, []);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const query = filters.query.trim().toLowerCase();
    if (!query) return true;
    return row.invoiceNumber.toLowerCase().includes(query) || row.customerName.toLowerCase().includes(query);
  }), [filters.query, rows]);

  async function handleOpenDetail(invoiceId: string) {
    const result = await getPosTransactionDetail(invoiceId);
    if (result.success) {
      setSelectedInvoice(result.invoice);
    } else {
      toast.error(result.message ?? 'Gagal memuat detail transaksi.');
    }
  }

  function handlePrint(invoice: any) {
    if (!invoice) return;
    const customerName = invoice.walkInName?.trim() || invoice.customerName || 'Pelanggan';
    const html = `<!DOCTYPE html><html><head><title>Struk ${invoice.invoiceNumber}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1,h2,h3{margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{padding:8px;border:1px solid #ccc;text-align:left}strong{display:inline-block;width:120px}</style></head><body><h1>Struk Penjualan</h1><p><strong>No. Invoice:</strong> ${invoice.invoiceNumber}</p><p><strong>Pelanggan:</strong> ${customerName}</p><p><strong>Tanggal:</strong> ${formatDate(invoice.date)}</p><table><thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>${invoice.items.map((item: any) => `<tr><td>${item.description}</td><td>${item.qty}</td><td>${formatCurrency(item.price)}</td><td>${formatCurrency(item.subtotal)}</td></tr>`).join('')}</tbody></table><p><strong>Total:</strong> ${formatCurrency(invoice.totalAmount)}</p><p><strong>Status:</strong> ${invoice.status}</p></body></html>`;
    const popup = window.open('', '_blank');
    if (popup) {
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      popup.print();
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-500">Modul POS</p>
            <h1 className="text-xl font-semibold text-zinc-900">Riwayat transaksi</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
            <History className="h-4 w-4" /> Histori penjualan
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm text-zinc-600">
            Tanggal mulai
            <input type="date" value={filters.startDate} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>
          <label className="text-sm text-zinc-600">
            Tanggal akhir
            <input type="date" value={filters.endDate} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>
          <label className="text-sm text-zinc-600">
            Cari invoice / pelanggan
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2">
              <Search className="h-4 w-4 text-zinc-500" />
              <input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} className="w-full bg-transparent outline-none" placeholder="Nomor invoice / nama" />
            </div>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => { setFilters({ startDate: '', endDate: '', customerId: '', query: '' }); void loadTransactions(1); }} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">Reset</button>
          <button type="button" onClick={() => void loadTransactions(1)} className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white">Terapkan</button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-600">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Pelanggan</th>
                <th className="px-4 py-3">Kasir</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">Memuat riwayat...</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">Belum ada transaksi.</td></tr>
              ) : filteredRows.map((row) => (
                <tr key={row.id} className="cursor-pointer hover:bg-zinc-50" onClick={() => void handleOpenDetail(row.id)}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{row.invoiceNumber}</td>
                  <td className="px-4 py-3">{formatDate(row.date)}</td>
                  <td className="px-4 py-3">{row.customerName}</td>
                  <td className="px-4 py-3">{row.cashierName}</td>
                  <td className="px-4 py-3">{row.itemCount}</td>
                  <td className="px-4 py-3">{formatCurrency(row.totalAmount)}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">{row.status}</span></td>
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <button type="button" onClick={() => handlePrint(selectedInvoice ?? null)} className="rounded-lg border border-zinc-200 p-2 text-zinc-700">
                      <Printer className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-200 p-4 text-sm text-zinc-600">
          <span>Halaman {page} / {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page === 1} onClick={() => void loadTransactions(page - 1)} className="rounded-lg border border-zinc-200 px-3 py-2 disabled:opacity-50">Sebelumnya</button>
            <button type="button" disabled={page === totalPages} onClick={() => void loadTransactions(page + 1)} className="rounded-lg border border-zinc-200 px-3 py-2 disabled:opacity-50">Berikutnya</button>
          </div>
        </div>
      </div>

      {selectedInvoice ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500">Detail transaksi</p>
              <h2 className="text-lg font-semibold text-zinc-900">{selectedInvoice.invoiceNumber}</h2>
            </div>
            <button type="button" onClick={() => handlePrint(selectedInvoice)} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">Cetak ulang struk</button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700"><p className="text-zinc-500">Pelanggan</p><p className="mt-1 font-semibold text-zinc-900">{selectedInvoice.customerName}</p></div>
            <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700"><p className="text-zinc-500">Pembayaran</p><p className="mt-1 font-semibold text-zinc-900">{selectedInvoice.paymentMethod}</p></div>
            <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700"><p className="text-zinc-500">Total</p><p className="mt-1 font-semibold text-zinc-900">{formatCurrency(selectedInvoice.totalAmount)}</p></div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-600">
                <tr><th className="px-3 py-2">Produk</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Harga</th><th className="px-3 py-2">Subtotal</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {selectedInvoice.items?.map((item: any) => (
                  <tr key={item.id}><td className="px-3 py-2">{item.description}</td><td className="px-3 py-2">{item.qty}</td><td className="px-3 py-2">{formatCurrency(item.price)}</td><td className="px-3 py-2">{formatCurrency(item.subtotal)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
