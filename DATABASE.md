# Database Setup & Management

## Database Overview

HaLand PetCare menggunakan PostgreSQL yang dihosting di **Neon** dengan koneksi pooling untuk optimal performance di production.

### Konfigurasi Saat Ini
- **Platform**: Neon (Serverless PostgreSQL)
- **Database**: neondb
- **Region**: US-East-1 (AWS)
- **Project ID**: red-sea-17116776
- **Connection**: Pooled + Direct (untuk migrations)

## Connection URLs

### Development (Pooled - untuk app)
```
postgresql://neondb_owner:npg_07jMtbfqOBWG@ep-snowy-water-atpo1va5-pooler.c-9.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
```

### Migrations (Direct - untuk schema changes)
```
postgresql://neondb_owner:npg_07jMtbfqOBWG@ep-snowy-water-atpo1va5.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## Prisma ORM

### Setup Prisma
```bash
# Sudah terinstall, tapi bisa update dengan:
npm install @prisma/client@latest prisma@latest
```

### File Konfigurasi
- **Schema**: `prisma/schema.prisma`
- **Migrations**: `prisma/migrations/`
- **Config**: `prisma.config.ts`

## Database Schema

### Core Models

#### 1. User (Authentication & Authorization)
```prisma
model User {
  id               String   @id @default(cuid())
  username         String   @unique
  pinHash          String
  name             String
  phone            String?
  role             UserRole  // OWNER, ADMIN_KLINIK, DOKTER, CUSTOMER
  isActive         Boolean   @default(true)
  isLocked         Boolean   @default(false)
  mustChangePin    Boolean   @default(true)
  failedPinAttempts Int      @default(0)
  lockedUntil      DateTime?
  createdById      String?
  createdAt        DateTime  @default(now())
}
```

#### 2. Customer & Pets
```prisma
model Customer {
  id         String   @id @default(cuid())
  userId     String?  @unique
  name       String
  phone      String?
  address    String?
  notes      String?
  // Relations to pets, appointments, invoices
}

model Pet {
  id         String   @id @default(cuid())
  customerId String
  name       String
  species    String
  breed      String?
  birthDate  DateTime?
  gender     String?
  photo      String?
  // Relations to appointments, medical records, vaccines, etc
}
```

#### 3. Appointments & Medical Records
```prisma
model Appointment {
  id                  String  @id @default(cuid())
  petId               String
  customerId          String
  doctorId            String?
  date                DateTime
  status              AppointmentStatus  // WAITING, IN_PROGRESS, DONE, CANCELLED
  requestedByCustomer Boolean @default(false)
}

model MedicalRecord {
  id            String  @id @default(cuid())
  appointmentId String  @unique
  petId         String
  doctorId      String
  diagnosis     String?
  treatment     String?
  prescription  String?
  labResult     String?
  photos        String?
  date          DateTime @default(now())
}
```

#### 4. Pet Hotel
```prisma
model PetHotelBooking {
  id                  String  @id @default(cuid())
  petId               String
  roomId              String?
  checkInDate         DateTime
  checkOutDate        DateTime
  status              PetHotelBookingStatus  // BOOKED, CHECKED_IN, CHECKED_OUT
}

model PetHotelRoom {
  id     String  @id @default(cuid())
  name   String
  status PetHotelRoomStatus  // AVAILABLE, OCCUPIED
}

model PetHotelLog {
  id          String  @id @default(cuid())
  bookingId   String
  type        PetHotelLogType  // FEEDING, MEDICINE, NOTE
  description String
  photo       String?
  date        DateTime @default(now())
}
```

#### 5. Inventory & Products
```prisma
model Product {
  id         String  @id @default(cuid())
  name       String
  sku        String?
  barcode    String?
  categoryId String?
  supplierId String?
  buyPrice   Float   @default(0)
  sellPrice  Float   @default(0)
  stock      Int     @default(0)
  minStock   Int     @default(0)
}

model StockMovement {
  id        String  @id @default(cuid())
  productId String
  type      StockMovementType  // IN, OUT, ADJUSTMENT, OPNAME
  quantity  Int
  note      String?
  date      DateTime @default(now())
}
```

#### 6. Billing & Invoices
```prisma
model Invoice {
  id            String  @id @default(cuid())
  customerId    String
  invoiceNumber String  @unique
  status        InvoiceStatus  // UNPAID, PAID, CANCELLED
  totalAmount   Float   @default(0)
  date          DateTime @default(now())
}

model InvoiceItem {
  id          String  @id @default(cuid())
  invoiceId   String
  type        InvoiceItemType  // KONSULTASI, TINDAKAN, OBAT, PET_HOTEL, PRODUK
  description String
  qty         Int     @default(1)
  price       Float   @default(0)
  subtotal    Float   @default(0)
}

model Payment {
  id        String  @id @default(cuid())
  invoiceId String
  method    PaymentMethod  // CASH, NON_CASH
  amount    Float
  date      DateTime @default(now())
}
```

#### 7. Settings & Audit
```prisma
model Settings {
  id               String  @id @default(cuid())
  clinicName       String?
  logo             String?
  address          String?
  phone            String?
  operationalHours String?
  invoiceFormat    String?
  currency         String?
}

model AuditLog {
  id          String  @id @default(cuid())
  userId      String
  action      String
  entity      String
  entityId    String?
  description String?
  date        DateTime @default(now())
}
```

## Prisma Commands

### Generate Prisma Client
```bash
npm run prisma:generate
# atau
npx prisma generate
```

### Database Operations

#### Push Schema (Development)
```bash
npx prisma db push
```
Digunakan saat development untuk sync schema dengan database tanpa membuat migration file.

#### Create Migration
```bash
npx prisma migrate dev --name init
# atau dengan custom name:
npx prisma migrate dev --name add_new_feature
```
Membuat migration file dan jalankan.

#### Deploy Migration (Production)
```bash
npx prisma migrate deploy
```
Jalankan semua pending migrations di production.

#### Reset Database (Development Only!)
```bash
npx prisma migrate reset
```
⚠️ Menghapus semua data dan jalankan ulang migrations.

### Data Management

#### Seed Database
```bash
npm run prisma:seed
```
Populate database dengan data awal (users, products, settings).

#### Prisma Studio (Visual Inspector)
```bash
npx prisma studio
```
Buka browser di http://localhost:5555 untuk visual database explorer dan editor.

## Backup & Recovery

### Manual Backup (Neon)
1. Buka https://console.neon.tech
2. Pilih project "red-sea-17116776"
3. Navigate ke "Backups"
4. Click "Create Backup"

### Automatic Backups
Neon secara otomatis membuat backups setiap hari. Lihat retention policy di Neon console.

### Restore dari Backup
```bash
# Via Neon console atau contact Neon support
# Semua backup bisa diakses dari Neon dashboard
```

## Monitoring & Maintenance

### Check Database Status
```bash
# Via Prisma Studio
npx prisma studio

# Query database directly
psql postgresql://user:pass@host/db
```

### Query Optimization
```bash
# View query logs di Neon console
# Identify slow queries
# Add indexes if needed
```

### Database Size & Performance
```bash
# Check current connections
SELECT count(*) FROM pg_stat_activity;

# Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables 
WHERE schemaname != 'pg_catalog'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Common Issues & Solutions

### Connection Pool Exhausted
**Problem**: `Error: Client was closed by the server (reason: SUPERUSER connection limit exceeded)`

**Solution:**
- Reduce connection pool size dalam DATABASE_URL
- Gunakan PgBouncer untuk connection pooling (Neon sudah sediakan)
- Pastikan tidak ada zombie connections

### Slow Queries
**Solution:**
1. Analyze query dengan EXPLAIN
2. Add proper indexes
3. Optimize N+1 queries di code
4. Monitor via Neon dashboard

### Migration Conflicts
**Solution:**
```bash
# Reset local state
rm -rf node_modules/.prisma

# Regenerate
npm run prisma:generate

# Retry migration
npx prisma db push
```

### Cannot Connect to Database
**Checklist:**
- [ ] DATABASE_URL correct di .env.local/.env.production
- [ ] Network/IP whitelist di Neon console
- [ ] Neon project is active (not paused)
- [ ] Credentials correct (user/password)
- [ ] Database exists

## Security Best Practices

1. **Credentials**
   - Jangan commit `.env` files dengan credentials
   - Use Vercel environment variables untuk production
   - Rotate credentials secara berkala

2. **Access Control**
   - Prisma query filtering per user
   - Use row-level security jika perlu
   - Validate permissions di application layer

3. **Data Protection**
   - SSL/TLS connection (sslmode=require)
   - Encrypt sensitive data di application
   - Regular backups

4. **Auditing**
   - Log semua mutations ke AuditLog table
   - Monitor access patterns
   - Check Neon activity logs

## Related Documentation

- Neon Docs: https://neon.tech/docs
- Prisma Docs: https://www.prisma.io/docs
- PostgreSQL Docs: https://www.postgresql.org/docs

## Support

Jika ada masalah database:
1. Check Neon console untuk status
2. Review Prisma documentation
3. Check application logs
4. Contact Neon support untuk infrastructure issues
