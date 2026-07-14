# Master Refactor Plan

## Current Readiness

- Architecture readiness: 62%
- Source readiness: 57%
- Database readiness: 54%
- Permission readiness: 48%
- Overall production readiness: 55%

## Risk Analysis

- High risk: Database connectivity and Prisma validation are currently blocked; this is validated by the build failure and the Prisma connection error during startup.
- High risk: Permission model does not yet support the requested ERP role set; this is validated by [middleware.ts](../middleware.ts) and [lib/permissions.ts](../lib/permissions.ts).
- Medium risk: Business logic is still tightly coupled to page and action layers; this is validated by the server action and route implementations in [actions/pos.ts](../actions/pos.ts), [actions/invoice.ts](../actions/invoice.ts), [actions/appointment.ts](../actions/appointment.ts), and [actions/pet-hotel.ts](../actions/pet-hotel.ts).
- Medium risk: UI and server logic will need to be refactored incrementally to preserve behavior; this is validated by the shared UI and layout entry points in [app/(staff)/layout.tsx](../app/(staff)/layout.tsx) and [components/layout/sidebar.tsx](../components/layout/sidebar.tsx).

## Dependency Graph

- Auth -> Permissions -> Routes -> UI
- Actions -> Permissions -> Prisma -> Database
- Prisma -> Schema -> Migrations -> Runtime

## Module Priority

1. Authentication and authorization foundation
   - Validated from [middleware.ts](../middleware.ts), [lib/auth.ts](../lib/auth.ts), and [lib/permissions.ts](../lib/permissions.ts).
2. Prisma runtime and database health
   - Validated from [prisma/schema.prisma](../prisma/schema.prisma) and the current build failure.
3. Shared policy and service layer
   - Validated from the business logic duplication across [actions/pos.ts](../actions/pos.ts), [actions/invoice.ts](../actions/invoice.ts), [actions/appointment.ts](../actions/appointment.ts), and [actions/pet-hotel.ts](../actions/pet-hotel.ts).
4. Inventory and billing flows
   - Validated from [actions/product.ts](../actions/product.ts), [actions/inventory.ts](../actions/inventory.ts), [actions/invoice.ts](../actions/invoice.ts), and [lib/inventory-helpers.ts](../lib/inventory-helpers.ts).
5. Grooming and customer monitoring feature scaffolds
   - Validated from the current module inventory and the absence of first-class implementations in the route tree.
6. UI consolidation and cleanup
   - Validated from [app/(staff)/pos/page.tsx](../app/(staff)/pos/page.tsx) and the shared layout components.

## Refactor Order

1. Stabilize environment and database connectivity.
   - Audit finding: database readiness is currently blocked by Prisma connection failures and missing runtime env configuration.
   - Baseline state: [BASELINE_REPORT.md](BASELINE_REPORT.md) records the build, Prisma, and connectivity failures.
   - Regression matrix: [REGRESSION_MATRIX.md](REGRESSION_MATRIX.md) includes authentication, authorization, inventory, POS, and billing coverage checks.
   - Expected outcome: the application can start, validate schema, and run a baseline smoke test in a configured environment.
2. Introduce a centralized permission policy layer.
   - Audit finding: the current role model is narrower than the requested ERP role set and is spread across route guards and action checks.
   - Baseline state: [BASELINE_REPORT.md](BASELINE_REPORT.md) and [docs/PERMISSION_GAP.md](PERMISSION_GAP.md) document the gap.
   - Regression matrix: [REGRESSION_MATRIX.md](REGRESSION_MATRIX.md) tracks authorization and route-access regressions.
   - Expected outcome: staff and customer access is governed by a single policy layer with consistent role-to-module behavior.
3. Extract domain services for critical flows.
   - Audit finding: POS, billing, appointments, medical records, and pet hotel logic remain tightly coupled to UI actions.
   - Baseline state: [BASELINE_REPORT.md](BASELINE_REPORT.md) calls out the need for transaction-safe service boundaries.
   - Regression matrix: [REGRESSION_MATRIX.md](REGRESSION_MATRIX.md) covers inventory, POS, invoice, medical record, and appointment flows.
   - Expected outcome: high-value workflows are moved behind domain services so business policies and data integrity are easier to test and maintain.
4. Refactor route-level access and menu visibility.
   - Audit finding: route protection and menu exposure are distributed across middleware, layout code, and helper files.
   - Baseline state: [BASELINE_REPORT.md](BASELINE_REPORT.md) notes authorization risk and the need for a more coherent policy model.
   - Regression matrix: [REGRESSION_MATRIX.md](REGRESSION_MATRIX.md) includes authorization and dashboard coverage.
   - Expected outcome: navigation and route access visually and functionally match the approved role policy.
5. Add regression tests around permissions and server actions.
   - Audit finding: the repository has some test scaffolding, but the current baseline still needs stronger regression protection around permissions and core workflows.
   - Baseline state: [BASELINE_REPORT.md](BASELINE_REPORT.md) records the current readiness gap and [FEATURE_COVERAGE.md](FEATURE_COVERAGE.md) highlights the remaining feature areas.
   - Regression matrix: [REGRESSION_MATRIX.md](REGRESSION_MATRIX.md) defines the workflows that require automated and manual regression verification.
   - Expected outcome: each critical workflow has a repeatable regression test path before the next refactor milestone is merged.
6. Gradually move UI logic out of large page components.
   - Audit finding: complex page-level state and business logic are present in major staff pages.
   - Baseline state: [BASELINE_REPORT.md](BASELINE_REPORT.md) identifies page-level coupling as technical debt.
   - Regression matrix: [REGRESSION_MATRIX.md](REGRESSION_MATRIX.md) covers POS, billing, dashboard, and clinic experience safeguards.
   - Expected outcome: page components become thinner and easier to maintain while preserving the current user experience.

## Estimated Time

- Foundation and policy work: 3-5 days
- Service-layer extraction: 4-6 days
- Feature scaffolds and validation: 2-3 days
- Testing and stabilization: 2-3 days

## Breaking Risk

- Medium, assuming refactors are incremental and behavior is preserved.

## Regression Risk

- Medium, especially around authentication flows and UI access control.

## Testing Strategy

- Add permission-focused unit tests.
- Add server action integration tests for critical business flows.
- Re-run build and Prisma validation after each incremental change.
- Verify route-based access behavior in a staging environment.

## Rollback Strategy

- Keep changes small and feature-scoped.
- Use versioned migrations and preserve the existing route structure until policy changes are validated.
- Revert any module refactor that breaks existing business behavior.
