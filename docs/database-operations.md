# Database Operations

## Connection Pool Configuration

### Neon Pooled vs Direct Connection

Neon provides two connection types:
- **Pooled URL** (recommended for DATABASE_URL): `postgresql://user:pass@ep-example-123456-pooler.us-east-2.aws.neon.tech/db?pgbouncer=true&sslmode=require`
  - Connection pooler (PgBouncer) handles up to 10,000 concurrent connections.
  - Use this for application queries (Prisma runtime).
- **Direct URL** (required for DIRECT_URL): `postgresql://user:pass@ep-example-123456.us-east-2.aws.neon.tech/db?sslmode=require`
  - Direct connection for Prisma migrations.
  - Supports prepared statements and advisory locks.

### Pool Size Tuning

| Deployment | Recommended `connection_limit` |
|------------|-------------------------------|
| Vercel (serverless) | 10-20 |
| Single instance | 5-10 |
| High traffic | 20-50 |

Add to connection string: `?connection_limit=10&pool_timeout=10`

### Connection Timeout

Add `?connect_timeout=10` to both DATABASE_URL and DIRECT_URL to prevent
serverless cold starts from hanging for the default 30 seconds.

## Migration Rollback Procedure

### Rollback Steps

1. **Identify the problematic migration** from Vercel deploy logs or error messages:
   ```bash
   npx prisma migrate status
   ```

2. **Roll back the migration** (two options):

   **Option A — Resolve as rolled back (no schema change)**:
   ```bash
   npx prisma migrate resolve --rolled-back "migration_name"
   ```

   **Option B — Revert schema and re-create**:
   ```bash
   # 1. Revert to previous migration
   npx prisma migrate reset --skip-generate
   # 2. Apply all migrations up to the working one
   npx prisma migrate deploy
   ```

3. **Verify**:
   ```bash
   npx prisma migrate status
   # Should show all migrations as applied
   ```

4. **If database is corrupted** (data loss scenario):
   - Restore from Neon backup (see Backup/Restore section).
   - Apply migrations to the restored database.

### Prevention

- Always test migrations on a staging database before production.
- Use `prisma migrate dev` with `--create-only` to review generated SQL before applying.
- Set `SKIP_MIGRATIONS=true` in Vercel to control migration timing manually.

## Log Retention Policy

| Log Type | Retention | Location |
|----------|-----------|----------|
| Application logs | 30 days (Vercel) | Vercel Logs dashboard |
| Neon database logs | 7 days | Neon Console → Monitoring |
| Audit trail (AuditLog table) | Permanent (until manual cleanup) | PostgreSQL AuditLog table |
| Prisma query logs | Development only (not persisted) | Console output |
| Deployment logs | 30 days (Vercel) | Vercel Deployments → Logs |

**Compliance Note**: AuditLog table data is retained indefinitely to meet compliance requirements. If cleanup is needed, archive records older than 1 year to external storage before deletion.

## Migration Procedure

### Standard Deployment (Automatic)
1. Push code to production branch → Vercel auto-deploys.
2. Build script (`prepare-prisma-env.mjs`) runs `prisma migrate deploy`.
3. Post-deploy script retries migrations if build step failed.

### Manual Migration
```bash
# Run pending migrations
npx prisma migrate deploy

# Verify status
npx prisma migrate status

# Create new migration (development only)
npx prisma migrate dev --name description_of_change
```

### Rollback (if migration fails)
See "Migration Rollback Procedure" section above.
