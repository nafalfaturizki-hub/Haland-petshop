# Architecture Overview

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Next.js 16 (App Router) |
| Backend | Next.js Server Actions + API Routes |
| Database | PostgreSQL (Neon) + Prisma ORM |
| Auth | NextAuth.js v4 (PIN-based, credentials provider) |
| Styling | Tailwind CSS + shadcn/ui |
| Validation | Zod (server + client) |
| Charts | Recharts |
| Notifications | Server-Sent Events (SSE) |

## Project Structure

```
app/                          # Next.js App Router
  (staff)/                    # Staff-facing routes (dashboard, POS, etc.)
  (customer)/portal/          # Customer-facing portal
  api/                        # API routes (health, ready, auth, notifications)
actions/                      # Server actions (business logic layer)
  invoice.ts                  # Invoice creation, payment, status transitions
  pos.ts                      # Point-of-sale checkout flow
  appointment.ts              # Appointment scheduling, conflict detection
  medical-record.ts           # Medical record CRUD with atomic transactions
  pet.ts / customer.ts        # Pet and customer management
  pet-hotel.ts                # Pet hotel booking with room conflict detection
  user.ts / settings.ts       # User management, clinic settings
  product.ts / inventory.ts   # Product catalog, stock movements
  report.ts                   # Financial and operational reports
components/                   # React components (shadcn/ui based)
hooks/                        # Custom React hooks
lib/                          # Shared utilities
  db.ts                       # Prisma client singleton, audit log helper
  auth.ts / auth-env.ts       # Authentication helpers, secret validation
  logger.ts                   # Structured JSON logger
  sanitize.ts                 # Input sanitization (XSS prevention)
  permissions.ts              # Role-based access control (RBAC)
  permission-matrix.ts        # Route-to-module mapping
  numbering.ts                # Invoice number, record number generation
  pos-validation.ts           # POS input validation (discount, stock)
  env-validation.ts           # Startup environment variable validation
prisma/                       # Database schema and migrations
  schema.prisma               # Data model with indexes and constraints
scripts/                      # Build and deployment scripts
  prepare-prisma-env.mjs      # Resolves Prisma env vars, runs prisma generate + build
  post-deploy.mjs             # Runs migrations and seeding after Vercel deploy
e2e/                          # Playwright end-to-end tests
tests/                        # Unit/integration tests (Vitest)
```

## Data Flow

```
User Action → Server Action (actions/*.ts) → Permission Check → Zod Validation
  → Prisma Transaction (atomic, Serializable isolation) → Database
  → Audit Log → Notification (SSE) → Response
```

### Key Patterns

1. **Atomic Transactions**: All operations affecting multiple tables (invoice creation, POS checkout, appointment scheduling) run inside `prisma.$transaction` with `Serializable` isolation level to prevent race conditions.

2. **Retry with Backoff**: Invoice number generation retries with exponential backoff on unique constraint violations (handles concurrent invoice creation).

3. **Optimistic Concurrency**: Stock decrement uses `updateMany` with `stock: { gte: item.qty }` condition to prevent overselling.

4. **RBAC Enforcement**: Every server action checks permissions via `canPerformAction()` or `enforceActionPermission()` before executing.

## Database Design

### Key Relationships
- Customer → Pets (1:N), Appointments (1:N), Invoices (1:N), MedicalRecords (1:N)
- Pet → WeightLogs, VaccineRecords, DiseaseRecords, Allergies (1:N, cascade delete)
- Appointment → MedicalRecord (1:1, cascade delete)
- Invoice → InvoiceItems, Payments (1:N, cascade delete)
- Product → StockMovements (1:N, cascade delete)

### Indexes
Strategic indexes exist on: `petId`, `customerId`, `invoiceNumber`, `Product.name`, `email`, `phone`, appointment status+date combinations, and all foreign keys.

## Security Model

- **Authentication**: PIN-based with bcryptjs (10 rounds), 5-attempt lockout
- **Authorization**: Role-based (OWNER > ADMIN_KLINIK > DOKTER > CUSTOMER)
- **Input Validation**: Zod schemas on every action, HTML sanitization for text fields
- **Output Protection**: CSP headers, HSTS, X-Frame-Options on all responses
- **Audit Trail**: All CRUD operations logged to AuditLog table

## Development Setup

### Prerequisites
- Node.js 20+
- PostgreSQL (local or Neon)
- npm

### Quick Start
```bash
cp .env.example .env.local      # Configure database connection
npm install                      # Install dependencies + generate Prisma client
npm run db:push                  # Push schema to database
npm run prisma:seed              # Load seed data (default login: owner / 123456)
npm run dev                      # Start development server on http://localhost:3000
```

### Database Schema (Entity Relationship)

**Core Entities:**
- `User` — Staff + customer accounts (PIN-based auth, roles: OWNER/ADMIN_KLINIK/DOKTER/CUSTOMER)
- `Customer` — Pet owners (linked to User via userId, guest support via isGuest flag)
- `Pet` — Patient animals (linked to Customer, has weight/vaccine/disease/allergy records)
- `Appointment` — Visit scheduling (linked to Pet + Doctor, status: WAITING/IN_PROGRESS/DONE/CANCELLED)
- `MedicalRecord` — Clinical documentation (1:1 with Appointment, versioned on update)
- `Invoice` — Billing (supports partial payments, multiple item types)
- `Product` — Inventory items (stock tracking, price history via PriceChangeLog)

**Supporting Entities:**
- `PetHotelRoom` / `PetHotelBooking` / `PetHotelLog` — Pet hotel management
- `Procedure` — Service catalog (consultations, treatments)
- `Supplier` / `ProductCategory` — Inventory organization
- `Notification` — In-app + SSE notifications
- `AuditLog` — Immutable audit trail for all CRUD operations
- `Settings` — Clinic configuration (numbering prefixes, operational hours, etc.)
