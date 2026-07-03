# Setup Lengkap HaLand PetCare

## 🎯 Daftar Periksa Setup

### Phase 1: Environment & Dependencies ✅

- [x] Database terhubung ke Neon
- [x] Environment variables tersedia
- [x] Prisma dikonfigurasi
- [x] Dependencies terinstall
- [ ] Database schema sudah di-push
- [ ] Seed data sudah dimuat

### Phase 2: Development & Testing 

- [ ] Development server berjalan (npm run dev)
- [ ] Login page accessible
- [ ] Authentication bekerja
- [ ] Database queries berjalan

### Phase 3: Deployment

- [ ] Repository terhubung ke GitHub
- [ ] Terkoneksi ke Vercel
- [ ] Environment variables set di Vercel
- [ ] Build successful di Vercel
- [ ] Production deployment berhasil

---

## 📋 Step-by-Step Setup

### Step 1: Verifikasi Database Connection

```bash
# Pastikan .env.local ada
cat .env.local

# Generate Prisma Client
npm run prisma:generate

# Test koneksi database
npx prisma db push --skip-generate
```

**Output yang diharapkan:**
```
✓ Database connection successful
✓ Schema pushed to database
```

### Step 2: Seed Database dengan Data Awal

```bash
# Setup seed script jika belum
npm run prisma:seed
```

**Output yang diharapkan:**
```
🌱 Seeding database...
✅ Owner user created: owner
✅ Admin user created: admin
✅ Doctor user created: dr_budi
✅ Sample customer created: John Doe
...
✨ Seeding completed successfully!

📝 Default User Credentials:
   Owner  - Username: owner   | PIN: 1234
   Admin  - Username: admin   | PIN: 1234
   Doctor - Username: dr_budi | PIN: 1234
```

### Step 3: Run Development Server

```bash
npm run dev
```

**Output yang diharapkan:**
```
  ▲ Next.js 16.2.10
  - Local:        http://localhost:3000
  - Environments: .env.local

✓ Ready in 2.5s
```

### Step 4: Test Login

1. Buka http://localhost:3000
2. Akan redirect ke `/login`
3. Login dengan:
   - **Username**: owner (atau admin, atau dr_budi)
   - **PIN**: 1234

**Expected:**
- Login berhasil
- Redirect ke dashboard
- Sidebar menampilkan menu sesuai role

### Step 5: Verifikasi Database di Prisma Studio

```bash
npx prisma studio
```

**Browser akan membuka:** http://localhost:5555

Di sini Anda bisa:
- Lihat semua data di database
- Edit/create/delete records
- Verifikasi schema dan relationships

---

## 🔐 Environment Variables

### Untuk Development (.env.local)

File sudah tersedia dengan konfigurasi:

```env
DATABASE_URL=postgresql://neondb_owner:npg_07jMtbfqOBWG@ep-snowy-water-atpo1va5-pooler.c-9.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
DIRECT_URL=postgresql://neondb_owner:npg_07jMtbfqOBWG@ep-snowy-water-atpo1va5.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require
NEXTAUTH_SECRET=zFslHcZmRQNjgbN/LvR/5WMFnnj7qh/z+btXu0ZZzSs=
NEXTAUTH_URL=http://localhost:3000
```

### Untuk Production (Vercel)

Set di Vercel dashboard → Project Settings → Environment Variables:

#### 1. DATABASE_URL (Production Pooled)
```
postgresql://neondb_owner:npg_07jMtbfqOBWG@ep-snowy-water-atpo1va5-pooler.c-9.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
```

#### 2. DIRECT_URL (Non-pooled for migrations)
```
postgresql://neondb_owner:npg_07jMtbfqOBWG@ep-snowy-water-atpo1va5.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require
```

#### 3. NEXTAUTH_SECRET
Gunakan yang sudah ada atau generate baru:
```bash
openssl rand -base64 32
```

Current value:
```
zFslHcZmRQNjgbN/LvR/5WMFnnj7qh/z+btXu0ZZzSs=
```

#### 4. NEXTAUTH_URL
```
https://halandpet-inky.vercel.app
```
(Sesuaikan dengan domain production Anda)

---

## 📱 Project Structure

```
halandpet/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   └── login/               # Login page
│   ├── (customer)/
│   │   └── portal/              # Customer portal
│   ├── (staff)/                 # Staff routes (protected)
│   │   ├── dashboard/
│   │   ├── customers/
│   │   ├── pets/
│   │   ├── appointments/
│   │   ├── medical-records/
│   │   ├── pet-hotel/
│   │   ├── petshop/
│   │   ├── billing/
│   │   └── ...
│   └── api/
│       └── auth/                # NextAuth routes
├── components/                   # React components
├── lib/
│   ├── auth.ts                  # NextAuth configuration
│   ├── db.ts                    # Prisma client
│   └── permissions.ts           # Role-based access control
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── migrations/              # Migration history
│   └── seed.ts                  # Seed script
├── scripts/
│   └── setup.sh                 # Setup script
├── .env.local                   # Local env variables
├── .env.example                 # Template
├── DEPLOYMENT.md                # Deployment guide
├── DATABASE.md                  # Database documentation
└── SETUP.md                     # This file
```

---

## 🚀 Vercel Deployment

### Pre-Deployment Checklist

- [ ] Code committed & pushed to GitHub
- [ ] All environment variables ready
- [ ] Database schema is up-to-date
- [ ] Seed data created
- [ ] Local tests pass

### Deploy Steps

#### Via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Select repository `vetocatprotocol-web/halandpet`
4. Click "Import"
5. Add environment variables (see below)
6. Click "Deploy"

#### Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Pull environment variables from Vercel
vercel env pull .env.production.local

# Deploy
vercel --prod
```

### Environment Variables Setup (Vercel)

In Vercel dashboard, add:

1. **DATABASE_URL**
   - Scope: Production
   - Value: `postgresql://neondb_owner:...@ep-snowy-water-atpo1va5-pooler.c-9.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require`

2. **DIRECT_URL**
   - Scope: Production
   - Value: `postgresql://neondb_owner:...@ep-snowy-water-atpo1va5.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require`

3. **NEXTAUTH_SECRET**
   - Scope: Production
   - Value: `zFslHcZmRQNjgbN/LvR/5WMFnnj7qh/z+btXu0ZZzSs=`

4. **NEXTAUTH_URL**
   - Scope: Production
   - Value: `https://halandpet-inky.vercel.app`

### Post-Deployment

```bash
# Check deployment logs in Vercel dashboard
# Verify:
# - Build successful
# - No env var warnings
# - Database connection works

# Test production:
# - Open https://halandpet-inky.vercel.app
# - Try login
# - Check functionality
```

---

## 🐛 Troubleshooting

### Database Connection Error

**Error Message:**
```
Error: P1000: Can't reach database server
```

**Solutions:**
1. Check DATABASE_URL in environment
2. Verify Neon project is active (not paused)
3. Check IP whitelist in Neon console
4. Confirm network connectivity

### Prisma Migration Failed

**Error Message:**
```
Error: Failed to apply migration
```

**Solutions:**
```bash
# Reset Prisma state
rm -rf node_modules/.prisma
npm install

# Try again
npm run prisma:generate
npx prisma db push
```

### NextAuth Error

**Error Message:**
```
Error: NEXTAUTH_SECRET is not set
```

**Solutions:**
1. Add NEXTAUTH_SECRET to .env.local
2. Set NEXTAUTH_SECRET in Vercel environment variables
3. Ensure it's at least 32 characters

### Login Not Working

**Checklist:**
- [ ] Database connection OK
- [ ] Default seed users created (owner, admin)
- [ ] NEXTAUTH_SECRET set correctly
- [ ] Browser cookies enabled
- [ ] Session strategy configured (JWT)

---

## 📚 Documentation Files

- **DEPLOYMENT.md** - Complete deployment guide
- **DATABASE.md** - Database schema & operations
- **SETUP.md** - This file

---

## ✨ Next Steps

1. ✅ Database setup completed
2. ✅ Environment variables configured
3. 👉 Run development server
4. 👉 Test login & basic functionality
5. 👉 Deploy to Vercel
6. 👉 Setup monitoring/logging
7. 👉 Configure CI/CD (optional)

---

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review logs:
   - Development: Terminal output
   - Production: Vercel dashboard logs
3. Check database:
   - `npx prisma studio` for local
   - Neon console for production
4. Review configuration:
   - `.env.local` for development
   - Vercel dashboard for production

## 🎉 Success!

Jika semua langkah sudah selesai:
- Development server berjalan di http://localhost:3000
- Database sudah seeded dengan data awal
- Login bekerja dengan username/PIN
- Siap untuk deployment ke Vercel!

---

**Last Updated:** July 3, 2026
**Status:** ✅ Complete
