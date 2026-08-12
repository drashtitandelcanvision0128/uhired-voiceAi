# Uhired Architecture — Implementation Phases

Based on SRS v2.0 and security architecture review. Each phase is sized for ~1–3 working days.

| Phase | Focus | Est. effort | Status |
|-------|--------|-------------|--------|
| 1 | Foundation (`env.ts`, docs) | 1 day | Done |
| 2 | Route protection + security headers | 1 day | Done |
| 3 | Credential hardening (passcode hashing) | 1–2 days | Done |
| 4 | API privacy (no passcode leakage) | 1 day | Done |
| 5 | Integration wiring + validation | 1 day | Done |
| 6 | Privacy consent + retention | 2–3 days | Done |
| 7 | Enterprise foundation (CSP, audit, rate limit) | 2–3 days | Done (foundation) |
| 7b | Enterprise full (RBAC, SSO, RLS) | 2+ weeks | Done |

---

## Phase 1 — Foundation

**Goal:** Fail-fast config, typed secrets, architecture reference.

**Deliverables:**
- `src/lib/env.ts` — Zod-validated server environment
- This document

**Functionality unlocked:**
- Production boot fails clearly if `DATABASE_URL` or critical secrets missing
- Single source of truth for `OPENAI_API_KEY`, session secrets, Razorpay keys
- Safer refactors (no scattered `process.env`)

---

## Phase 2 — Defense at the edge

**Goal:** Middleware protects master routes; HTTP security headers on all responses.

**Deliverables:**
- Extended `middleware.ts` — `/master/*`, `/api/master/*` (except login)
- `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, etc.

**Functionality unlocked:**
- Unauthenticated users cannot reach master pages/API without valid session cookie
- Reduced XSS/clickjacking risk

**Note:** `/interview/*` stays API-guarded only (practice flow has no candidate cookie).

---

## Phase 3 — Credential hardening

**Goal:** Company admin passcodes stored hashed (scrypt), not plaintext.

**Deliverables:**
- `src/lib/company-passcode.ts`
- Login/register/settings/master passcode routes updated
- `scripts/hash-company-passcodes.mjs` — one-time migration

**Functionality unlocked:**
- DB leak does not expose company admin passwords
- Auto-upgrade plaintext → hash on successful login

---

## Phase 4 — API privacy

**Goal:** Never return stored passcodes in JSON APIs.

**Deliverables:**
- `GET /api/master/companies` — no `adminPasscode` field
- Master companies UI — passcode only on create/regenerate
- `POST /api/master/companies` — optional passcode on update

---

## Phase 5 — Integration wiring (done)

**Goal:** Critical paths use `env.ts` instead of raw `process.env`.

**Deliverables:**
- `prisma.ts`, `openai.ts`, `razorpay.ts`, `scoring.ts`, `pricing.ts`, `data-retention.ts`
- Auth: `master-auth.ts`, `company-admin-auth.ts`, `candidate-interview-auth.ts`, `company-invite.ts`
- Email/SMTP: `email.ts`, `smtp-delivery-mode.ts`, `public-app-url.ts`
- AI helpers: `semantic-evaluation.ts`, `question-grading.ts`, `extract-transcript-qa.ts`, etc.
- Storage: `interview-video-storage.ts`

**Note:** Edge middleware (`edge-session-verify.ts`) and client components still read `process.env` where `server-only` cannot be used.

---

## Phase 6 — Privacy & consent (done)

- Interview room consent checkbox + `consentAcceptedAt` on session
- `POST /api/interview/[sessionId]/consent` + LIVE blocked without consent
- `POST /api/privacy/delete-request` + form on `/privacy`
- `GET /api/master/data-deletion-requests` + master UI at `/master/data-deletion-requests`
- `scripts/data-retention-cleanup.mjs` + `npm run data:retention:cleanup`
- `npm run test:privacy` + `npm run test:privacy:api`

---

## Phase 7 — Enterprise foundation (done)

- CSP + security headers in `middleware.ts`
- Centralized rate limiting (`src/lib/rate-limit.ts`) on contact + delete-request APIs
- Audit log categories `PRIVACY` / `SECURITY`; scorecard PDF download audited
- Master deletion queue PATCH (`PROCESSED` / `REJECTED`)

---

## Phase 7b — Enterprise full (done)

See `docs/PHASE-7-ENTERPRISE.md` and `docs/SOC2-READINESS.md`:

- Company RBAC (`CompanyMember` roles + team API + admin UI)
- OIDC SSO for company admins (Microsoft/Google/generic)
- PostgreSQL RLS on tenant tables + `withCompanyTenantScope`
- Optional field encryption for candidate emails
- Optional Redis-backed rate limiting
- SOC 2 readiness documentation
