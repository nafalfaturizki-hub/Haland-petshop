# Incident Response Runbook

## Incident Severity Levels

| Level | Definition | Response Time |
|-------|-----------|---------------|
| SEV1 | Complete outage (app unreachable, DB down) | 15 minutes |
| SEV2 | Partial outage (feature broken, slow) | 1 hour |
| SEV3 | Minor issue (cosmetic, non-critical) | Next business day |

## SEV1 — Complete Outage

### Symptoms
- Health check returns 503
- All users see error pages
- Database connection errors in Vercel logs

### Response Steps
1. **Check Vercel Status**: https://vercel-status.com
2. **Check Neon Status**: https://neon.status-page.com
3. **Verify Environment Variables**: DATABASE_URL, DIRECT_URL, AUTH_SECRET in Vercel
4. **Check Database Connectivity**: Run `npx prisma db push --skip-generate` locally with DIRECT_URL
5. **Rollback Deployment**: Use Vercel Instant Rollback to previous working version
6. **If Database Issue**: Restore from Neon backup (point-in-time recovery)

### Escalation
- If unresolved in 15 minutes, contact Neon support
- If Vercel issue, contact Vercel support

## SEV2 — Partial Outage

### Symptoms
- Specific feature broken (POS, invoice, etc.)
- Slow page loads (>5 seconds)
- Intermittent errors

### Response Steps
1. Check Vercel Logs dashboard for errors
2. Check Neon dashboard for slow queries or connection pool exhaustion
3. Check recent deployments for problematic changes
4. Rollback if issue is deployment-related
5. For slow queries: check Prisma query logs (>100ms queries logged in development)

### Common Causes
- Connection pool exhaustion → Increase `connection_limit` in DATABASE_URL
- Missing index → Add index for queried columns
- Cold start latency → Normal for serverless; should settle within 5 seconds

## SEV3 — Minor Issue

### Symptoms
- UI formatting issues
- Non-critical error messages
- Missing optional data

### Response Steps
1. Log the issue in project tracking
2. Assign to next sprint
3. No immediate action required

## Communication Plan

| Severity | Notify | Method |
|----------|--------|--------|
| SEV1 | Team lead + on-call | Phone/Slack immediate |
| SEV2 | Development team | Slack within 1 hour |
| SEV3 | Project manager | Next standup |

## Post-Incident

1. Document timeline of events
2. Identify root cause
3. Implement preventive measures
4. Update this runbook with lessons learned

## L7 — Security Incident Response

### Data Breach Response
1. **Contain**: Isolate compromised components, revoke exposed credentials.
2. **Assess**: Determine scope via AuditLog for unusual activity.
3. **Notify**: Inform affected users within 72 hours (GDPR). Notify team lead immediately.
4. **Remediate**: Patch vulnerability, rotate secrets, review access controls.
5. **Document**: Record timeline, root cause, affected records, remediation steps.

### Common Security Incidents
| Incident | Response |
|----------|----------|
| Brute force login | Check failedPinAttempts, enable lockout |
| Unauthorized access | Audit AuditLog, review roles, revoke access |
| Session compromise | Rotate AUTH_SECRET, force all logouts |

## L8 — On-Call Escalation

| Level | Contact | Method | Response Time |
|-------|---------|--------|---------------|
| Primary | On-call engineer | Slack/Phone | 15 min (SEV1) |
| Secondary | Team lead | Phone | 30 min |
| Tertiary | Dev team | Slack | 1 hour |
| External | Vercel Support | Ticket | Per SLA |
| External | Neon Support | Ticket | Per SLA |
