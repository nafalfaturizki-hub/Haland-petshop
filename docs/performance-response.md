# Performance Degradation Response

## Identifying Slow Performance

### Monitoring Signals
- Page load times > 3 seconds (user-reported)
- API response times > 500ms (Vercel dashboard)
- Database query times > 100ms (Prisma query logging in development)
- Connection pool exhaustion errors in logs

### Diagnostic Steps

1. **Check Vercel Logs**: Look for slow API routes and error spikes.
2. **Check Neon Dashboard**: Monitor connection count, query latency, CPU usage.
3. **Enable Prisma Logging**: Set `NODE_ENV=development` to see slow queries (>100ms logged).
4. **Check Recent Deployments**: Identify if performance degraded after a specific deploy.

## Common Causes and Fixes

### Missing Database Index
**Symptom**: Sequential scans in queries, high latency on specific pages.
**Fix**: Add index for the queried columns. Current indexes cover: petId, customerId, invoiceNumber, status+date combinations, and foreign keys.

### Connection Pool Exhaustion
**Symptom**: Intermittent "connection pool exhausted" errors.
**Fix**: Increase `connection_limit` in DATABASE_URL. Use Neon pooled URL (with `?pgbouncer=true`). See `docs/database-operations.md`.

### N+1 Queries
**Symptom**: Multiple duplicate queries for related data.
**Fix**: Use Prisma `include` or `select` to eager-load relations instead of lazy loading.

### Large Dataset Without Pagination
**Symptom**: Memory spikes when viewing lists.
**Fix**: All list endpoints now support page/pageSize pagination. Ensure frontend passes pagination params.

### Serverless Cold Start
**Symptom**: First request after idle period is slow (5-10 seconds).
**Fix**: This is normal for serverless. Subsequent requests are fast. Consider Vercel Cron Jobs for keep-alive pings.

## Escalation

If performance issues persist after applying fixes:
1. Check Neon support for database-level issues.
2. Consider upgrading Vercel plan for more serverless concurrency.
3. Implement Redis/KV caching for frequently accessed data (lookups, settings).
