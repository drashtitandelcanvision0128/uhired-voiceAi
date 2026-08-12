## Shortlist (AIShortlist) — Project Restructure + Frontend/Backend Plan (Timeline)

### Objective
- **Goal**: Restructure the current project into a clean, scalable layout, add **marketing pages** (Home/About/Contact), and make **backend + external API-key integrations** secure and maintainable — without unnecessary extra code/models/dialogs.
- **Constraints**:
  - **No duplicate “models/dialogs”**: only add DB models and UI pieces that are truly required.
  - **API keys**: `.env` only, never exposed to the client, ready for rotation.
  - **Stable structure**: clear boundaries (marketing vs app/auth vs API vs DB).

---

## Current Signals (from the repo)
- **Stack**: Next.js (App Router), TypeScript, Prisma, Postgres.
- **Existing folders**: `src/`, `prisma/`, `public/`, `middleware.ts`, env files.
- **Untracked marketing files** (git status snapshot): `src/app/(marketing)/layout.tsx`, `src/components/marketing/site-footer.tsx`.

---

## Target Outcome (what “perfect” means here)
### UI/UX
- **Marketing pages**: Home, About, Contact — responsive, fast, clean CTA, consistent header/footer.
- **App experience**: no broken routes, consistent layout, proper metadata/SEO for marketing pages.

### Backend / Integrations
- **API layer**: one “integration module” per provider (single responsibility).
- **Key management**: server-only usage; validation on boot; clear error messages; retries/timeouts.
- **Database**: Prisma schema only for real entities; no “dummy” tables.

### Project Structure
- **Clear routes**: `(marketing)` group for public pages, `(app)` group for authenticated/functional app.
- **Shared UI**: design system components reusable.
- **Typed contracts**: Zod (or equivalent) validation for API inputs/outputs (server-side).

---

## Proposed Folder Structure (high-level)
> Exact file names will be finalized during implementation; this is the blueprint.

- **`src/app/(marketing)/`**
  - `page.tsx` (Home)
  - `about/page.tsx`
  - `contact/page.tsx`
  - `layout.tsx` (marketing layout: header/footer)
- **`src/app/(app)/`**
  - Core product pages / dashboard (existing app routes should live here)
- **`src/components/`**
  - `ui/` (buttons, inputs, cards, modal, toast)
  - `marketing/` (hero sections, navbar/footer, pricing/faq blocks)
  - `forms/` (contact form, etc.)
- **`src/lib/`**
  - `env.ts` (env validation; server-only)
  - `db.ts` (Prisma client wrapper)
  - `api/` (server fetch wrapper; timeouts/retries; typed errors)
  - `integrations/<provider>/` (external API clients, mappers)
  - `auth/` (if present; session/JWT utilities)
- **`src/server/`** (optional; if you prefer separating server concerns)
  - `services/` (business logic)
  - `repositories/` (DB access)
  - `validators/` (Zod schemas)
- **`prisma/`**
  - `schema.prisma`
  - `migrations/`
- **`docs/`**
  - `architecture.md`, `api.md`, `deployment.md` (short, practical)

---

## Features to Add (Scope)
### Marketing Frontend (now)
- **Home**
  - Hero + CTA (“Get shortlisted faster”)
  - How it works (3-step)
  - Social proof / stats (optional)
  - Footer with links + contact email
- **About**
  - Product story + value proposition
  - Team/company section (simple)
  - Roadmap teaser
- **Contact**
  - Contact form (server action or API route)
  - Validation + spam protection (basic rate limit / honeypot)
  - Success/failure UX

### Backend (now)
- **Contact form backend**
  - Store message in DB OR send email OR both (choose one path; avoid duplicates)
  - Basic rate limiting (by IP / session)
- **External API-key integration**
  - Centralized integration client
  - Strict input validation
  - Observability: structured logs, safe error messages

---

## “No extra code/models/dialogs” Guardrails
- **Models**
  - Add only if it supports real functionality (e.g., `ContactMessage`).
  - Avoid “general purpose” tables you don’t use (e.g., `Logs`, `Temp`, etc.).
- **UI Dialogs**
  - Prefer inline confirmation on forms.
  - Use 1 reusable modal component if truly needed; don’t create many variants.
- **API**
  - One endpoint per feature; keep payload minimal.
  - Shared request/response validators; no duplication.

---

## Timeline (Practical, Deliverable-driven)
> Assumes **10 working days**. If you want faster/slower delivery, we can scale the timeline.

### Phase 0 — Discovery & Baseline (Day 1)
- **Deliverables**
  - Current routes/components map
  - Integration points inventory (which APIs, where keys used)
  - Decide “contact backend” mode: DB vs email vs both
- **Acceptance**
  - Clear scope doc + risks list

### Phase 1 — Restructure Foundations (Day 2–3)
- **Deliverables**
  - Target folders created + imports cleaned
  - `src/lib/env.ts` style env validation plan (server-only)
  - Shared UI primitives structure decided (`src/components/ui`)
- **Acceptance**
  - Build passes; no route regressions

### Phase 2 — Marketing Layout + Pages (Day 4–5)
- **Deliverables**
  - `(marketing)` layout with navbar/footer
  - Home/About/Contact pages with consistent design
  - SEO metadata basics (title/description, OpenGraph placeholders)
- **Acceptance**
  - Lighthouse-friendly basics: responsive, no layout shift, accessible forms

### Phase 3 — Contact Backend + Persistence (Day 6–7)
- **Deliverables**
  - Contact form submission handling (server action or API route)
  - Validation + rate limit
  - DB model (only if chosen) + Prisma migration
- **Acceptance**
  - Form works end-to-end in dev; clear success/error states

### Phase 4 — External API-key Integration (Day 8–9)
- **Deliverables**
  - Provider client module(s) in `src/lib/integrations/`
  - Central fetch wrapper (timeouts, retries, typed errors)
  - Safe logging (no secrets)
- **Acceptance**
  - Integration tested via a minimal internal call path (no UI bloat)

### Phase 5 — Polish, Docs, Release Checklist (Day 10)
- **Deliverables**
  - `docs/architecture.md` + `docs/api.md` (short)
  - Deployment checklist updates (env keys, migrations)
  - Final cleanup (dead code removal, naming consistency)
- **Acceptance**
  - Clean structure; consistent naming; minimal duplication

---

## Testing Checklist (per phase)
- **Routing**: `/`, `/about`, `/contact` work without errors
- **Form**: validation, rate limit behavior, success redirect/message
- **Security**: API keys never in client bundle; env validation fails fast
- **DB**: migrations apply cleanly; no unused tables
- **DX**: lint/typecheck pass; consistent import boundaries

---

## Deployment / Environment (must-have)
- **Env keys**
  - `DATABASE_URL`
  - `<PROVIDER>_API_KEY` (server-only)
  - Optional: `CONTACT_TO_EMAIL` / SMTP keys (if email mode)
- **Rules**
  - Never commit `.env`
  - Use `.env.example` to document required variables

---

## Open Decisions (I’ll implement defaults when we start coding)
- **Contact handling**: DB-only vs Email-only vs DB+Email
- **Auth boundary**: Marketing fully public; App routes protected (if auth exists)
- **Design system**: Tailwind + existing UI approach (whatever repo already uses)

