# Disaster Recovery Plan

## Recovery Objectives
| Metric | Target |
|--------|--------|
| Recovery Time Objective (RTO) | 4 hours |
| Recovery Point Objective (RPO) | 5 minutes (Neon PITR) |

## Disaster Scenarios

### Scenario 1: Database Corruption
**Detection**: Health check returns 503, application errors.
**Recovery**: Use Neon Point-in-Time Recovery to restore to a timestamp before corruption.
1. Go to Neon Console → Branches → Restore
2. Select timestamp before corruption
3. Update DATABASE_URL to point to restored branch
4. Verify data integrity
5. Redeploy if connection string changed

### Scenario 2: Full Application Outage (Vercel)
**Detection**: App unreachable, Vercel Status page shows incident.
**Recovery**: 
1. Check Vercel Status Dashboard
2. If Vercel-side issue, wait for resolution
3. If deployment issue, use Vercel Instant Rollback

### Scenario 3: Data Deletion (Accidental or Malicious)
**Detection**: AuditLog shows unusual DELETE operations.
**Recovery**: 
1. Identify scope of deletion from AuditLog
2. Restore affected records from Neon backup
3. Review access controls to prevent recurrence

### Scenario 4: Credential Compromise
**Detection**: Suspicious login patterns or unauthorized access.
**Recovery**:
1. Rotate AUTH_SECRET immediately
2. Force all sessions to expire
3. Reset all user PINs
4. Review AuditLog for compromised accounts

## Recovery Team
- Primary: On-call engineer
- Secondary: Team lead
- Communication: Slack #incidents channel
