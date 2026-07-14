# Baseline Report

## Summary

The current repository has substantial feature coverage for a veterinary and petshop workflow, but it is not yet production-ready. The strongest evidence is that the production build currently fails during Prisma initialization and the schema validation path is blocked by missing environment configuration.

## Production Readiness Score

- Overall readiness: 55/100
- Architecture: 62/100
- Source maturity: 57/100
- Database readiness: 54/100
- Permission readiness: 48/100

## Verified Baseline Status

| Area | Status | Evidence |
| --- | --- | --- |
| Build status | Failing | The latest build run failed with Prisma error P1001 while trying to reach 127.0.0.1:5432. |
| TypeScript status | Failing | TypeScript reported two import-extension errors in [tests/permissions.test.ts](../tests/permissions.test.ts) and [tests/pos.test.ts](../tests/pos.test.ts). |
| ESLint status | Failing | ESLint could not start because no eslint.config file was present for the current ESLint 9 setup. |
| Prisma status | Failing | Prisma validation failed because DIRECT_URL was not available during schema validation. |
| Database connectivity | Failing | Prisma reported that the database server at 127.0.0.1:5432 was unreachable. |
| Authentication | Partial | NextAuth authentication and PIN lockout are implemented in [lib/auth.ts](../lib/auth.ts), but the runtime is still not production-validated because the build path is blocked by database and env issues. |
| Authorization | Partial | Role checks are implemented in [middleware.ts](../middleware.ts) and [lib/permissions.ts](../lib/permissions.ts), but the supported runtime role set is narrower than the requested ERP target model. |
| POS | Partial | POS UI and server actions exist in [app/(staff)/pos/page.tsx](../app/(staff)/pos/page.tsx) and [actions/pos.ts](../actions/pos.ts), but the transaction flow still depends on multi-step action orchestration and would benefit from a transactional service layer. |
| Inventory | Partial | Product and stock flows exist in [actions/product.ts](../actions/product.ts), [actions/inventory.ts](../actions/inventory.ts), and [lib/inventory-helpers.ts](../lib/inventory-helpers.ts), but inventory and invoice updates are not yet fully centralized behind a single transactional boundary. |
| Appointment | Partial | Appointment creation and lookup actions exist in [actions/appointment.ts](../actions/appointment.ts), and the UI is present in [app/(staff)/appointments/page.tsx](../app/(staff)/appointments/page.tsx). |
| Medical Record | Partial | Medical record actions and UI exist in [actions/medical-record.ts](../actions/medical-record.ts) and [app/(staff)/medical-records/page.tsx](../app/(staff)/medical-records/page.tsx), but the broader permission model is still narrower than the target ERP matrix. |
| Pet Hotel | Partial | Booking and room workflows exist in [actions/pet-hotel.ts](../actions/pet-hotel.ts), but room and booking state transitions would benefit from stronger state-policy handling. |
| Billing | Partial | Billing and invoice pages and actions exist in [app/(staff)/billing/page.tsx](../app/(staff)/billing/page.tsx) and [actions/invoice.ts](../actions/invoice.ts), but financial workflow consistency should be hardened. |
| Owner Dashboard | Partial | Dashboard summaries are implemented in [app/(staff)/dashboard/page.tsx](../app/(staff)/dashboard/page.tsx) and [actions/report.ts](../actions/report.ts), but the reporting surface is still fairly lightweight. |
| Customer Monitoring | Missing / Partial | Customer management exists in [app/(staff)/customers/page.tsx](../app/(staff)/customers/page.tsx), but there is no distinct monitoring dashboard or dedicated monitoring workflow in the current route tree. |

## Known Broken Buttons / Routes / Features

- Known broken route behavior: the application cannot be fully exercised in a production-like environment because build and Prisma startup are currently blocked by database and env issues.
- Known missing feature surface: grooming is not present as a first-class module in the current route and action inventory.
- Known placeholder or scaffold-like areas: the current documentation and planning set exists, but the application itself still lacks a more formalized service layer for several high-value workflows.

## Known Hardcoded Values and Technical Debt

- Role checks are still expressed directly in multiple files, including [middleware.ts](../middleware.ts), [lib/permissions.ts](../lib/permissions.ts), [actions/pos.ts](../actions/pos.ts), and [actions/invoice.ts](../actions/invoice.ts).
- Several workflows rely on direct action-level orchestration instead of a domain service boundary.
- The current UI includes page-level state and business logic in large components, such as [app/(staff)/pos/page.tsx](../app/(staff)/pos/page.tsx) and [app/(staff)/billing/page.tsx](../app/(staff)/billing/page.tsx).
- The current Prisma schema is broad and functional, but transaction safety and indexing strategy still need hardening, as documented in [docs/DATABASE_AUDIT.md](DATABASE_AUDIT.md).

## Architectural Risks

- Authorization risk: the current role model is narrower than the requested ERP role set.
- Runtime risk: the application cannot complete build/startup validation without a reachable database and complete env configuration.
- Workflow risk: POS, billing, inventory, appointments, and pet hotel flows are implemented but still need stronger transactional consistency.
