/**
 * Receipt generation utilities for POS system
 * These are client-safe utility functions for generating receipt HTML
 */

export function generateReceiptHTML(input: {
  invoice: {
    invoiceNumber: string;
    items?: Array<{ description: string; qty: number; price: number; subtotal: number }>;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    status: string;
    date: Date | string;
  };
  customerName: string;
}) {
  const lines = (input.invoice.items ?? [])
    .map(
      (item) => `
    <tr>
      <td>${item.description}</td>
      <td>${item.qty}</td>
      <td>${item.price.toLocaleString('id-ID')}</td>
      <td>${item.subtotal.toLocaleString('id-ID')}</td>
    </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
  <html>
    <head><meta charset="utf-8" /><title>Struk ${input.invoice.invoiceNumber}</title></head>
    <body style="font-family: Arial, sans-serif; padding: 24px; color: #111;">
      <h2>Struk Penjualan</h2>
      <p><strong>No. Invoice:</strong> ${input.invoice.invoiceNumber}</p>
      <p><strong>Pelanggan:</strong> ${input.customerName}</p>
      <p><strong>Tanggal:</strong> ${new Date(input.invoice.date).toLocaleString('id-ID')}</p>
      <table style="width:100%; border-collapse:collapse; margin-top: 12px;">
        <thead>
          <tr><th style="text-align:left; border-bottom:1px solid #ccc; padding:8px;">Produk</th><th style="text-align:left; border-bottom:1px solid #ccc; padding:8px;">Qty</th><th style="text-align:left; border-bottom:1px solid #ccc; padding:8px;">Harga</th><th style="text-align:left; border-bottom:1px solid #ccc; padding:8px;">Subtotal</th></tr>
        </thead>
        <tbody>${lines}</tbody>
      </table>
      <p style="margin-top: 12px;"><strong>Subtotal:</strong> ${input.invoice.subtotal.toLocaleString('id-ID')}</p>
      <p><strong>Diskon:</strong> ${input.invoice.discountAmount.toLocaleString('id-ID')}</p>
      <p><strong>Pajak:</strong> ${input.invoice.taxAmount.toLocaleString('id-ID')}</p>
      <p><strong>Total:</strong> ${input.invoice.totalAmount.toLocaleString('id-ID')}</p>
      <p><strong>Status:</strong> ${input.invoice.status}</p>
    </body>
  </html>`;
}
