# Panduan Deployment HaLand PetCare

## Daftar Periksa Setup Lengkap

### 1. Persiapan Database (Neon PostgreSQL)

Database sudah terhubung ke Neon. Informasi:
- **Database**: neondb
- **Host**: ep-snowy-water-atpo1va5-pooler.c-9.us-east-1.aws.neon.tech
- **Project ID**: red-sea-17116776

#### Verifikasi Koneksi Database
```bash
# Test koneksi database
npm run prisma:generate

# Lihat struktur database
npx prisma db push --skip-generate
```

#### Initialize Database Schema
```bash
# Generate Prisma Client
npm run prisma:generate

# Push schema ke database (untuk development)
npx prisma db push

# Untuk production: jalankan migrasi
npx prisma migrate deploy
```

### 2. Konfigurasi NextAuth

NextAuth sudah dikonfigurasi dengan provider Credentials (PIN-based login).

#### Environment Variables yang Diperlukan:
- `NEXTAUTH_SECRET`: Secret key untuk JWT (sudah ada di .env.local)
- `NEXTAUTH_URL`: URL aplikasi (berubah per environment)

#### Testing NextAuth Locally
```bash
# Pastikan DATABASE_URL dan NEXTAUTH_SECRET sudah ada di .env.local
npm run dev

# Login di http://localhost:3000/login dengan:
# Username: (dari database)
# PIN: (dari database)
```

### 3. Deployment ke Vercel

#### Step 1: Persiapan Repository
```bash
# Pastikan sudah di branch main
git status
git log --oneline | head -5

# Push perubahan ke GitHub
git add .
git commit -m "Setup deployment configuration"
git push origin main
```

#### Step 2: Connect ke Vercel
1. Buka https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Pilih repository "vetocatprotocol-web/halandpet"
4. Skip "Create a Team" jika belum perlu
5. Click "Import"

#### Step 3: Set Environment Variables di Vercel
Setelah import, di halaman "Environment Variables":

1. **DATABASE_URL** (Production Pooled Connection)
   ```
   postgresql://neondb_owner:npg_07jMtbfqOBWG@ep-snowy-water-atpo1va5-pooler.c-9.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
   ```

2. **DIRECT_URL** (Non-pooled for migrations)
   ```
   postgresql://neondb_owner:npg_07jMtbfqOBWG@ep-snowy-water-atpo1va5.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

3. **NEXTAUTH_SECRET** (Generate if needed)
   ```bash
   openssl rand -base64 32
   ```
   Atau gunakan yang sudah ada: `zFslHcZmRQNjgbN/LvR/5WMFnnj7qh/z+btXu0ZZzSs=`

4. **NEXTAUTH_URL** (Production Domain)
   ```
   https://halandpet-inky.vercel.app
   ```
   Sesuaikan dengan domain Vercel Anda

#### Step 4: Configure Production Database
1. Pastikan database sudah ada schema yang lengkap
2. Jalankan migrations di Vercel:
   ```bash
   # Via Vercel CLI
   vercel env pull .env.production.local
   npm run prisma:migrate
   ```

#### Step 5: Deploy
```bash
# Automatic deployment via GitHub
git push origin main

# Atau manual deployment
vercel --prod
```

### 4. Verifikasi Deployment

Setelah deployment selesai:

1. **Check Build Logs**
   - Buka https://vercel.com/dashboard
   - Pilih project "halandpet"
   - Lihat deployment logs untuk errors

2. **Test Aplikasi**
   - Buka https://halandpet-inky.vercel.app (atau domain Anda)
   - Login page harus muncul
   - Database connection harus OK

3. **Check Database**
   ```bash
   # Verifikasi data di Neon
   vercel env pull .env.production.local
   npx prisma studio
   ```

### 5. Post-Deployment Checklist

- [ ] Aplikasi loading tanpa error
- [ ] Login page accessible
- [ ] Authentication bekerja
- [ ] Database queries berjalan
- [ ] Environment variables sudah set
- [ ] HTTPS enabled
- [ ] Analytics tracking (optional)

## Troubleshooting

### Database Connection Error
```
Error: P1000: Can't reach database server at `ep-snowy-water-atpo1va5-pooler.c-9.us-east-1.aws.neon.tech`
```
**Solusi:**
- Verifikasi DATABASE_URL di Vercel env vars
- Check Neon console untuk status database
- Pastikan IP Vercel tidak diblokir

### NextAuth Error
```
Error: NEXTAUTH_SECRET is not set
```
**Solusi:**
- Set NEXTAUTH_SECRET di Vercel environment variables
- Gunakan minimal 32 character random string

### Prisma Generate Error
**Solusi:**
- Jalankan `npm install` terlebih dahulu
- Delete `.next` folder dan `node_modules`
- Run `npm run prisma:generate` ulang

## Development

### Local Development Setup
```bash
# 1. Clone dan install dependencies
git clone https://github.com/vetocatprotocol-web/halandpet.git
cd halandpet
npm install

# 2. Setup environment variables
cp .env.example .env.local
# Edit .env.local dengan credentials database

# 3. Generate Prisma Client
npm run prisma:generate

# 4. Jalankan database migrations
npx prisma db push

# 5. Start development server
npm run dev

# 6. Buka http://localhost:3000
```

### Useful Commands

```bash
# Generate/update Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database (if needed)
npm run prisma:seed

# Prisma Studio (visual database explorer)
npx prisma studio

# Build untuk production
npm run build

# Start production server
npm run start

# Lint code
npm lint
```

## Tech Stack

- **Framework**: Next.js 16
- **Database**: PostgreSQL (Neon)
- **Auth**: NextAuth.js v4 with Credentials Provider
- **ORM**: Prisma
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Charts**: Recharts
- **Validation**: Zod
- **Password Hashing**: bcryptjs
- **Notifications**: Sonner

## Support & Issues

Jika ada masalah deployment:
1. Check Vercel deployment logs
2. Verify environment variables
3. Check database connection
4. Review middleware configuration
5. Check browser console for client-side errors

## Security Notes

- NEXTAUTH_SECRET harus unik dan random
- Jangan commit `.env.local` atau `.env.production.local`
- DATABASE_URL dan DIRECT_URL harus tersimpan secure di Vercel
- Gunakan HTTPS di production
- Implement CORS jika API diakses dari domain berbeda

## Next Steps

1. ✅ Database connected (Neon)
2. ✅ Auth configured (NextAuth.js)
3. ✅ Environment setup (local & production)
4. 👉 Deploy to Vercel
5. Test authentication flow
6. Setup monitoring/logging
7. Configure backups
