# Phase 7 — Enterprise (implemented)

**Default:** Phase 7b is **off** until you set `PHASE_7B_ENABLED=true` in `.env`.
Phase 7 foundation (CSP, rate limits, audit logs) stays on without this flag.

## Enable Phase 7b

```env
PHASE_7B_ENABLED=true
```

Then uncomment SSO button in `src/app/company-login/page.tsx` and team UI in `admin-page-client.tsx` (search `Phase 7b`).

## RBAC — Company team roles

| Role | Capabilities |
|------|----------------|
| **ADMIN** | Full access + team management |
| **HIRING_MANAGER** | Requirements, invites, candidates, settings read |
| **RECRUITER** | Candidates, invites, session read/write |
| **VIEWER** | Read-only sessions, candidates, requirements |

- Model: `CompanyMember` in Prisma
- APIs: `GET/POST /api/admin/team-members`, `PATCH/DELETE /api/admin/team-members/[memberId]`
- UI: Admin → Settings → Team & roles
- Backfill: `npm run db:backfill:company-members`

## SSO — OIDC (Google / Microsoft / generic)

When `COMPANY_OIDC_ISSUER`, `COMPANY_OIDC_CLIENT_ID`, and `COMPANY_OIDC_CLIENT_SECRET` are set:

- `GET /api/company-auth/oidc/start` — returns authorization URL
- `GET /api/company-auth/oidc/callback` — completes login
- Company login page shows **Sign in with your organization (SSO)**
- Optional `COMPANY_OIDC_AUTO_PROVISION=RECRUITER` for domain-matched new users

## PostgreSQL row-level security

Migration `20260806_row_level_security` enables RLS on tenant tables with `app.company_id` session variable.

Application helper: `withCompanyTenantScope(companyId, fn)` in `src/lib/prisma-tenant-scope.ts`.

Master / practice flows use `bypassTenantRls`.

## Field-level encryption

Optional `FIELD_ENCRYPTION_KEY` encrypts candidate emails at rest (`enc:v1:` prefix).

Helpers: `src/lib/field-encryption.ts` — wired into candidate create/read APIs.

## Redis rate limiting

Set `REDIS_URL` for shared rate limits across instances. Falls back to in-memory when unset.

## SOC 2 readiness

See `docs/SOC2-READINESS.md` for control mapping and audit checklist.

## Tests

```bash
npm run test:enterprise
npm run test:privacy
npm run build
```

## Not in scope (future)

- Full SAML (use OIDC bridge)
- ATS integrations (Greenhouse, Lever)
- Formal SOC 2 audit / ISO certification
