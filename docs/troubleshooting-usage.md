# Usage Troubleshooting Guide

## Login Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| "Akun tidak ditemukan" | Wrong username | Verify username with admin |
| "PIN salah" | Incorrect PIN | Reset PIN via admin panel |
| "Akun terkunci" | 5 failed PIN attempts | Wait 15 min or ask admin to unlock in User Management |
| "Sesi berakhir" | Session timeout | Re-login (30 day maxAge) |
| Halaman tidak bisa diakses | Insufficient role | Contact admin for role upgrade |

## Appointment Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| "Dokter sudah memiliki jadwal" | Doctor double-booked | Choose different time or doctor |
| Tidak bisa membuat janji di masa lalu | Past date validation | Select future date |
| Status tidak bisa diubah | Invalid transition | Follow: WAITING → IN_PROGRESS → DONE |
| Appointment tidak muncul di portal | Customer filter | Only own appointments shown in portal |

## POS / Checkout Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| "Stok produk tidak mencukupi" | Insufficient inventory | Reduce quantity or restock |
| "Harga produk telah berubah" | Price updated since page load | Refresh POS page and retry |
| "Stok produk berubah saat diproses" | Concurrent sale | Retry the transaction |
| "Diskon tidak valid" | Discount makes total ≤ 0 | Reduce discount amount |

## Invoice / Billing Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| Invoice gagal dibuat | Stock or validation error | Check product stock and customer data |
| Pembayaran tidak tercatat | Race condition | Retry payment (atomic guard prevents double-payment) |
| Invoice tidak bisa dibatalkan | Status too far | Only UNPAID/PAID invoices can be cancelled |
| Nomor invoice tidak berurutan | Concurrent creation | Auto-retry handles this; numbers may skip on conflicts |

## Medical Record Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| Tidak bisa membuat rekam medis | Missing appointment | Create appointment first |
| Rekam medis tidak bisa diedit | Status is CLOSED | Closed records are read-only |
| Data tidak tersimpan | Validation error | Check all required fields |

## Pet Hotel Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| "Kamar sudah dipesan" | Room already booked | Select different room or date range |
| "Kamar tidak tersedia" | Room in MAINTENANCE/INACTIVE | Choose available room |
| Check-in gagal | Past booking date | Cannot check in to past dates |
| Check-out gagal | Room already checked out | Already completed |
