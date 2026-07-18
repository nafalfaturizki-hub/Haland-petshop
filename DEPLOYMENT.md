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

### Notes

- The app uses secure auth cookies in production.
- The seed script no longer relies on the hard-coded default PIN in production.
- The build is resilient to local DB unavailability while still producing a production bundle.
