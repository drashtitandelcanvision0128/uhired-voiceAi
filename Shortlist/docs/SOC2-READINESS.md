# SOC 2 Readiness — Uhired

This document maps implemented security controls to common SOC 2 trust criteria. It is **not** a certification — formal SOC 2 requires auditor engagement, policies, and operating evidence over time.

## Implemented technical controls

| Control area | Implementation |
|--------------|----------------|
| Access control | Company RBAC (`ADMIN`, `RECRUITER`, `HIRING_MANAGER`, `VIEWER`); master portal separate auth |
| Authentication | Session cookies (HMAC-signed); optional OIDC SSO for company admins |
| Tenant isolation | Application `companyId` filters + PostgreSQL RLS on tenant tables |
| Encryption in transit | HTTPS (production HSTS header) |
| Encryption at rest (PII) | Optional `FIELD_ENCRYPTION_KEY` for candidate emails |
| Audit logging | `PlatformAuditLog` with `PRIVACY` / `SECURITY` categories |
| Rate limiting | In-memory + optional Redis (`REDIS_URL`) |
| Data retention | `npm run data:retention:cleanup` |
| Deletion requests | Self-service + master queue at `/master/data-deletion-requests` |
| Consent | Interview consent gate before LIVE status |

## Policies to document (organizational)

1. **Access review** — quarterly review of `CompanyMember` roles (Admin → Settings → Team).
2. **Incident response** — runbook for credential leak, DB breach, and vendor outage.
3. **Change management** — PR review + `npm run build` + staged deploy.
4. **Vendor management** — OpenAI, AWS, Razorpay, Supabase DPAs and subprocessors list.
5. **Backup & recovery** — Postgres PITR / snapshot RPO/RTO targets.

## Penetration test checklist (pre-audit)

- [ ] Attempt cross-tenant session access (another `companyId` in API)
- [ ] Verify RLS blocks raw SQL without `app.company_id`
- [ ] Test OIDC state tampering on `/api/company-auth/oidc/callback`
- [ ] Brute-force rate limits on login and delete-request
- [ ] Scorecard share token entropy and expiry

## Environment secrets (production)

- `COMPANY_SESSION_SECRET`, `MASTER_SESSION_SECRET`
- `FIELD_ENCRYPTION_KEY` (32-byte hex recommended)
- `COMPANY_OIDC_*` when SSO enabled
- `REDIS_URL` for multi-instance rate limits
