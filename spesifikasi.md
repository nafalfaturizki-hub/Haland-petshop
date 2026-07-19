# Spesifikasi Teknis — Haland PetCare Management System

## 1. Arsitektur Sistem

### 1.1 Pola Arsitektur
Monolithic full-stack application dengan **Next.js App Router**, menggunakan pola:
```
Client (React Server/Client Components)
        ↓ ↑
Middleware (Edge) — auth gate + RBAC gate + security headers + rate limit
        ↓ ↑
Server Actions ("use server") — business logic layer, single source of truth mutasi data
        ↓ ↑
Prisma ORM (typed query builder)
        ↓ ↑
PostgreSQL (Neon, serverless driver-compatible)
```

Tidak ada REST API terpisah untuk operasi CRUD internal — seluruh mutasi/query data memakai **Next.js Server Actions** yang dipanggil langsung dari Client Component (type-safe end-to-end, tanpa lapisan serialisasi JSON manual). Endpoint HTTP (`app/api/*`) hanya dipakai untuk: NextAuth handler, health/readiness check, dan web-push subscription — bukan untuk CRUD domain.

### 1.2 Request Lifecycle
1. Request masuk → `middleware.ts` (Edge runtime):
   - Cek rate limit (khusus `POST /api/auth/callback/credentials`)
   - Ambil JWT via `getToken()`
   - Terapkan security headers (CSP, HSTS, X-Frame-Options, dst.)
   - Validasi rute: publik / customer-only / staff-only, lalu cek `canPerform(role, module)` terhadap `ROUTE_TO_MODULE`
   - Log terstruktur (method, path, status, durasi, role)
2. Route Handler / Server Component render → memanggil `auth()` (wrapper `getServerSession`) untuk data sesi
3. Server Component memanggil Server Action langsung (initial data fetch) atau Client Component memanggil Server Action via form/event handler (mutasi & refetch)
4. Server Action → validasi ulang role dari `session.user.role` (bukan dari parameter) → validasi input via Zod → query/mutasi Prisma (dibungkus `$transaction` bila multi-entity) → `createAuditLog()` bila aksi sensitif → return typed result `{ success: boolean; data?/error? }`

### 1.3 Runtime & Deployment Target
- **Hosting**: Vercel (Next.js native adapter, serverless functions untuk Server Actions/Route Handlers, Edge runtime untuk middleware)
- **Database**: Neon Postgres (serverless, autoscaling, connection pooling via PgBouncer built-in)
- **Statelessness**: Tidak boleh ada in-memory state yang diasumsikan persisten antar-request kecuali sebagai *best-effort optimization* (contoh: rate-limit map di middleware — didokumentasikan eksplisit sebagai lapisan sekunder, lapisan utama proteksi brute-force adalah lockout PIN di database).

---

## 2. Tech Stack (Versi Target)

| Kategori | Package | Versi Target |
|---|---|---|
| Framework | `next` | ^16.x |
| UI Library | `react`, `react-dom` | ^19.x |
| Bahasa | `typescript` | ^5.8, `strict: true` |
| ORM | `prisma`, `@prisma/client` | ^6.x |
| Auth | `next-auth` | ^4.24.x (Credentials Provider) |
| Hashing | `bcryptjs` | ^3.x (cost factor 10) |
| Validasi | `zod` | ^3.24.x |
| Styling | `tailwindcss` | ^4.x + `@tailwindcss/postcss` |
| Icon | `lucide-react` | ^0.468.x |
| Chart | `recharts` | ^3.x |
| Toast/UI feedback | `sonner` | ^2.x |
| Testing unit | Node built-in `node --test` + `tsx` | — |
| Testing E2E | `@playwright/test` | ^1.61.x |
| Package manager | npm | lockfile `package-lock.json` wajib di-commit |

---

## 3. Struktur Direktori Lengkap

```
app/
  layout.tsx                          # Root layout (font, providers global)
  page.tsx                            # Root redirect (→ /login atau /dashboard/portal)
  error.tsx / not-found.tsx           # Error boundary global
  api/
    auth/[...nextauth]/route.ts       # NextAuth handler
    health/route.ts                   # Liveness probe
    ready/route.ts                    # Readiness probe (cek koneksi DB)
    notifications/subscribe/route.ts  # Web push subscription endpoint
  (auth)/
    login/page.tsx
    change-pin/page.tsx
  (staff)/                            # Route group ber-layout khusus staff (sidebar+navbar)
    layout.tsx                        # Guard: role harus staff, render Sidebar/Navbar
    dashboard/page.tsx
    customers/page.tsx
    customers/[id]/page.tsx
    pets/page.tsx
    pets/[id]/page.tsx
    appointments/page.tsx
    medical-records/page.tsx
    procedures/page.tsx
    pet-hotel/page.tsx
    petshop/layout.tsx
    petshop/products/page.tsx
    petshop/inventory/page.tsx
    pos/layout.tsx
    pos/page.tsx
    pos/riwayat/page.tsx
    billing/layout.tsx
    billing/page.tsx
    reports/page.tsx
    users/layout.tsx
    users/page.tsx
    settings/layout.tsx
    settings/page.tsx
    profile/page.tsx
  (customer)/                         # Route group ber-layout khusus customer (portal nav)
    layout.tsx
    loading.tsx
    portal/
      page.tsx
      profile/page.tsx
      pets/page.tsx
      pets-monitoring/[petId]/page.tsx
      appointments/page.tsx
      pet-hotel/page.tsx
      invoices/page.tsx

actions/                              # Server Actions — satu file per domain
  customer.ts, pet.ts, appointment.ts, medical-record.ts, procedure.ts,
  pet-hotel.ts, product.ts, inventory.ts, pos.ts, invoice.ts,
  report.ts, user.ts, settings.ts, notification.ts, profile.ts, search.ts

components/
  shared/                             # DataTable, FormDialog, ConfirmDialog, EmptyState,
                                       # LoadingState, ErrorBoundary, ProtectedRoute, form/*
  layout/                             # Sidebar, Navbar, NotificationBell, PortalNav
  POS/                                # ProductCatalog, CartSummary, CheckoutPanel/Summary
  medical-records/                    # MedicalRecordForm, MedicalRecordDetail
  users/                              # user-form-dialog

hooks/
  use-pos-state.ts, use-permissions.ts, use-medical-form.ts,
  use-online-status.ts, use-notifications.ts, use-polling.ts, use-refetch-on-focus.ts

lib/
  auth.ts                             # NextAuth config, verifyPinWithLockout, authOptions
  auth-env.ts                         # Sanitasi AUTH_URL/NEXTAUTH_URL, resolve AUTH_SECRET
  db.ts                               # Prisma client singleton, createAuditLog, getOrCreateGuestCustomer
  env-validation.ts                   # validateEnvironment() — fail-fast startup check
  permissions.ts / permission-matrix.ts  # ModuleName, Role, canPerform()
  numbering.ts                        # generateInvoiceNumber/MedicalRecordNumber/BookingNumber
  pos.ts / pos-validation.ts          # Kalkulasi & validasi transaksi POS
  inventory-helpers.ts                # Helper mutasi stok
  medical-record-utils.ts             # Helper status workflow rekam medis
  notification-broadcaster.ts / notifications-helper.ts
  receipt-utils.ts                    # Generator HTML struk/invoice (harus disatukan & di-escape)
  sanitize.ts                         # sanitizeText, stripHtml, sanitizeObject
  settings-cache.ts                   # Cache Settings + invalidation
  user-management.ts                  # Helper CRUD user
  constants.ts                        # RATE_LIMIT, dsb.
  utils.ts                            # formatCurrency, formatDate, cn(), dst.
  validations/                        # Skema Zod per domain

prisma/
  schema.prisma
  seed.ts
  migrations/*/migration.sql

middleware.ts                         # Edge middleware: auth gate, RBAC gate, security headers, rate limit
scripts/
  prepare-prisma-env.mjs              # Mapping env var Neon → DATABASE_URL/DIRECT_URL sebelum build
  post-deploy.mjs                     # prisma migrate deploy (+ seed opsional) pasca-build
  run-migrations.mjs, test-db.js, setup.sh

tests/                                # Unit test (node --test)
prisma.config.ts                      # Konfigurasi Prisma CLI (schema path)
vercel.json                           # buildCommand override
```

---

## 4. Model Data Lengkap (Skema Prisma — Field Level)

### 4.1 Enum
```prisma
enum UserRole              { OWNER ADMIN_KLINIK DOKTER CUSTOMER }
enum AppointmentStatus     { WAITING IN_PROGRESS DONE CANCELLED }
enum PetHotelBookingStatus { BOOKED CHECKED_IN CHECKED_OUT CANCELLED }
enum PetHotelRoomStatus    { AVAILABLE RESERVED OCCUPIED MAINTENANCE INACTIVE }
enum PetHotelLogType       { FEEDING MEDICINE NOTE }
enum StockMovementType     { IN OUT ADJUSTMENT RETURN DAMAGED EXPIRED CORRECTION OPNAME }
enum ProductStatus         { ACTIVE ARCHIVED }
enum InvoiceStatus         { UNPAID PARTIAL_PAYMENT PAID CANCELLED }
enum InvoiceItemType       { KONSULTASI TINDAKAN OBAT PET_HOTEL PRODUK }
enum PaymentMethod         { CASH NON_CASH }
enum MedicalRecordStatus   { OPEN IN_PROGRESS COMPLETED CLOSED }
```

### 4.2 Entitas Inti (ringkas per model — field wajib, tipe, relasi)

**User** — `id (cuid)`, `username (unique)`, `pinHash`, `name`, `phone?`, `role (UserRole)`, `isActive`, `isLocked`, `lockedUntil?`, `failedPinAttempts`, `mustChangePin`, timestamps. Relasi: `Customer? (1-1 via userId)`, `AuditLog[]`, `Notification[]`, `PriceChangeLog[]`.

**Customer** — `id`, `name`, `phone?`, `address?`, `email?`, `isGuest (default false)`, `userId? (unique)`. Relasi: `Pet[]`, `Appointment[]`, `MedicalRecord[]`, `Invoice[]`, `PetHotelBooking[]` (transitive via Pet).

**Pet** — `id`, `customerId`, `name`, `species`, `breed?`, `gender?`, `birthDate?`, `photoUrl?`. Index: `@@index([customerId])`. Relasi: `PetWeightLog[]`, `PetVaccineRecord[]`, `PetDiseaseRecord[]`, `PetAllergy[]` (semua `onDelete: Cascade`), `Appointment[]`, `MedicalRecord[]`, `PetHotelBookingPet[]`.

**PetWeightLog / PetVaccineRecord / PetDiseaseRecord / PetAllergy** — child table per `petId`, masing-masing menyimpan tanggal & detail spesifik (berat/kg, jenis vaksin+tanggal berikutnya, nama penyakit+tanggal, alergen+tingkat keparahan).

**Appointment** — `id`, `petId`, `customerId`, `doctorId? (User)`, `date (DateTime)`, `status (AppointmentStatus, default WAITING)`, `notes?`, `reason?`. Index: `@@index([customerId, date])`, `@@index([petId, date])`, `@@index([doctorId, date])`.

**MedicalRecord** — `id`, `recordNumber (unique)`, `appointmentId?`, `customerId`, `petId`, `doctorId`, `status (MedicalRecordStatus, default OPEN)`, `complaint?`, `diagnosis?`, `treatment?`, `prescription?`, `weight?`, `notes?`, `date`. Index: `@@index([customerId, date])`, `@@index([petId, date])`.

**Procedure** — `id`, `code? (unique)`, `name`, `description?`, `price (default 0)`.

**PetHotelRoom** — `id`, `name`, `roomNumber?`, `roomType (default STANDARD)`, `pricePerNight (default 100000)`, `capacity`, `status (PetHotelRoomStatus)`, `cleaningStatus`, `maintenanceStatus`. Index: `@@index([status])`.

**PetHotelBooking** — `id`, `bookingNumber? (unique)`, `petId?`, `roomId?`, `checkInDate`, `checkOutDate`, `actualCheckInAt?`, `actualCheckOutAt?`, `status (PetHotelBookingStatus)`, `requestedByCustomer`, `notes?`. Index: `@@index([status, checkInDate, checkOutDate])`, `@@index([roomId, checkInDate, checkOutDate])`. Relasi many-to-many ke Pet via **PetHotelBookingPet** (`@@unique([bookingId, petId])`, `@@index([petId])`).

**PetHotelLog** — `id`, `bookingId`, `type (PetHotelLogType)`, `description`, `photo?`, `date`.

**Product** — `id`, `name`, `sku?`, `barcode?`, `brand?`, `description?`, `categoryId?`, `supplierId?`, `unit?`, `buyPrice`, `sellPrice`, `costPrice`, `ownerPriceOverride?`, `ownerPriceOverrideReason?`, `ownerPriceUpdatedAt?`, `stock`, `minStock`, `maxStock?`, `status (ProductStatus)`, `imageUrl?`, `isArchived`. Index: `categoryId`, `supplierId`, `isArchived`, `name`.

**PriceChangeLog** — `id`, `productId`, `changedById?`, `previousPrice`, `newPrice`, `reason?`, `createdAt`. Index: `@@index([productId, createdAt])`.

**StockMovement** — `id`, `productId`, `type (StockMovementType)`, `quantity`, `note?`, `date`. `onDelete: Cascade` dari Product.

**ProductCategory / Supplier** — master data sederhana (`id`, `name`, `+ contact?` untuk supplier).

**Invoice** — `id`, `customerId`, `appointmentId?`, `medicalRecordId?`, `petId?`, `doctorId?`, `createdById?`, `invoiceNumber (unique)`, `walkInName?`, `status (InvoiceStatus, default UNPAID)`, `subtotal`, `discountAmount`, `taxRate`, `taxAmount`, `totalAmount`, `notes?`, `date`. Index: `[customerId, status]`, `[date]`, `[petId]`, `[invoiceNumber]`.

**InvoiceItem** — `id`, `invoiceId (cascade)`, `productId?`, `procedureId?`, `petHotelBookingId?`, `type (InvoiceItemType)`, `description`, `qty`, `price`, `subtotal`.

**Payment** — `id`, `invoiceId (cascade)`, `method (PaymentMethod)`, `amount`, `date`. Index: `@@index([invoiceId])`.

**Notification** — `id`, `userId (cascade)`, `title`, `message`, `isRead`, `type?`, `date`. *(Target final: tambahkan `@@index([userId, isRead])` — lihat Bagian 10 Gap Teknis.)*

**AuditLog** — `id`, `userId`, `action`, `entity`, `entityId?`, `description?`, `date`. Index: `[userId, date]`.

**Settings** — single-row (id `"default"`), berisi seluruh konfigurasi identitas klinik dan format penomoran (lihat daftar field di `schema.prisma` — `clinicName`, `invoicePrefix`, `medicalRecordPrefix`, `customerPrefix`, `petPrefix`, `posPrefix`, `bookingPrefix`, `receiptPrefix`, `autoNumbering`, `taxRate`-setara, `sessionTimeout`, `autoLogout`, dst.)

---

## 5. Autentikasi & Otorisasi — Detail Teknis

### 5.1 Alur Login
1. Form login kirim `{ username, pin }` ke NextAuth Credentials Provider.
2. `loginSchema` (Zod): `username` non-empty trimmed, `pin` harus regex `^\d{6}$`.
3. Lookup user: `prisma.user.findFirst({ where: { username: { equals, mode: 'insensitive' } } })` — case-insensitive by design.
4. Cek `user.isActive` — jika false, tolak + audit log `'Login ditolak karena akun nonaktif'`.
5. Panggil `verifyPinWithLockout(userId, pin, user.pinHash, 'LOGIN')`:
   - Ambil `isLocked`, `lockedUntil`, `failedPinAttempts` terbaru dari DB (bukan dari cache/token — mencegah TOCTOU).
   - Jika terkunci dan `lockedUntil > now` → tolak.
   - Jika terkunci tapi `lockedUntil <= now` → auto-unlock, reset counter.
   - `bcrypt.compare(pin, pinHash)`.
   - Salah → increment `failedPinAttempts`; jika mencapai **5** → set `isLocked=true`, `lockedUntil = now + 15 menit`.
   - Benar → reset `failedPinAttempts=0`, `isLocked=false`, `lockedUntil=null`.
   - Setiap outcome → `createAuditLog`.
6. Sukses → return `{ id, name, username, role, mustChangePin }` sebagai `user` object NextAuth.

### 5.2 Sesi (JWT Strategy)
- `session.strategy = 'jwt'`, `maxAge = 7 hari` (untuk `session` dan `jwt` config).
- `jwt()` callback: pada login, isi `token.sub/id/role/username/mustChangePin` dari `user`. Pada **setiap request berikutnya**, re-fetch `getFreshUser(userId)` dari DB — jika user sudah tidak `isActive` atau `isLocked`, set `token.revoked = true` (efeknya: session callback tidak lagi mengisi `session.user`, sehingga request berikutnya dianggap tidak terautentikasi meski JWT masih valid secara kriptografis). Ini adalah mekanisme **revokasi sesi real-time** tanpa perlu server-side session store.
- `session()` callback: proyeksikan field dari token ke `session.user` (kecuali `revoked`).

### 5.3 Middleware RBAC
- `getClientIp()`: ambil IP pertama dari header `x-forwarded-for` (klien asli, bukan proxy), fallback `x-real-ip`, fallback `'unknown'`.
- Rate limit login: in-memory `Map<ip, {count, firstAttempt}>`, window & max attempt dari `lib/constants.ts` (`RATE_LIMIT.WINDOW_MS`, `RATE_LIMIT.MAX_ATTEMPTS`), response `429` dengan header `Retry-After` saat melampaui.
- Route classification: `publicRoutes` (`/login`, `/api/auth`, `/_next`, `/favicon.ico`) → lewat; `/change-pin` → butuh login saja; `CUSTOMER_PREFIXES = ['/portal']` → butuh role `CUSTOMER`; `STAFF_PREFIXES` (13 modul) → butuh role staff **dan** `canPerform(role, module)` true, jika tidak → redirect `/dashboard?unauthorized=1&route=<path>`.
- `ROUTE_TO_MODULE` memetakan prefix path ke `ModuleName` untuk dicocokkan ke `permission-matrix.ts`.
- Security headers diterapkan ke **semua** response (bukan hanya halaman terautentikasi): CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`.

### 5.4 Resolusi Secret (`auth-env.ts`)
- Prioritas: `AUTH_SECRET` → `NEXTAUTH_SECRET` → (non-production only) hash stabil dari `DATABASE_URL` → hash stabil dari `VERCEL_GIT_COMMIT_SHA` → literal `'next-auth-dev-secret'`.
- **Di production, tanpa `AUTH_SECRET`/`NEXTAUTH_SECRET` eksplisit → throw fatal saat startup** (fail-fast, bukan fallback diam-diam yang membuat semua sesi rentan forgery).
- Placeholder URL detection: jika `AUTH_URL`/`NEXTAUTH_URL` mengandung pola placeholder (`placeholder`, `your-`, `yourdomain`, dst.) atau `http://localhost:3000`, variable tersebut **dihapus dari `process.env`** sebelum NextAuth membacanya, sehingga NextAuth fallback otomatis ke `VERCEL_URL`.

---

## 6. Logika Bisnis Kritikal (Algoritma)

### 6.1 Penomoran Dokumen Otomatis (`lib/numbering.ts`)
```
generatePrefixedNumber(prefixKey, fallback, entity):
  prefix = Settings[prefixKey] atau fallback
  today  = YYYYMMDD
  for retryAttempt in 0..2:
    for attempt in 0..9:
      candidate = "{prefix}-{today}-{random 4 digit}"
      if candidate belum ada di DB → return candidate
    sleep(2^retryAttempt * 100ms)   # 100ms, 200ms
  throw Error jika 3 retry × 10 attempt semua collision
```

Dipakai untuk `invoiceNumber`, `recordNumber`, `bookingNumber`. Insert final tetap divalidasi constraint `@unique` di DB sebagai jaring pengaman terakhir (defense in depth), dengan retry di level Server Action jika terjadi `P2002`.

### 6.2 Kalkulasi Harga Invoice (Server-Side Only)
- **PET_HOTEL item**: `nights = ceil((checkOutDate - checkInDate) / 86400000)`, `price = room.pricePerNight`, `subtotal = price * nights`. Booking di-fetch dengan `include: { room: true }` — **harga dari client diabaikan sepenuhnya**.
- **PRODUK item**: harga diambil dari `product.ownerPriceOverride ?? product.sellPrice` saat baris ditambahkan ke invoice/POS.
- **KONSULTASI/OBAT (harga manual)**: hanya dapat ditambahkan oleh role `OWNER`/`ADMIN_KLINIK` (validasi role eksplisit di Server Action, bukan asumsi dari UI).
- **TINDAKAN**: harga diambil dari `Procedure.price` master data.
- Total invoice: `subtotal = Σ item.subtotal`, `discountAmount` (input manual staff berwenang), `taxAmount = subtotal * taxRate`, `totalAmount = subtotal - discountAmount + taxAmount`.

### 6.3 Pembayaran Invoice (Anti Race-Condition)
```
recordInvoicePayment(invoiceId, amount, method):
  $transaction:
    paid = SUM(Payment.amount WHERE invoiceId)   # dibaca DI DALAM transaksi
    outstanding = invoice.totalAmount - paid
    if amount > outstanding: throw (overpayment ditolak)
    create Payment
    newStatus = paid+amount >= total ? PAID : PARTIAL_PAYMENT
    update Invoice.status
```
Pembacaan agregat dan penulisan pembayaran **wajib** berada dalam transaksi atomik yang sama agar dua request pembayaran simultan tidak bisa lolos validasi outstanding secara bersamaan.

### 6.4 Booking Dokter (Anti Double-Booking)
```
createAppointment(...):
  $transaction:
    conflict = findFirst(Appointment WHERE doctorId=X AND date=Y AND status != CANCELLED)
    if conflict: throw (slot sudah terisi)
    create Appointment
```

Cek konflik dan insert **dalam transaksi yang sama** agar dua booking untuk dokter+slot yang identik yang datang bersamaan tidak keduanya lolos.

### 6.5 Mutasi Stok
Setiap perubahan `Product.stock` harus disertai insert `StockMovement` yang berkorespondensi (tipe IN untuk restock, OUT untuk penjualan, ADJUSTMENT/CORRECTION/OPNAME untuk koreksi manual, RETURN untuk retur, DAMAGED/EXPIRED untuk write-off) — dalam satu transaksi. Checkout POS: pengurangan stok dan pembuatan `InvoiceItem` berada dalam transaksi yang sama; jika stok tidak cukup, seluruh transaksi rollback.

### 6.6 Lockout PIN
Lihat 5.1 — ambang **5 percobaan gagal**, durasi kunci **15 menit**, logika dibagi (shared function `verifyPinWithLockout`) antara alur Login dan alur Ganti PIN (`actions/profile.ts`) agar tidak ada duplikasi/inkonsistensi aturan.

---

## 7. Konvensi Server Action

Setiap file di `actions/*.ts` mengikuti kontrak seragam:
```ts
'use server';

export async function actionName(input: InputType): Promise<
  { success: true; data: T } | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  if (!canPerform(session.user.role, 'module-name')) return { success: false, error: 'Forbidden' };

  const parsed = zodSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.message };

  try {
    const result = await prisma.$transaction(async (tx) => { /* ... */ });
    await createAuditLog(session.user.id, 'ACTION', 'Entity', result.id, 'deskripsi');
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: 'Pesan error yang aman ditampilkan ke user' };
  }
}
```

Aturan wajib:
- **Tidak pernah** mempercayai `role`/`userId`/harga dari parameter input — selalu dari `session`.
- Semua input tervalidasi Zod sebelum menyentuh Prisma.
- Multi-entity mutation wajib `$transaction`.
- Error internal (stack trace, pesan Prisma mentah) **tidak** dikembalikan ke client — hanya pesan aman yang sudah di-map.

---

## 8. Middleware & Security Headers (Ringkasan Konfigurasi Final)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' [tanpa unsafe-inline/unsafe-eval pada build final — gunakan nonce Next.js];
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data:;
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

---

## 9. Pipeline Deployment (Vercel + Neon)

```
1. git push → Vercel trigger build
2. installCommand: npm install
3. buildCommand:  node scripts/prepare-prisma-env.mjs --build   (mapping env Neon → DATABASE_URL/DIRECT_URL)
                → next build (termasuk prisma generate via postinstall/prebuild hook)
                → node scripts/post-deploy.mjs
                     - skip jika SKIP_MIGRATIONS=true
                     - skip (warn) jika DATABASE_URL kosong (preview tanpa DB)
                     - jalankan: prisma migrate deploy --skip-generate
                     - jika SEED_ON_DEPLOY=true → prisma db seed (idempotent via upsert)
4. Runtime: serverless functions (Server Actions/Route Handlers) + Edge middleware
```

Environment variable target minimal:
| Var | Sumber |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Auto-inject dari integrasi Neon × Vercel Marketplace |
| `AUTH_SECRET` | Manual, satu-satunya yang wajib diisi manusia |
| `NEXTAUTH_URL` | Auto-derive dari `VERCEL_URL` (via sanitasi di `auth-env.ts`) |
| `SEED_ON_DEPLOY`, `SKIP_MIGRATIONS` | Opsional, default aman |

---

## 10. Testing Strategy

| Level | Tool | Cakupan Target |
|---|---|---|
| Unit | `node --test` + `tsx` | Logika murni: kalkulasi harga, lockout, numbering, permission matrix (`tests/*.test.ts`) |
| Integration logic | `*.test.mjs` | Skenario hardening tanpa DB nyata (mock) |
| E2E | Playwright | Alur penuh per role (login → aksi modul → logout), termasuk uji negatif RBAC (role X tidak bisa akses modul Y) |

Target cakupan minimal per rilis: seluruh algoritma di Bagian 6, seluruh transisi status (Appointment, MedicalRecord, Invoice, PetHotelBooking), dan seluruh baris matriks permission di Bagian 4 PRD.

---

## 11. Gap Teknis yang Wajib Ditutup Menuju Target Final

(Ringkas dari audit sebelumnya, direferensikan sebagai pekerjaan yang harus selesai agar spesifikasi ini terpenuhi 100%)

- Escape HTML pada seluruh generator struk/invoice (`document.write`) — satukan ke `lib/receipt-utils.ts`, pakai `sanitizeText`.
- Tambah `@@index([userId, isRead])` pada `Notification`, index `petId` eksplisit pada `PetWeightLog/PetVaccineRecord/PetDiseaseRecord/PetAllergy`.
- CSP `script-src` hilangkan `unsafe-inline`/`unsafe-eval` di build production.
- Rate limiter login harus efektif lintas-instance serverless (bukan hanya in-memory Map).
- Verifikasi mapping otomatis nama env var integrasi Neon terbaru di `scripts/prepare-prisma-env.mjs`.
