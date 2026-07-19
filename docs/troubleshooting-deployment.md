# Troubleshooting Guide

## Deployment Issues

### Prisma Client Not Found
**Symptom**: `Cannot find module '@prisma/client'`  
**Cause**: Prisma client was not generated during build.  
**Fix**: Ensure build command is `node scripts/prepare-prisma-env.mjs --build`.  
Run `npx prisma generate` locally and commit the generated client (falls back to postinstall).

### Database Connection Refused (P1001)
**Symptom**: `PrismaClientInitializationError: Can't reach database server`  
**Cause**: Connection timeout (common with Neon cold starts on serverless).  
**Fix**: 
- Add `?connect_timeout=10` to DATABASE_URL and DIRECT_URL.
- Verify Neon integration is active in Vercel Marketplace.
- Check Neon IP allowlist is not blocking Vercel.

### Migration Failed
**Symptom**: `PrismaClientKnownRequestError` or migration error in build logs.  
**Cause**: Schema drift or incompatible migration.  
**Fix**:
- Set `SKIP_MIGRATIONS=true` in Vercel env vars to bypass automatic migration.
- Run `npx prisma migrate deploy` manually from local with DIRECT_URL.
- If migration is stuck, use `npx prisma migrate resolve --rolled-back "migration_name"`.

### Seeding Not Running
**Symptom**: No seed data on first deployment.  
**Cause**: `SEED_ON_DEPLOY` is not set or `INITIAL_OWNER_PIN` is missing.  
**Fix**: Set both `SEED_ON_DEPLOY=true` and `INITIAL_OWNER_PIN=your-pin` in Vercel env vars for first deployment. Remove after seeding.

### 429 Rate Limited
**Symptom**: Login returns "Too many requests".  
**Cause**: In-memory rate limiting.  
**Fix**: Wait 15 minutes. For production, set up Vercel KV/Redis for persistent rate limiting.

### Health Check Returns 503
**Symptom**: `/api/health` returns `{"status":"error","db":"down"}`.  
**Cause**: Database is unreachable.  
**Fix**: Check Neon dashboard for database status. Verify DATABASE_URL is correct.

## Application Issues

### Login Fails
- Verify username exists in database.
- Check PIN is correct (default seed: 123456).
- Account may be locked after 5 failed attempts (wait 15 minutes or ask admin to unlock).
- Check browser console for network errors.

### Appointments Not Showing
- Customer portal shows only the customer's appointments.
- Staff view filters by doctor role (DOKTER sees only their appointments).
- Check that date filters are not excluding results.

### Invoice Not Created
- Check all required fields are filled (customer, items).
- Stock must be sufficient for products.
- Discount cannot make total zero or negative.
- Invoice number generation retries on conflict; if it fails 3 times, see deployment logs.

### POS Price Changed
**Symptom**: "Harga produk telah berubah" error on checkout.  
**Cause**: Product sellPrice was updated between searching and checkout.  
**Fix**: Refresh the POS page and re-add items.

## Performance Issues

### Slow Page Loads
- Enable development query logging to identify slow Prisma queries.
- Check Neon dashboard for query performance metrics.
- Ensure pagination is working (lists default to 50 items per page).

### Database Connection Pool Exhausted
**Symptom**: Intermittent connection errors under load.  
**Cause**: Too many concurrent connections.  
**Fix**: Use Neon's pooled connection URL for DATABASE_URL. 
Set `?pgbouncer=true&connection_limit=10` in the connection string.

## Error Messages Reference

| Error | Meaning | Action |
|-------|---------|--------|
| `Stok produk ... tidak mencukupi` | Insufficient stock | Reduce quantity or restock |
| `Stok produk berubah saat diproses` | Concurrent stock change | Retry the transaction |
| `Invoice number conflict` | Duplicate invoice number | Auto-retried (up to 3 times) |
| `Dokter sudah memiliki jadwal` | Doctor double-booking | Choose another doctor or time |
| `Kamar sudah dipesan` | Room double-booking | Choose another room or date range |
| `Anda tidak berwenang` | Permission denied | Check user role |
| `Gagal memperbarui akun` | User update failed | Check logs for details |
