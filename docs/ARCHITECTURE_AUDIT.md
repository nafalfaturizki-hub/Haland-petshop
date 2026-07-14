# Architecture Audit

## Executive Summary

The repository has a solid foundation for a Next.js + Prisma + NextAuth ERP prototype, but it is not yet production-ready. The architecture is modular enough to support future growth, yet several areas still rely on ad hoc checks, duplicated business logic, and a permission model that is narrower than the stated business scope.

## Production Readiness Score

- Overall Architecture Readiness: 62/100
- Scalability: 58/100
- Maintainability: 64/100
- Security: 68/100
- Reliability: 54/100

## Folder Audit

### app/
- Purpose: Route-based UI, server components, and top-level layouts.
- Dependencies: Uses Next.js routing, auth, permissions hooks, and server actions.
- Findings: Route organization is mostly feature-driven, but some modules are only partially implemented and some route-level access control is handled by layout wrappers rather than a central policy layer.
- Risks: Access logic is spread across pages and layouts, which increases maintenance overhead.

### actions/
- Purpose: Server actions for business operations.
- Dependencies: Prisma, auth, permissions, common utilities.
- Findings: Business rules are embedded directly in server actions with repeated access checks.
- Risks: Repetition makes the system harder to evolve and increases the chance of inconsistent enforcement.

### components/
- Purpose: Shared UI components and feature-specific UI building blocks.
- Dependencies: React, Tailwind, hooks, shared UI patterns.
- Findings: Reusable components exist, but the UI still mixes business logic and presentation in several pages.
- Risks: Large page components reduce maintainability and make reuse harder.

### hooks/
- Purpose: Client-side behavior wrappers such as permission detection.
- Dependencies: NextAuth session state and permission utilities.
- Findings: The hooks layer is thin and appropriate, but it does not yet encapsulate richer feature state or data fetching concerns.
- Risks: Client-side logic remains coupled to page-level state.

### lib/
- Purpose: Shared services, utilities, auth, permissions, Prisma utilities.
- Dependencies: Prisma, NextAuth, shared business helpers.
- Findings: This is the most important architectural layer, but it still mixes authentication, permissions, formatting, and domain helpers in a way that could become brittle.
- Risks: Over time, the module will become a dumping ground unless it is split into clearer domain services.

### prisma/
- Purpose: Database schema, migrations, seed data.
- Dependencies: Prisma ORM and runtime env configuration.
- Findings: The schema is broad and feature-oriented, but several relationships lack explicit indexes and some models would benefit from clearer soft-delete or audit behavior.
- Risks: The schema is capable of supporting ERP use cases, but it still needs stronger consistency and performance safeguards.

## Architectural Strengths

- Clear feature-first organization in the app router.
- Separation of auth and permission utilities from UI.
- Server actions are already used instead of relying exclusively on API routes.
- Prisma is used centrally through a shared client wrapper.

## Architectural Gaps

- Permission logic is not yet fully aligned to the stated business scope.
- Grooming, customer monitoring, and some reporting workflows are not represented as first-class modules.
- Business logic is embedded in server actions rather than being routed through domain services.
- There is no clear repository layer for data access abstraction.
- There is limited central validation and transaction orchestration.

## Recommendations

1. Introduce a domain service layer for high-value flows such as billing, appointments, inventory, and invoices.
2. Centralize permission policy definitions instead of scattering checks across actions and layouts.
3. Add module-level feature scaffolds for grooming and customer monitoring before expanding the product scope further.
4. Add transaction-aware service helpers for inventory and invoice operations.
5. Standardize validation and error mapping across server actions.
