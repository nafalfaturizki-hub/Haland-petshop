# 🚀 Quick Start Guide

Panduan cepat untuk setup dan menjalankan HaLand PetCare.

## Prasyarat

- Node.js 18+ 
- npm atau pnpm
- Git
- Database Neon sudah terhubung ✅

## 5 Menit Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Test Database Connection
```bash
npm run test:db
```

Pastikan output:
```
✅ Database connection successful
✅ Found X tables
✨ All tests passed!
```

### 3. Seed Database (Optional)
```bash
npm run prisma:seed
```

Output:
```
✨ Seeding completed successfully!
📝 Default User Credentials:
   Owner  - Username: owner   | PIN: 1234
   Admin  - Username: admin   | PIN: 1234
   Doctor - Username: dr_budi | PIN: 1234
```

### 4. Start Development Server
```bash
npm run dev
```

Output:
```
  ▲ Next.js 16.2.10
  - Local:        http://localhost:3000
```

### 5. Login
- Buka http://localhost:3000
- Username: `owner` (atau `admin` atau `dr_budi`)
- PIN: `1234`

✅ **Done!** Aplikasi sekarang berjalan.

---

## Useful Commands

```bash
# Development
npm run dev                 # Start dev server
npm run build              # Build for production
npm run start              # Start production server
npm run lint               # Run linter

# Database
npm run db:push            # Push schema to database
npm run db:reset           # Reset database (⚠️ deletes all data)
npm run db:studio          # Open Prisma Studio (visual DB explorer)
npm run prisma:seed        # Load sample data
npm run prisma:generate    # Generate Prisma Client
npm run test:db            # Test database connection

# Utility
npm run setup              # Run full setup
```

---

## First Login After Setup

### Credentials
- **Username**: owner (first-time user)
- **PIN**: 1234
- **Role**: OWNER (full access)

### What to Do First
1. ✅ Login dengan credentials di atas
2. 🔐 **Change PIN** - Force first-time users to change PIN
3. 👤 Create more users sebagai needed
4. 📋 Setup clinic information in Settings
5. 🐕 Add customers dan pets
6. 📅 Create appointments

---

## Project Structure

```
halandpet/
├── app/                     # Next.js routes
│   ├── (auth)/login        # Login page
│   ├── (customer)/portal   # Customer portal
│   └── (staff)/dashboard   # Staff dashboard
├── lib/
│   ├── auth.ts            # NextAuth config
│   └── db.ts              # Prisma client
├── prisma/
│   ├── schema.prisma      # DB schema
│   └── seed.ts            # Seed script
└── docs/
    ├── SETUP.md           # Full setup guide
    ├── DATABASE.md        # Database reference
    └── DEPLOYMENT.md      # Deployment guide
```

---

## Troubleshooting

### "Cannot find module '@prisma/client'"
```bash
npm run prisma:generate
npm install
```

### "Database connection error"
```bash
npm run test:db
# Check .env.local DATABASE_URL
# Verify Neon project is active
```

### "NEXTAUTH_SECRET not set"
```bash
# .env.local should have NEXTAUTH_SECRET
# Check file exists and has correct value
cat .env.local | grep NEXTAUTH_SECRET
```

### "Port 3000 already in use"
```bash
npm run dev -- -p 3001
# atau kill existing process
```

---

## Next Steps

- 📚 Read [SETUP.md](./SETUP.md) for complete setup guide
- 🗄️ Read [DATABASE.md](./DATABASE.md) for database reference
- 🚀 Read [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment guide

---

## Features Overview

### 👥 User Management
- Role-based access (Owner, Admin, Doctor, Customer)
- PIN-based authentication
- User account lockout after failed attempts

### 🐕 Pet Management
- Customer & pet profiles
- Pet health records
- Vaccine tracking
- Disease/allergy records

### 📅 Appointments
- Appointment scheduling
- Doctor assignment
- Medical records
- Queue management

### 🏨 Pet Hotel
- Room management
- Check-in/check-out
- Activity logging
- Care notes

### 💊 Inventory
- Product management
- Stock tracking
- Stock movements
- Low stock alerts

### 💰 Billing
- Invoice generation
- Payment tracking
- Customer invoices
- Financial reports

### 📊 Reporting
- Dashboard analytics
- Revenue reports
- Patient statistics
- Inventory reports

---

## Tech Stack

- **Frontend**: React 19 + Next.js 16
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Auth**: NextAuth.js v4
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui + Recharts

---

## Support

For detailed information:
- **Setup**: See [SETUP.md](./SETUP.md)
- **Database**: See [DATABASE.md](./DATABASE.md)
- **Deployment**: See [DEPLOYMENT.md](./DEPLOYMENT.md)

---

**Status**: ✅ Ready to use
**Last Updated**: July 3, 2026
