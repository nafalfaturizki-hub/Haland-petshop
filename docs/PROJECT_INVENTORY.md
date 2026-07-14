# Project Inventory

## Root Structure

- app/ — Next.js route tree and layout components
- actions/ — server actions for business operations
- components/ — shared UI components
- hooks/ — client-side hooks
- lib/ — authentication, permissions, helpers, database, validation, and utilities
- prisma/ — Prisma schema, migrations, and seed data
- tests/ — automated tests and regression checks
- e2e/ — Playwright end-to-end tests
- scripts/ — setup and environment helpers

## Module Inventory

### Application Routes
- app/(auth)/login — login flow
- app/(auth)/change-pin — PIN change flow
- app/(customer)/portal — customer-facing portal
- app/(staff)/dashboard — dashboard
- app/(staff)/customers — customer management
- app/(staff)/pets — pet management
- app/(staff)/appointments — appointment management
- app/(staff)/medical-records — medical records
- app/(staff)/pet-hotel — pet hotel management
- app/(staff)/petshop/products — product catalog
- app/(staff)/pos — point of sale
- app/(staff)/billing — billing and invoice workflow
- app/(staff)/reports — reporting
- app/(staff)/users — user management
- app/(staff)/settings — settings
- app/(staff)/profile — profile area

### Shared Components
- components/layout/navbar.tsx
- components/layout/sidebar.tsx
- components/layout/portal-nav.tsx
- components/layout/notification-bell.tsx
- components/shared/auth-session-provider.tsx
- components/shared/confirm-dialog.tsx
- components/shared/data-table.tsx
- components/shared/form-dialog.tsx
- components/shared/loading-state.tsx
- components/shared/empty-state.tsx
- components/users/user-form-dialog.tsx

### Hooks
- hooks/use-permissions.ts
- hooks/use-polling.ts
- hooks/use-refetch-on-focus.ts

### Services and Utilities
- lib/auth.ts — NextAuth configuration and PIN verification
- lib/db.ts — Prisma client and audit-log helpers
- lib/permissions.ts — role and permission policy helpers
- lib/utils.ts — shared formatting and normalization helpers
- lib/numbering.ts — numbering helpers for invoices and records
- lib/user-management.ts — user creation and management helpers
- lib/validations/ — input validation schemas
- lib/inventory-helpers.ts
- lib/medical-record-utils.ts
- lib/notifications-helper.ts
- lib/pos.ts
- lib/settings-cache.ts
- lib/route-prefill.ts

### Server Actions
- actions/appointment.ts
- actions/auth.ts
- actions/customer.ts
- actions/inventory.ts
- actions/invoice.ts
- actions/medical-record.ts
- actions/notification.ts
- actions/pet-hotel.ts
- actions/pet.ts
- actions/pos.ts
- actions/procedure.ts
- actions/product.ts
- actions/profile.ts
- actions/report.ts
- actions/search.ts
- actions/settings.ts
- actions/user.ts

### Database Models
- User
- Customer
- Pet
- Appointment
- MedicalRecord
- PetHotelBooking
- PetHotelRoom
- PetHotelLog
- Product
- ProductCategory
- Supplier
- StockMovement
- Invoice
- InvoiceItem
- Payment
- Notification
- AuditLog
- Settings

### Configuration and Environment
- package.json
- next.config.ts
- tsconfig.json
- postcss.config.mjs
- tailwind.config.ts
- prisma/schema.prisma
- docker-compose.yml
- vercel.json
- middleware.ts

## Notes

The repository already contains a strong feature surface, but several areas are still only partially formalized as first-class modules. This inventory shows the implementation footprint but also highlights the need for tighter service boundaries and central policy logic.
