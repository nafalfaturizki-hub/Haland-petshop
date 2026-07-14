# Security Audit

## Scope

This audit reviews authentication, authorization, session handling, input validation, and basic hardening patterns in the repository.

## Strengths

- NextAuth is used for authentication.
- PIN-based login includes lockout logic.
- Middleware handles route guards for public and protected areas.
- Server actions rely on role-based checks in several flows.

## Concerns

- The role model is narrower than the product scope and may not be sufficient for enterprise-style access control.
- Authorization is partially enforced in UI and partially enforced in server actions.
- Inconsistent policy handling can create security drift over time.
- Some flows depend on direct role string checks rather than a centralized policy layer.

## Recommendations

- Centralize authorization policy definitions and apply them consistently at the server boundary.
- Ensure every state-changing server action validates permission before mutating data.
- Keep session claims minimal and use server-side revalidation for critical role changes.
- Continue to validate all inputs with Zod and reject malformed requests early.
