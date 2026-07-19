# PRD — Haland PetCare Management System
### Sumber Kebenaran Mutlak (Single Source of Truth) — Target Implementasi Final End-to-End

> Dokumen ini adalah **spesifikasi target akhir**, bukan cerminan kondisi kode saat ini dan bukan roadmap bertahap. Setiap butir di sini adalah kondisi yang **harus** tercapai agar sistem dinyatakan selesai, production-ready, dan enterprise-ready.

---

## 1. Visi Produk

Haland PetCare adalah sistem manajemen klinik hewan + pet shop + pet hotel + point-of-sale terintegrasi dalam satu aplikasi web, melayani dua populasi pengguna:
- **Staff internal** (Owner, Admin Klinik, Dokter) — mengelola operasional klinik end-to-end.
- **Customer** (pemilik hewan) — mengakses portal mandiri untuk melihat riwayat hewan peliharaan, janji temu, tagihan, dan booking pet hotel.

Sistem harus berjalan sebagai **satu aplikasi Next.js full-stack**, dengan **satu database Postgres (Neon)**, di-deploy ke Vercel tanpa konfigurasi manual selain menghubungkan integrasi Neon dari Vercel Marketplace.

---

## 2. Tujuan & Definisi "Selesai"

Sistem dinyatakan **selesai (Definition of Done)** jika dan hanya jika:
1. Seluruh modul di Bagian 6 berfungsi end-to-end tanpa data mock/placeholder, tanpa halaman "coming soon", tanpa tombol non-fungsional.
2. Seluruh alur ditulis-baca database secara nyata melalui Prisma, konsisten dengan schema di Bagian 5.
3. `npm run build`, `npm run typecheck`, `npm run lint`, dan seluruh test (`npm test`, `npm run test:e2e`) lulus tanpa error/skip yang disembunyikan.
4. Deploy ke Vercel dari repo bersih (fresh clone, fresh Neon database) berhasil **tanpa intervensi manual** selain: (a) klik "Add Integration → Neon" di Vercel Marketplace, (b) set `AUTH_SECRET`. Migrasi schema, generate Prisma client, dan seed akun awal berjalan otomatis saat build/deploy pertama.
5. Tidak ada celah keamanan kelas OWASP Top 10 yang terbuka pada fitur yang ada (lihat Bagian 8).
6. Setiap role hanya bisa melakukan aksi yang diizinkan matriks permission (Bagian 4), diverifikasi baik di UI, di server action, maupun di middleware (defense in depth 3 lapis).

---

## 3. Aktor Sistem

| Role | Deskripsi | Login |
|---|---|---|
| **OWNER** | Pemilik bisnis. Akses penuh ke semua modul termasuk override harga, manajemen user, dan pengaturan sistem. | username + PIN 6 digit |
| **ADMIN_KLINIK** | Staff administrasi/resepsionis. Operasional harian penuh kecuali override harga owner dan pengaturan sistem tingkat lanjut. | username + PIN 6 digit |
| **DOKTER** | Dokter hewan. Fokus pada rekam medis, appointment, dan data pasien (pet). Tidak mengelola uang/inventori. | username + PIN 6 digit |
| **CUSTOMER** | Pemilik hewan. Akses hanya ke portalnya sendiri (data miliknya, tidak bisa lihat data customer lain). | username + PIN 6 digit, atau tercatat sebagai guest walk-in tanpa akun |

Autentikasi **selalu** username + PIN numerik 6 digit (bukan password teks bebas, bukan email/OTP) — ini adalah keputusan produk final, bukan sementara.

---

## 4. Matriks Permission Final (Sumber Kebenaran)

| Modul | OWNER | ADMIN_KLINIK | DOKTER | CUSTOMER |
|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ❌ (punya dashboard portal sendiri) |
| Customers (CRUD) | ✅ | ✅ | 👁️ view only | ❌ |
| Pets (CRUD + monitoring) | ✅ | ✅ | ✅ | 👁️ hanya pet miliknya |
| Appointments | ✅ | ✅ | ✅ (miliknya + semua untuk lihat) | ✅ hanya booking miliknya |
| Medical Records | ✅ | 👁️ view only | ✅ full CRUD + ubah status workflow | 👁️ hanya milik pet-nya |
| Procedures (master data harga tindakan) | ✅ CRUD | ✅ CRUD | 👁️ view only | ❌ |
| Pet Hotel (room + booking) | ✅ | ✅ | 👁️ log only | ✅ booking milik sendiri |
| Petshop (produk, kategori, supplier, stok) | ✅ CRUD + override harga | ✅ CRUD (tanpa override harga owner) | ❌ | ❌ |
| POS (kasir) | ✅ | ✅ | ❌ | ❌ |
| Billing/Invoice | ✅ | ✅ | ❌ | 👁️ hanya invoice miliknya |
| Reports | ✅ full financial | ✅ full financial | 👁️ operasional non-finansial | ❌ |
| Users (staff management) | ✅ CRUD semua role | 👁️ tidak akses | ❌ | ❌ |
| Settings (identitas klinik, penomoran, dsb) | ✅ | ❌ | ❌ | ❌ |
| Notifications | ✅ | ✅ | ✅ | ✅ (miliknya) |
| Profile & ubah PIN | ✅ | ✅ | ✅ | ✅ |

**Aturan mutlak**: Setiap route staff (`/dashboard`, `/customers`, dst) divalidasi middleware terhadap matriks ini SEBELUM render halaman. Setiap server action memvalidasi ulang role dari session (bukan dari parameter yang dikirim client) SEBELUM eksekusi mutasi data. UI hanya menyembunyikan tombol yang tidak diizinkan — bukan satu-satunya lapis proteksi.

---

## 5. Model Data (Entitas Inti)

Domain final terdiri dari entitas berikut (relasi wajib konsisten dengan ini, tidak boleh ada field orphan atau relasi yang tidak dipakai):

- **User** — staff/customer login, `role`, `pinHash`, status lock/aktif, `mustChangePin`.
- **Customer** — data pemilik hewan, boleh `isGuest=true` (walk-in tanpa akun login), boleh terhubung ke `User` via `userId`.
- **Pet** — milik satu Customer; punya riwayat berat badan (`PetWeightLog`), vaksin (`PetVaccineRecord`), penyakit (`PetDiseaseRecord`), alergi (`PetAllergy`).
- **Appointment** — booking konsultasi/tindakan, status `WAITING → IN_PROGRESS → DONE` atau `CANCELLED`, terhubung ke dokter (`User`), pet, dan customer.
- **MedicalRecord** — hasil pemeriksaan dokter, status workflow `OPEN → IN_PROGRESS → COMPLETED → CLOSED`, terhubung ke appointment, pet, customer.
- **Procedure** — master data tindakan/jasa medis beserta harga standar.
- **PetHotelRoom** — kamar inap, status `AVAILABLE/RESERVED/OCCUPIED/MAINTENANCE/INACTIVE`, harga per malam.
- **PetHotelBooking** — reservasi kamar, status `BOOKED → CHECKED_IN → CHECKED_OUT` atau `CANCELLED`, bisa multi-pet per booking (`PetHotelBookingPet`), punya log harian (`PetHotelLog`: FEEDING/MEDICINE/NOTE).
- **Product** — barang dagangan pet shop: stok, harga jual/beli/modal, `ownerPriceOverride` (harga khusus yang hanya bisa di-set OWNER dengan alasan tercatat), kategori, supplier, status ACTIVE/ARCHIVED.
- **StockMovement** — mutasi stok (IN/OUT/ADJUSTMENT/RETURN/DAMAGED/EXPIRED/CORRECTION/OPNAME), setiap perubahan stok WAJIB tercatat di sini (tidak boleh update `Product.stock` langsung tanpa jejak movement).
- **PriceChangeLog** — jejak audit setiap perubahan harga produk.
- **Invoice** — tagihan gabungan dari KONSULTASI/TINDAKAN/OBAT/PET_HOTEL/PRODUK, status `UNPAID → PARTIAL_PAYMENT → PAID` atau `CANCELLED`.
- **InvoiceItem** — baris item invoice, harga **selalu dihitung ulang di server** dari sumber aslinya (harga produk, harga procedure, harga kamar × malam) — tidak pernah dipercaya dari input client.
- **Payment** — pembayaran cicilan/lunas terhadap invoice, metode CASH/NON_CASH.
- **Notification** — notifikasi in-app per user.
- **AuditLog** — jejak seluruh aksi sensitif (login, logout, perubahan data kritikal, perubahan harga, dsb) — wajib untuk semua mutasi finansial dan akun.
- **Settings** — konfigurasi tunggal (single-row) untuk identitas klinik, format penomoran, jam operasional, dsb.

---

## 6. Spesifikasi Fungsional & Workflow End-to-End per Modul

### 6.1 Autentikasi & Sesi
- Login: input username + 6 digit PIN → validasi via `bcrypt.compare` → JWT session (maks 7 hari) berisi `id, role, username, mustChangePin`.
- **Lockout**: 5 kali PIN salah berturut-turut → akun terkunci 15 menit, tercatat di `AuditLog`. Percobaan reset ke 0 setelah PIN benar.
- **Wajib ganti PIN**: user dengan `mustChangePin=true` (baru dibuat/direset) dipaksa redirect ke `/change-pin` sebelum bisa akses modul lain.
- **Revokasi sesi real-time**: setiap request, JWT callback mengecek ulang status user di DB (`isActive`, `isLocked`) — jika user dinonaktifkan oleh admin, sesi yang sedang aktif langsung invalid pada request berikutnya (bukan menunggu token expired).
- Logout mencatat `AuditLog` dan menghapus sesi klien sepenuhnya.
- Redirect pasca-login berdasarkan role: staff → `/dashboard`, customer → `/portal`.

### 6.2 Dashboard (Staff)
- Ringkasan KPI harian: jumlah appointment hari ini per status, pendapatan harian, occupancy pet hotel, stok produk menipis (di bawah `minStock`), tagihan belum lunas.
- Semua angka dihitung real-time dari database (agregasi Prisma), bukan dihardcode/cache statis kecuali untuk chart historis yang boleh menggunakan cache pendek dengan invalidation jelas.

### 6.3 Manajemen Customer
- CRUD data pemilik hewan: nama, telepon (wajib unik secara logis untuk pencarian), alamat, email opsional.
- Dukungan customer **guest/walk-in** (`isGuest=true`) untuk transaksi POS cepat tanpa harus membuat akun login.
- Setiap customer bisa memiliki banyak Pet dan riwayat Invoice.
- Halaman detail customer (`/customers/[id]`) menampilkan seluruh histori: pet, appointment, invoice, pet hotel booking dalam satu tampilan terpadu.

### 6.4 Manajemen Pet & Monitoring Kesehatan
- CRUD data hewan: nama, spesies, ras, jenis kelamin, tanggal lahir, foto (opsional, disimpan sebagai URL — lihat Bagian 9 soal storage).
- **Weight log**: riwayat berat badan dari waktu ke waktu, ditampilkan sebagai grafik tren.
- **Vaccine record**: riwayat vaksinasi dengan tanggal dan jenis vaksin, dengan pengingat vaksin berikutnya (jika tanggal jatuh tempo terlewati, tampil badge peringatan).
- **Disease record** & **Allergy**: catatan riwayat penyakit dan alergi, dipakai dokter sebagai referensi saat pemeriksaan.
- Customer bisa melihat (read-only) seluruh data monitoring pet miliknya sendiri di portal (`/portal/pets-monitoring/[petId]`).

### 6.5 Appointment (Janji Temu)
- Booking appointment oleh staff (untuk semua customer) atau oleh customer sendiri (untuk pet miliknya) di portal.
- Validasi **anti-double-booking dokter**: pengecekan konflik jadwal dokter dan pembuatan appointment WAJIB dalam satu transaksi atomik (mencegah race condition dua booking simultan pada slot sama).
- Status lifecycle: `WAITING → IN_PROGRESS → DONE`, atau dibatalkan (`CANCELLED`) dengan alasan.
- Saat status `IN_PROGRESS`, dokter dapat langsung membuat `MedicalRecord` terhubung ke appointment tersebut.
- Notifikasi otomatis ke customer saat appointment dikonfirmasi/diubah/dibatalkan.

### 6.6 Rekam Medis (Medical Record)
- Dibuat oleh Dokter, terhubung ke appointment (opsional), pet, dan customer.
- Field: keluhan, diagnosis, tindakan yang diberikan, resep obat, catatan lanjutan, berat badan saat pemeriksaan (otomatis menambah entry ke `PetWeightLog`).
- Workflow status: `OPEN → IN_PROGRESS → COMPLETED → CLOSED`. Perubahan status tercatat waktunya. Hanya Dokter yang membuat atau Owner yang dapat mengubah status setelah `COMPLETED`.
- Setiap tindakan/obat dalam rekam medis dapat langsung dijadikan baris item saat pembuatan Invoice (linked, bukan re-entry manual).
- Customer dapat melihat (read-only) rekam medis pet miliknya di portal, kecuali data yang ditandai catatan internal (jika ada kebutuhan privasi catatan dokter, harus ada flag `isInternalNote` — final decision: **semua catatan medis yang berkaitan dengan pet ditampilkan ke pemilik**, tidak ada catatan tersembunyi, demi transparansi layanan).

### 6.7 Procedures (Master Tindakan)
- CRUD daftar tindakan/jasa (misal: vaksinasi, grooming, USG) beserta kode dan harga standar.
- Harga procedure adalah harga dasar; penyesuaian harga per-transaksi (diskon) hanya dilakukan di level Invoice, bukan mengubah master data.

### 6.8 Pet Hotel
- **Manajemen kamar**: CRUD kamar (nama, nomor, tipe, kapasitas, harga per malam), status kamar (AVAILABLE/RESERVED/OCCUPIED/MAINTENANCE/INACTIVE) dan status kebersihan/perawatan terpisah untuk operasional housekeeping.
- **Booking**: staff atau customer dapat membuat booking (multi-pet dalam satu booking didukung), sistem menghitung otomatis jumlah malam dan estimasi biaya dari `room.pricePerNight`.
- **Check-in/check-out**: perubahan status `BOOKED → CHECKED_IN → CHECKED_OUT` mencatat waktu aktual (`actualCheckInAt/actualCheckOutAt`), yang menjadi basis perhitungan harga final di invoice (bukan estimasi awal jika berbeda dari rencana).
- **Log harian**: staff mencatat log FEEDING/MEDICINE/NOTE per booking, dengan foto opsional — customer bisa melihat log ini secara real-time sebagai bentuk transparansi (fitur "monitoring" titipan hewan).
- Harga PET_HOTEL pada invoice **selalu dihitung server-side** dari `room.pricePerNight × jumlah malam aktual`, tidak pernah menerima harga dari input client (mencegah manipulasi harga).

### 6.9 Petshop (Produk & Inventori)
- CRUD produk: nama, SKU, barcode, kategori, supplier, harga beli/modal/jual, stok, stok minimum/maksimum, status ACTIVE/ARCHIVED.
- **Override harga khusus Owner**: field `ownerPriceOverride` hanya dapat diisi oleh role OWNER, wajib disertai alasan (`ownerPriceOverrideReason`), tercatat waktu perubahan. Saat ada override aktif, harga ini yang dipakai di POS, bukan `sellPrice` biasa.
- **Setiap perubahan harga** (baik `sellPrice` normal maupun override) tercatat di `PriceChangeLog` dengan harga lama, harga baru, siapa yang mengubah, dan alasan.
- **Manajemen stok**: setiap penambahan/pengurangan stok (restock, penjualan, opname, kerusakan, kadaluarsa, koreksi) WAJIB melalui `StockMovement` — dilarang keras update `Product.stock` langsung tanpa jejak.
- Export data produk ke CSV untuk kebutuhan laporan/backup manual.
- Halaman inventory terpisah dari halaman katalog produk: inventory fokus ke stok/movement, produk fokus ke katalog & harga.

### 6.10 POS (Point of Sale)
- Kasir memilih customer (termasuk opsi walk-in/guest instan) → tambah produk ke keranjang → sistem menghitung subtotal, diskon, pajak sesuai `Settings.taxRate` (jika ada) → checkout.
- Checkout membuat `Invoice` + `InvoiceItem` (tipe PRODUK) + mengurangi stok via `StockMovement` (type OUT) dalam **satu transaksi atomik** — jika salah satu gagal (misal stok tidak cukup di tengah transaksi konkuren), seluruh transaksi rollback, tidak boleh ada invoice tanpa pengurangan stok atau sebaliknya.
- Cetak struk langsung dari browser (print-friendly HTML), termasuk untuk transaksi walk-in tanpa harus login sebagai customer.
- Riwayat transaksi POS (`/pos/riwayat`) dengan filter tanggal, pencarian invoice, cetak ulang struk.

### 6.11 Billing / Invoice
- Invoice dapat berisi campuran tipe item: KONSULTASI, TINDAKAN, OBAT (hanya bisa ditambahkan manual oleh OWNER/ADMIN_KLINIK), PET_HOTEL (harga server-computed), PRODUK (dari POS/katalog).
- Pembayaran: mendukung cicilan (`PARTIAL_PAYMENT`) — setiap pembayaran baru divalidasi **di dalam transaksi atomik** agar jumlah total pembayaran tidak pernah melebihi total tagihan meski ada dua request pembayaran simultan (race-condition safe).
- Status invoice otomatis berubah: `UNPAID → PARTIAL_PAYMENT → PAID` berdasarkan akumulasi pembayaran; `CANCELLED` hanya bisa dilakukan oleh OWNER/ADMIN_KLINIK dengan alasan tercatat.
- Nomor invoice dihasilkan otomatis sesuai prefix yang dikonfigurasi di Settings, unik, retry otomatis jika terjadi collision (TOCTOU-safe).
- Cetak/unduh invoice sebagai dokumen (HTML print, dengan seluruh data pelanggan/produk **di-escape aman** sebelum dirender ke DOM/print window — tidak ada celah injeksi).
- Customer melihat seluruh riwayat invoice miliknya di portal, termasuk status pembayaran dan rincian item.

### 6.12 Reports (Laporan)
- Laporan finansial: pendapatan per periode (harian/mingguan/bulanan), breakdown per jenis layanan (konsultasi/tindakan/obat/pet hotel/produk), metode pembayaran.
- Laporan operasional: okupansi pet hotel, jumlah appointment per dokter, produk terlaris, produk stok kritis.
- Dokter hanya melihat laporan operasional non-finansial (jumlah pasien ditangani, appointment selesai) — tidak melihat angka pendapatan/harga.
- Semua laporan dihitung dari data transaksi real (agregasi Prisma `groupBy`/`aggregate`), dapat difilter rentang tanggal, dan hasilnya dapat diekspor.

### 6.13 Manajemen User (Staff)
- Hanya OWNER yang dapat CRUD akun staff: buat user baru (role OWNER/ADMIN_KLINIK/DOKTER), set PIN awal (wajib ganti saat login pertama), nonaktifkan/aktifkan akun, buka kunci akun yang terkunci, reset PIN.
- Tidak dapat menghapus akun yang memiliki jejak transaksi (soft-deactivate saja, bukan hard delete) untuk menjaga integritas audit trail.
- Setiap aksi manajemen user tercatat di `AuditLog`.

### 6.14 Settings
- Hanya OWNER: identitas klinik (nama, alamat, logo, kontak), format penomoran otomatis per modul (invoice/rekam medis/customer/pet/POS/booking/struk), jam operasional, hari kerja, durasi default appointment, pengaturan sesi (timeout, auto-logout), format tanggal/angka/mata uang, tema tampilan.
- Perubahan Settings langsung berlaku ke seluruh sistem (nomor dokumen baru, dsb) tanpa perlu restart aplikasi — menggunakan cache pendek dengan invalidation eksplisit saat Settings diubah (`lib/settings-cache.ts`).

### 6.15 Notifikasi
- In-app notification untuk staff (appointment baru, stok kritis, pembayaran diterima) dan customer (appointment dikonfirmasi, hasil rekam medis siap, tagihan baru, pengingat vaksin).
- Ditampilkan lewat lonceng notifikasi (`notification-bell.tsx`) dengan polling berkala; ditandai sudah dibaca per user.
- (Opsional final-scope, bukan wajib MVP): push notification browser via web push subscription (`app/api/notifications/subscribe/route.ts` sudah ada endpoint-nya) — jika diaktifkan, harus benar-benar terhubung ke service worker yang berfungsi, bukan endpoint kosong.

### 6.16 Customer Portal
- Dashboard ringkas: jumlah pet, appointment mendatang, tagihan belum lunas, notifikasi terbaru.
- Modul: profil (ubah data diri + ganti PIN), daftar pet + monitoring kesehatan, appointment (lihat & buat booking baru), pet hotel (lihat & buat booking baru + log harian real-time), invoice (riwayat + cetak).
- Semua query di portal WAJIB difilter `customerId`/`userId` milik sesi yang login — tidak ada kondisi di mana customer A bisa mengakses data customer B melalui manipulasi ID di URL/request (IDOR-safe, divalidasi di server action, bukan hanya UI).

---

## 7. Alur Lintas Modul (Cross-Module Workflow) — Contoh Skenario Wajib Berfungsi End-to-End

1. **Kunjungan klinik lengkap**: Customer booking appointment via portal → Admin konfirmasi → Dokter proses appointment (`IN_PROGRESS`) → Dokter buat medical record + resep obat → Admin buat Invoice dari medical record (tindakan + obat otomatis masuk sebagai item) → Customer bayar (tunai/non-tunai, boleh cicil) → Invoice `PAID` → Customer lihat riwayat lengkap di portal.
2. **Penitipan hewan lengkap**: Customer/Admin booking kamar pet hotel → Check-in aktual → Staff catat log harian (makan/obat/catatan) selama masa inap, customer bisa pantau real-time → Check-out aktual → Invoice otomatis terhitung dari malam aktual × harga kamar → Pembayaran → Selesai.
3. **Transaksi retail**: Kasir buka POS → pilih/buat customer walk-in → scan/pilih produk → checkout → stok berkurang otomatis via StockMovement → invoice PRODUK dibuat → struk dicetak.
4. **Restock & audit harga**: Admin input restock (StockMovement type IN) → stok bertambah → Owner override harga jual produk tertentu dengan alasan → PriceChangeLog tercatat → harga baru langsung berlaku di POS.

Seluruh skenario di atas harus dapat dijalankan tanpa error dari akun bersih (fresh seed) hingga selesai, dan diverifikasi lewat test E2E (Playwright) yang benar-benar dijalankan (bukan skip).

---

## 8. Non-Functional Requirements (Wajib, Bukan Opsional)

### 8.1 Keamanan
- Defense in depth 3 lapis: middleware (route-level) → server action (business-logic level) → database constraint (schema level).
- Tidak ada harga/nominal finansial yang dipercaya dari input client; semua dihitung ulang di server dari sumber data asli.
- Seluruh output yang dirender sebagai HTML mentah (struk/invoice cetak) WAJIB di-escape terhadap XSS.
- Rate limiting brute-force login harus efektif walau berjalan di lingkungan serverless multi-instance (bukan hanya in-memory single-instance).
- CSP tanpa `unsafe-inline`/`unsafe-eval` pada `script-src` di build final (nonce-based jika diperlukan Next.js inline script).
- Semua aksi sensitif (login/logout, perubahan role, perubahan harga, pembatalan invoice, penguncian akun) tercatat di AuditLog dengan aktor, waktu, dan detail — tidak boleh silently fail.
- Password/PIN tidak pernah disimpan/di-log dalam bentuk plaintext di mana pun (termasuk build log deployment).
- IDOR-proof: setiap query yang mengambil data milik entitas tertentu (invoice, pet, medical record) memvalidasi kepemilikan terhadap sesi yang login.

### 8.2 Performa
- Setiap query yang memfilter berdasarkan foreign key (customerId, petId, userId, dsb) memiliki index database yang sesuai.
- Tidak ada N+1 query pada halaman listing (gunakan `include`/`select` Prisma yang tepat, bukan loop query per-item).
- Server actions untuk listing mendukung pagination pada dataset yang berpotensi besar (invoice, audit log, produk, customer).
- Waktu render halaman utama (dashboard, listing) di bawah 2 detik pada koneksi standar dengan data realistis (ribuan baris).

### 8.3 Reliabilitas & Konsistensi Data
- Semua operasi yang menyentuh lebih dari satu entitas terkait (invoice+payment, booking+stok, appointment+conflict-check) dibungkus transaksi atomik Prisma (`$transaction`).
- Operasi dengan kemungkinan race condition (nomor dokumen unik, pembayaran, booking dokter) memiliki retry logic yang aman terhadap collision/constraint violation.
- Tidak ada mutasi data yang silently gagal — setiap error dikembalikan ke UI dengan pesan jelas, dan dicatat di server log.

### 8.4 Observability
- Structured logging (JSON) di production untuk request masuk (method, path, status, durasi, role) dan error tak tertangani.
- Endpoint health check (`/api/health`) dan readiness check (`/api/ready`) benar-benar memverifikasi koneksi database, bukan hanya return statis 200.

### 8.5 Maintainability
- Tidak ada duplikasi logic yang sama ditulis ulang di banyak file (utility bersama untuk: format currency/date, generate HTML struk/invoice, validasi form, kalkulasi harga).
- Tipe TypeScript strict di seluruh boundary server action ↔ client component — tidak ada `any` di jalur data kritikal (finansial, auth, permission).
- Konvensi penamaan dan struktur folder konsisten (`app/(staff)/...`, `app/(customer)/...`, `actions/*.ts`, `lib/*.ts`, `components/*`) dipertahankan di seluruh modul baru.

---

## 9. Deployment Target — Zero-Configuration Vercel + Neon

Target akhir deployment:
1. Developer melakukan `Deploy` di Vercel dari repo Git.
2. Di Vercel Marketplace, developer klik **Add Integration → Neon** dan menghubungkan project — ini otomatis meng-inject environment variable koneksi database ke project Vercel (`DATABASE_URL` pooled + variant direct connection).
3. Environment variable manual yang **wajib** diisi manusia dibatasi seminimal mungkin: **hanya `AUTH_SECRET`** (secret untuk NextAuth JWT). Semua yang lain (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`) harus resolvable otomatis:
   - `DATABASE_URL`/`DIRECT_URL`: dipetakan otomatis dari variable yang di-inject integrasi Neon (mendukung nama variable apa pun yang dipakai integrasi resmi Neon×Vercel saat ini — perlu mapping/fallback otomatis di layer startup, bukan mengharuskan user mengganti nama variable secara manual).
   - `NEXTAUTH_URL`: diturunkan otomatis dari `VERCEL_URL`/`VERCEL_PROJECT_PRODUCTION_URL` yang disediakan Vercel secara native, bukan harus diisi manual.
4. Saat build pertama: Prisma Client di-generate → migrasi (`prisma migrate deploy`) dijalankan otomatis terhadap Neon → jika database kosong, seed akun awal (Owner/Admin/Dokter/Customer contoh) dibuat otomatis dengan PIN yang **wajib diganti saat login pertama** (bukan PIN statis yang tercetak di log produksi).
5. Deploy kedua dan seterusnya (setelah ada data nyata): proses migrasi berjalan idempotent, tidak pernah menjalankan ulang seed yang menimpa data (kecuali secara eksplisit di-nonaktifkan).
6. Tidak ada dependency ke layanan pihak ketiga lain yang butuh setup manual tambahan (tanpa Redis eksternal wajib, tanpa object storage eksternal wajib untuk fitur inti — jika upload foto pet/produk dibutuhkan, gunakan solusi yang juga zero-config seperti Vercel Blob dengan integrasi serupa, bukan kredensial S3 manual).
7. Preview deployment (branch/PR) harus tetap bisa build sukses walau database belum terhubung (skip migrasi dengan warning, bukan crash total), agar workflow CI/CD tim tidak terganggu.

---

## 10. Kriteria Penerimaan Final (Acceptance Criteria)

Sistem dinyatakan **Production Ready & Enterprise Ready** ketika seluruh berikut ini benar:
- [ ] 16 modul di Bagian 6 berfungsi end-to-end sesuai spesifikasi, diverifikasi manual dan via automated test.
- [ ] 4 skenario lintas-modul di Bagian 7 berjalan mulus dari akun fresh-seed.
- [ ] Seluruh item Bagian 8 (security, performa, reliabilitas, observability, maintainability) terpenuhi dan dapat dibuktikan (bukan klaim).
- [ ] Deploy fresh ke Vercel + Neon berhasil dengan hanya 1 environment variable manual (`AUTH_SECRET`), sesuai Bagian 9.
- [ ] `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` semuanya hijau di CI.
- [ ] Tidak ada `TODO`, `FIXME`, mock data, hardcoded credential, atau `console.log` debug yang tersisa di kode produksi.
- [ ] Audit permission matrix (Bagian 4) diverifikasi ulang tiap role tidak bisa mengakses/mengubah data di luar haknya (uji manual + test RBAC otomatis).

---
