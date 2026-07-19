# Deployment Guide

## Zero-Configuration Deployment on Vercel

This app is prepared for Vercel deployment with Neon Database through the Vercel Marketplace.

### Required environment variables

Set only these variables in Vercel:

- DATABASE_URL: provided automatically by Neon/Vercel integration
- DIRECT_URL: provided automatically by Neon/Vercel integration
- AUTH_SECRET or NEXTAUTH_SECRET: set to a strong random value
- AUTH_URL or NEXTAUTH_URL: set to your production domain

### Optional variables

- SEED_ON_DEPLOY=false to skip automatic seeding after deployment
- INITIAL_OWNER_PIN=your-strong-pin to create seed users during first deployment
- SKIP_MIGRATIONS=true if you want to manage migrations manually

### Deployment flow

1. Connect the repository to Vercel.
2. Add the Neon Database integration from the Vercel Marketplace.
3. Vercel will inject DATABASE_URL and DIRECT_URL automatically.
4. Set AUTH_SECRET and AUTH_URL in the Vercel project settings.
5. Deploy.

### Automatic steps during deployment

- Prisma client is generated during build.
- Prisma migrations are attempted through the post-deploy script.
- Seed data is skipped in production unless INITIAL_OWNER_PIN is supplied.

### Troubleshooting

#### Build fails with "PrismaClientInitializationError"
- **Cause**: DATABASE_URL is missing or unreachable during build.
- **Fix**: Verify Neon integration is active in Vercel Marketplace. Ensure DATABASE_URL and DIRECT_URL are set in Vercel Environment Variables.
- **Note**: The build script tries migrations but does not fail the build if the DB is unavailable; the post-deploy script retries.

#### Build fails with "PrismaClientKnownRequestError: P1001"
- **Cause**: Database connection timeout (often Neon cold start).
- **Fix**: Retry the deployment. Add `?connect_timeout=10` to DATABASE_URL in Vercel environment variables for a longer timeout.

#### "Cannot find module '@prisma/client'" on first deploy
- **Cause**: Prisma client was not generated during build.
- **Fix**: Run `npx prisma generate` manually in Vercel Build Command or verify `node scripts/prepare-prisma-env.mjs --build` is the build command in vercel.json.

#### 503 errors from health check endpoint
- **Cause**: Database is down or unreachable.
- **Fix**: Check Neon status dashboard. Verify IP allowlist includes Vercel's egress IPs if using Neon's IP restriction feature.

#### Login returns "Too many requests" (429)
- **Cause**: In-memory rate limiting resets on cold start but can trigger under rapid login attempts.
- **Fix**: Wait 15 minutes or upgrade to Vercel KV/Redis-based rate limiting (production recommendation).

#### Database connection timeout or "connection pool exhausted"
- **Cause**: Connection pool size is too small or connections are leaking.
- **Fix**: Use Neon's pooled connection string for DATABASE_URL (includes `?pgbouncer=true` or similar). Ensure DIRECT_URL uses the direct (non-pooled) connection for migrations.

#### Notes

- The app uses secure auth cookies in production.
- The seed script no longer relies on the hard-coded default PIN in production.
- The build is resilient to local DB unavailability while still producing a production bundle.
