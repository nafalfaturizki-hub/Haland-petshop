# Production Deployment Checklist

Use this checklist before every production deployment.

## Pre-Deploy Checks

### Security
- [ ] AUTH_SECRET or NEXTAUTH_SECRET is set to a strong random value (minimum 32 characters)
- [ ] DATABASE_URL uses Neon pooled connection (`?pgbouncer=true`)
- [ ] DIRECT_URL uses Neon direct connection
- [ ] CSP headers are present in all responses (verify via browser DevTools)
- [ ] Input sanitization is active (test with `<script>` injection on text fields)
- [ ] No credentials or secrets are exposed in build logs or error messages

### Database
- [ ] Prisma migrations are up to date: `npx prisma migrate status`
- [ ] Database backup was taken within the last 24 hours
- [ ] Indexes are in place: `petId`, `customerId`, `invoiceNumber`, combined indexes
- [ ] Connection pool is configured (connection_limit in connection string)

### Build
- [ ] TypeScript compiles with zero errors: `npm run typecheck`
- [ ] All tests pass: `npm test`
- [ ] ESLint passes: `npm run lint`
- [ ] Build completes locally: `npm run build`
- [ ] Prisma client generates without errors

### Monitoring
- [ ] Health check endpoint responds: `GET /api/health`
- [ ] Readiness check endpoint responds: `GET /api/ready`
- [ ] Structured logging is active (check Vercel Logs dashboard)

## Deploy Steps

1. Push latest code to the production branch (main/master).
2. Vercel auto-deploys — monitor build logs for errors.
3. Verify build completes successfully (no Prisma client errors).
4. Check health endpoint returns 200: `curl https://your-domain.vercel.app/api/health`
5. Check readiness endpoint returns 200: `curl https://your-domain.vercel.app/api/ready`
6. Test login with existing credentials.
7. Verify a key workflow (e.g., create appointment, POS checkout).
8. Monitor Vercel Logs for 5 minutes for any error spikes.

## Post-Deploy

- [ ] Check Vercel Logs dashboard for errors.
- [ ] Verify audit logs are being written (check AuditLog table).
- [ ] Monitor Neon dashboard for connection count and query latency.
- [ ] Run a quick smoke test of critical paths:
  - Login → Dashboard → Create appointment → Create invoice
  - Login as DOKTER → View medical records
  - Login as CUSTOMER → View portal

## Rollback Plan

If the deployment causes issues:
1. **Instant rollback**: Use Vercel's Instant Rollback feature to revert to the previous deployment.
2. **Database rollback**: If migrations were applied and need reverting, follow the migration rollback procedure in `docs/database-operations.md`.
3. **Verify**: Test health check and key workflows after rollback.

## Emergency Contacts

- **Vercel Support**: https://vercel.com/support
- **Neon Support**: https://neon.tech/docs/support
- **Team Lead**: [Update with actual contact]
- **On-Call Engineer**: [Update with actual contact]
