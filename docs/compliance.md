# Compliance Documentation

## K2 — Data Privacy Policy

### Data Collected
- Personal information: name, phone, email, address
- Pet information: name, species, breed, medical records
- Authentication data: PIN hash (bcrypt, 10 rounds)
- Usage data: audit logs (user actions, timestamps)

### Data Storage
- All data stored in PostgreSQL (Neon) with encryption at rest
- PINs are hashed (never stored in plaintext)
- Database backups retained per Neon's backup policy (point-in-time recovery)

### Data Access
- Only authenticated staff (OWNER, ADMIN_KLINIK, DOKTER) can access patient data
- Customers can only access their own data via the portal
- All access is logged in the AuditLog table
- Role-based access control enforced at every server action

### Data Sharing
- No data is shared with third parties
- No analytics or tracking services collect user data
- No advertising or marketing use of customer data

### Data Retention
- Audit logs: permanent (required for compliance)
- Application logs: 30 days (Vercel)
- Database logs: 7 days (Neon)
- See `docs/database-operations.md` for full retention policy

## K4 — Audit Log Retention

The AuditLog table stores immutable records of all CRUD operations.
- **Retention**: Permanent (no automatic deletion)
- **Purpose**: Compliance, forensics, troubleshooting
- **Cleanup**: If cleanup is needed, archive records older than 1 year to external storage
- **Backup**: Protected by Neon's point-in-time recovery

## K5 — Data Export

Customer data can be exported through the portal:
- Customers can view their own pets, appointments, invoices, and medical records
- Staff can export reports via the Reports module
- Full data export requires database-level access (pg_dump)

## K6 — Data Deletion

### Customer Self-Service
- Customers can request data deletion via admin
- Admin can delete customers with no associated records
- Customer with active pets/appointments/invoices cannot be deleted (referential integrity)

### Deletion Process
1. Admin deletes all associated records (pets, appointments, invoices)
2. Customer record is deleted
3. Associated user account is deactivated (not deleted — maintains audit trail integrity)
4. Audit logs are preserved (immutable by design)

### GDPR Right to Erasure
- Data subject can request full deletion
- Audit logs are anonymized (user ID removed) rather than deleted
- Request must be processed within 30 days

## K7 — Consent Management

- No cookies or tracking are used beyond NextAuth.js session cookies
- Session cookies are strictly necessary for authentication
- No consent banner is required under current configuration

## K8 — PCI-DSS

Not applicable — the application does not process payment cards directly.
All payments are recorded as CASH or NON_CASH with no card data stored.
