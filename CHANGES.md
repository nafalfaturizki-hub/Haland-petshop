# Change Log

## 2026-07-06

- Added global `app/error.tsx` and `app/not-found.tsx` fallback pages.
- Added segment loading fallbacks for `app/(staff)/loading.tsx` and `app/(customer)/loading.tsx`.
- Added `hooks/use-polling.ts` and wired polling to staff dashboard, appointments, and POS pages.
- Converted staff appointment, POS, pets, and customer pages to use `sonner` toast notifications instead of inline message banners.
- Hardened settings backup restore payload validation with strict Zod schema.
- Added in-memory login rate limiting for `POST /api/auth/callback/credentials` in `middleware.ts`.
- Removed debug `console.log` from `lib/auth.ts`.
- Added Prisma indexes for common lookup columns in schema.
