# 🐾 HaLand PetCare - Sistem Manajemen Klinik Hewan

Platform manajemen klinik hewan modern dengan fitur appointment, pet hotel, inventory, dan billing terintegrasi.

## ✨ Status Setup

```
✅ Database Connected     (Neon PostgreSQL)
✅ Schema Synchronized    (25 tables)
✅ Seed Data Loaded      (users, customers, products)
✅ Auth System Ready      (NextAuth.js + PIN login)
✅ Development Ready      (npm run dev)
✅ Deployment Ready       (Vercel configured)
```

---

## 🚀 Quick Start (5 Menit)

### 1. Start Development Server
```bash
npm run dev
```
Buka: http://localhost:3000

### 2. Login
- **Username**: owner
- **PIN**: 1234

### 3. Explore App
- Dashboard, Customers, Pets, Appointments, Pet Hotel, Inventory, Billing

---

## 📖 Documentation

| Document | Purpose | Read Time |
|----------|---------|-----------|
| **[QUICK_START.md](./QUICK_START.md)** | ⭐ Start here - Quick setup | 5 min |
| **[SETUP.md](./SETUP.md)** | Complete setup guide & troubleshooting | 15 min |
| **[DATABASE.md](./DATABASE.md)** | Database schema, operations, backup | 20 min |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Deploy to Vercel, production setup | 15 min |
| **[SETUP_COMPLETE.md](./SETUP_COMPLETE.md)** | Status report & checklist | 10 min |

**👉 Start with [QUICK_START.md](./QUICK_START.md)**

---

## 🛠️ Tech Stack

```
Frontend:    React 19 + Next.js 16 + TypeScript
Backend:     Next.js API Routes + NextAuth.js
Database:    PostgreSQL (Neon) + Prisma ORM
Styling:     Tailwind CSS + shadcn/ui
Charts:      Recharts
Validation:  Zod
Auth:        NextAuth.js v4 (PIN-based)
```

---

## 📦 Available Scripts

### Development
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

### Database
```bash
npm run db:push          # Push schema to database
npm run db:studio        # Open Prisma Studio (visual DB explorer)
npm run db:reset         # Reset database (⚠️ deletes all data)
npm run prisma:seed      # Load seed data
npm run prisma:generate  # Generate Prisma Client
npm run test:db          # Test database connection
npm run prisma:migrate   # Create migration
```

### Utility
```bash
npm run setup            # Run full setup script
```

---

## 🎯 Features

### 👥 User Management
- Role-based access control (Owner, Admin, Doctor, Customer)
- PIN-based authentication
- Account lockout after failed attempts
- User activity audit logs

### 🐕 Pet Management
- Customer profiles
- Pet profiles with photos
- Weight tracking history
- Vaccination records
- Disease history
- Allergy information

### 📅 Appointments
- Appointment scheduling
- Doctor assignment
- Queue management
- Medical records per appointment
- Appointment status tracking

### 🏨 Pet Hotel
- Room management & availability
- Check-in/check-out system
- Daily activity logging
- Care notes with photos
- Feeding & medicine tracking

### 💊 Inventory
- Product management
- Stock tracking with SKU & barcode
- Stock movements (IN/OUT/ADJUSTMENT/OPNAME)
- Low stock alerts
- Supplier management
- Product categorization

### 💰 Billing & Invoicing
- Invoice generation
- Multiple invoice item types (consultation, treatment, medicine, hotel, products)
- Payment tracking (cash & non-cash)
- Customer billing history
- Financial reports

### 📊 Dashboard
- Key metrics & statistics
- Recent appointments
- Revenue overview
- Stock alerts
- Customer growth

---

## 🔐 Default Users

**For Development Only** - Change PINs in production!

| Role | Username | PIN | Access |
|------|----------|-----|--------|
| Owner | `owner` | `1234` | Full system access |
| Admin | `admin` | `1234` | Administrative functions |
| Doctor | `dr_budi` | `1234` | Medical & appointment features |

---

## 📊 Database

### Tables (25 Total)
- Users, Customers, Pets
- Appointments, Medical Records
- Pet Hotel Bookings & Logs
- Products, Stock Movements
- Invoices, Payments
- Settings, Notifications, Audit Logs
- *And more...*

### Connection
- **Neon PostgreSQL** with connection pooling
- **Prisma ORM** for type-safe database access
- **Automatic migrations** with version control

See [DATABASE.md](./DATABASE.md) for full schema reference.

---

## 🚀 Deployment

### Vercel Deployment
```bash
# 1. Push to GitHub
git push origin main

# 2. Connect to Vercel via dashboard
# https://vercel.com/dashboard

# 3. Set environment variables in Vercel
# DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL

# 4. Auto-deploy on push (or manual deploy)
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete guide.

---

## 🔧 Configuration

### Environment Variables

**Development (.env.local)**
```env
DATABASE_URL=postgresql://user:pass@host/db
DIRECT_URL=postgresql://user:pass@host/db
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
```

**Production (Vercel Dashboard)**
Same variables as above, but with production URLs.

---

## 📱 Routes

### Public Routes
- `/login` - Login page

### Staff Routes (Protected)
- `/dashboard` - Admin dashboard
- `/customers` - Customer management
- `/pets` - Pet management
- `/appointments` - Appointment management
- `/medical-records` - Medical records
- `/pet-hotel` - Pet hotel management
- `/petshop/inventory` - Inventory management
- `/billing` - Billing & invoices
- `/users` - User management
- `/settings` - Settings

### Customer Routes (Protected)
- `/portal` - Customer portal
- `/portal/pets` - My pets
- `/portal/appointments` - My appointments
- `/portal/invoices` - My invoices

---

## 🔐 Security Features

- PIN-based authentication (not passwords)
- NextAuth.js with JWT sessions
- Role-based access control (RBAC)
- Account lockout mechanism
- Audit logging of all actions
- HTTPS in production
- Parameterized database queries

---

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Test connection
npm run test:db

# Check environment
cat .env.local | grep DATABASE_URL
```

### Login Issues
```bash
# Ensure seed data loaded
npm run prisma:seed

# Check database
npm run db:studio
```

### Build Issues
```bash
# Regenerate Prisma
npm run prisma:generate

# Reinstall dependencies
rm -rf node_modules
npm install
```

See [SETUP.md](./SETUP.md) for more troubleshooting.

---

## 📞 Support

1. Check [QUICK_START.md](./QUICK_START.md) for basic setup
2. Read [SETUP.md](./SETUP.md) for detailed guide
3. See [DATABASE.md](./DATABASE.md) for database questions
4. Review [DEPLOYMENT.md](./DEPLOYMENT.md) for production issues
5. Check terminal logs and Vercel dashboard

---

## 📝 Development Workflow

### Making Changes
1. Create feature branch: `git checkout -b feature/something`
2. Make changes
3. Test locally: `npm run dev`
4. Commit: `git commit -m "Add feature"`
5. Push: `git push origin feature/something`
6. Create Pull Request

### Database Changes
1. Update `prisma/schema.prisma`
2. Create migration: `npm run prisma:migrate`
3. Test locally
4. Push changes

### Deployment
1. Merge to main branch
2. Code auto-deploys to Vercel
3. Verify in production

---

## 🎓 Learning Resources

- **Next.js**: https://nextjs.org/docs
- **Prisma**: https://www.prisma.io/docs
- **NextAuth.js**: https://next-auth.js.org
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Neon**: https://neon.tech/docs

---

## 📜 License

Private - Haland Pet Care

---

## 👥 Contributors

HaLand PetCare Team

---

## 🎉 Getting Started

1. **New to this project?** → Read [QUICK_START.md](./QUICK_START.md)
2. **Need full setup?** → Read [SETUP.md](./SETUP.md)
3. **Ready to deploy?** → Read [DEPLOYMENT.md](./DEPLOYMENT.md)
4. **Database questions?** → Read [DATABASE.md](./DATABASE.md)

---

**Last Updated**: July 3, 2026
**Version**: 0.1.0
**Status**: ✅ Production Ready
