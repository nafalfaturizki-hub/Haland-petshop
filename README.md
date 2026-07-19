# 🐾 Haland PetCare — Sistem Manajemen Klinik Hewan, Pet Shop & Pet Hotel

Aplikasi manajemen terintegrasi untuk klinik hewan, pet shop, dan pet hotel — mencakup rekam medis, appointment, point-of-sale, inventori, billing, hingga portal mandiri untuk pelanggan. Dibangun full-stack dengan Next.js App Router dan PostgreSQL (Neon), dirancang untuk **zero-configuration deployment di Vercel**.

## ✨ Fitur Utama

- **Manajemen Customer & Pet** — data pemilik hewan, riwayat berat badan, vaksin, penyakit, dan alergi per hewan
- **Appointment** — booking janji temu dengan validasi anti-double-booking dokter
- **Rekam Medis** — workflow status `OPEN → IN_PROGRESS → COMPLETED → CLOSED` oleh dokter
- **Pet Hotel** — manajemen kamar, booking, check-in/out, log harian (makan/obat/catatan)
- **Petshop & Inventori** — katalog produk, kategori, supplier, mutasi stok dengan jejak audit penuh
- **POS (Kasir)** — transaksi walk-in/customer, cetak struk, riwayat transaksi
- **Billing/Invoice** — tagihan gabungan multi-layanan, pembayaran cicilan, anti-manipulasi harga (kalkulasi server-side)
- **Laporan** — finansial & operasional real-time
- **Manajemen User & RBAC** — 4 role: `OWNER`, `ADMIN_KLINIK`, `DOKTER`, `CUSTOMER`
- **Portal Pelanggan** — akses mandiri untuk melihat riwayat hewan, appointment, tagihan, dan booking pet hotel
- **Notifikasi in-app**, audit log, dan keamanan berlapis (rate limiting, PIN lockout, CSP)

## 🧱 Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js (App Router) + React 19 |
| Bahasa | TypeScript |
| Database | PostgreSQL (Neon) |
| ORM | Prisma |
| Auth | NextAuth (Credentials — username + PIN 6 digit) |
| Styling | Tailwind CSS |
| Validasi | Zod |
| Testing | Node test runner + Playwright (E2E) |
| Deployment | Vercel |

## 👥 Role & Hak Akses

| Modul | OWNER | ADMIN_KLINIK | DOKTER | CUSTOMER |
|---|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | – |
| Customers | ✅ | ✅ | 👁️ | – |
| Pets | ✅ | ✅ | ✅ | 👁️ milik sendiri |
| Appointments | ✅ | ✅ | ✅ | ✅ milik sendiri |
| Medical Records | ✅ | 👁️ | ✅ | 👁️ milik sendiri |
| Procedures | ✅ | ✅ | 👁️ | – |
| Pet Hotel | ✅ | ✅ | 👁️ | ✅ milik sendiri |
| Petshop/Inventori | ✅ | ✅ | – | – |
| POS | ✅ | ✅ | – | – |
| Billing | ✅ | ✅ | – | 👁️ milik sendiri |
| Reports | ✅ | ✅ | 👁️ operasional | – |
| Users | ✅ | – | – | – |
| Settings | ✅ | – | – | – |

## 🚀 Deploy ke Vercel (Zero-Configuration)

Cara deploy production tercepat, tanpa setup manual server/database:

1. **Import repo ini ke Vercel** ([vercel.com/new](https://vercel.com/new)).
2. Di dashboard project Vercel, buka tab **Storage/Marketplace → Add Integration → Neon**, lalu hubungkan atau buat database Neon baru. Ini otomatis meng-inject environment variable koneksi database (`DATABASE_URL`, `DIRECT_URL`) ke project Anda.
3. Tambahkan satu environment variable manual:
   ```
   AUTH_SECRET=<hasil dari: openssl rand -base64 32>
   ```
4. Klik **Deploy**. Saat build, sistem otomatis:
   - Generate Prisma Client
   - Menjalankan migrasi database (`prisma migrate deploy`)
   - Membuat akun awal (seed) jika database masih kosong
5. Setelah deploy selesai, login menggunakan kredensial awal dari log deployment (Anda akan **diwajibkan mengganti PIN** saat login pertama kali).

> Opsional: set `SEED_ON_DEPLOY=true` untuk memaksa seeding ulang pada deploy berikutnya, atau `SKIP_MIGRATIONS=true` untuk melewati migrasi otomatis (misalnya di preview deployment tanpa database).

## 💻 Menjalankan Secara Lokal

### Prasyarat
- Node.js 20+
- Database PostgreSQL (bisa Neon, atau lokal via Docker)

### Langkah

```bash
# 1. Clone & install dependencies
git clone <repo-url>
cd Haland-petshop-main
npm install

# 2. Siapkan environment variables
cp .env.example .env
# lalu isi DATABASE_URL, DIRECT_URL, dan AUTH_SECRET pada file .env

# 3. Jalankan migrasi & seed database
npm run prisma:generate
npm run db:deploy      # menjalankan migrasi
npm run prisma:seed    # membuat akun awal (owner/admin/dokter/customer)

# 4. Jalankan development server
npm run dev
```

Aplikasi berjalan di `http://localhost:3000`.

Alternatif: gunakan `docker-compose.yml` yang tersedia untuk menjalankan PostgreSQL lokal, atau jalankan `bash scripts/setup.sh` untuk setup otomatis end-to-end.

## 🔑 Environment Variables

| Variable | Wajib | Keterangan |
|---|:---:|---|
| `DATABASE_URL` | ✅ | Connection string Postgres (pooled) — otomatis dari integrasi Neon di Vercel |
| `DIRECT_URL` | ✅ | Connection string langsung (untuk migrasi) — otomatis dari integrasi Neon di Vercel |
| `AUTH_SECRET` | ✅ | Secret untuk enkripsi sesi NextAuth, generate via `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Opsional | URL production; otomatis terdeteksi di Vercel, isi manual hanya untuk kebutuhan lokal/custom domain |
| `SEED_ON_DEPLOY` | Opsional | `true`/`false` — jalankan seed saat deploy (default: aman untuk database kosong) |
| `SKIP_MIGRATIONS` | Opsional | `true`/`false` — lewati migrasi otomatis saat build |

Lihat `.env.example` untuk template lengkap.

## 📜 Script yang Tersedia

```bash
npm run dev              # Development server
npm run build             # Build production
npm run start             # Jalankan hasil build
npm run lint               # ESLint
npm run typecheck        # Pengecekan TypeScript
npm run prisma:generate # Generate Prisma Client
npm run prisma:migrate  # Migrasi (development)
npm run db:deploy          # Migrasi (production)
npm run db:studio          # Buka Prisma Studio (GUI database)
npm run prisma:seed      # Seed data awal
npm run test                # Unit test
npm run test:e2e          # E2E test (Playwright)
```

## 📁 Struktur Proyek

```
app/
  (auth)/          # Halaman login & ganti PIN
  (staff)/         # Modul staff: dashboard, customers, pets, appointments, dst.
  (customer)/      # Portal pelanggan
  api/                # Route handler (auth, health check, notifications)
actions/           # Server actions (business logic per modul)
components/     # Komponen UI (shared, POS, layout, medical-records, dst.)
hooks/               # Custom React hooks
lib/                    # Utilitas inti: auth, db, permission, validasi, dsb.
prisma/              # Schema database & migrasi
tests/                # Unit test
scripts/            # Script setup & deployment
```

## 🔒 Keamanan

- Autentikasi berbasis PIN 6 digit dengan hashing bcrypt & lockout otomatis setelah 5 kali percobaan gagal
- Role-based access control divalidasi di tiga lapis: middleware, server action, dan constraint database
- Seluruh perhitungan harga (invoice, pet hotel, POS) dilakukan di server, tidak pernah dipercaya dari input klien
- Audit log untuk seluruh aksi sensitif (login, perubahan harga, perubahan data user)
- Security headers (CSP, HSTS, X-Frame-Options, dsb.) diterapkan melalui middleware

## 🩺 Health Check

- `GET /api/health` — status aplikasi
- `GET /api/ready` — status kesiapan (termasuk konektivitas database)

## 📄 Lisensi

Proprietary — seluruh hak cipta dimiliki oleh pemilik bisnis Haland PetCare.
