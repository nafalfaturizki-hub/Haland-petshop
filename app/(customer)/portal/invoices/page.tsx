'use client';

import { useEffect, useState } from 'react';
import { FileIcon, Printer } from 'lucide-react';
import { DataTable } from '@/components/shared/data-table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getPortalInvoices } from '@/actions/invoice';

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  date: string;
  items: Array<{ description: string; type: string; qty: number; price: number; subtotal: number }>;
  payments: Array<{ method: string; amount: number; date: string }>;
};

export default function CustomerInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    void loadInvoices();
  }, []);

  async function loadInvoices() {
    const result = await getPortalInvoices();
    if (result.success) {
      setInvoices((result.invoices ?? []).map((inv: any) => ({ ...inv, date: (inv.date as Date).toISOString() })));
    }
  }

  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null;

  function printInvoice(invoice: Invoice) {
    const html = `<!DOCTYPE html><html><head><title>Invoice ${invoice.invoiceNumber}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1,h2,h3{margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{padding:8px;border:1px solid #ccc;text-align:left}strong{display:inline-block;width:140px}</style></head><body><h1>Invoice</h1><p><strong>No. Invoice:</strong> ${invoice.invoiceNumber}</p><p><strong>Tanggal:</strong> ${formatDate(invoice.date)}</p><p><strong>Status:</strong> ${invoice.status}</p><table><thead><tr><th>Jenis</th><th>Deskripsi</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>${invoice.items.map((item) => `<tr><td>${item.type}</td><td>${item.description}</td><td>${item.qty}</td><td>${formatCurrency(item.price)}</td><td>${formatCurrency(item.subtotal)}</td></tr>`).join('')}</tbody></table><p><strong>Total:</strong> ${formatCurrency(invoice.totalAmount)}</p><p><strong>Pembayaran:</strong> ${formatCurrency(invoice.payments.reduce((sum, payment) => sum + payment.amount, 0))}</p></body></html>`;
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-500">Tagihan Pelanggan</p>
            <h1 className="text-xl font-semibold text-zinc-900">Riwayat invoice Anda</h1>
          </div>
          <div className="flex items-center gap-2 text-zinc-700">
            <FileIcon className="h-5 w-5" />
            <span className="text-sm">Read-only</span>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <DataTable
          title="Invoice milik Anda"
          columns={[
            { key: 'invoiceNumber', header: 'No. Invoice' },
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
                  Buka
                </button>
              ),
            },
          ]}
          rows={invoices.map((invoice) => ({ ...invoice, date: formatDate(invoice.date) }))}
          emptyMessage="Belum ada invoice."
        />

        {selectedInvoice ? (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-zinc-600">Detail invoice</p>
                <h2 className="text-lg font-semibold text-zinc-900">{selectedInvoice.invoiceNumber}</h2>
              </div>
              <button type="button" onClick={() => printInvoice(selectedInvoice)} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700">
                <Printer className="h-4 w-4" /> Cetak PDF
              </button>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-zinc-700">
              <p><strong>Tanggal:</strong> {formatDate(selectedInvoice.date)}</p>
              <p><strong>Status:</strong> {selectedInvoice.status}</p>
              <p><strong>Total:</strong> {formatCurrency(selectedInvoice.totalAmount)}</p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-zinc-600">
                  <tr>
                    <th className="px-3 py-2">Jenis</th>
                    <th className="px-3 py-2">Deskripsi</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Harga</th>
                    <th className="px-3 py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items.map((item, index) => (
                    <tr key={index} className="border-t border-zinc-200">
                      <td className="px-3 py-2">{item.type}</td>
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2">{item.qty}</td>
                      <td className="px-3 py-2">{formatCurrency(item.price)}</td>
                      <td className="px-3 py-2">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-500">Pilih invoice dari daftar untuk melihat detail dan unduh PDF.</div>
        )}
      </section>
    </div>
  );
}
