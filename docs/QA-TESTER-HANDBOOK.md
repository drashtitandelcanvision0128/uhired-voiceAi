# Uhired — QA Tester Handbook

**Version:** 1.0  
**Date:** August 7, 2026  
**Audience:** Dedicated platform tester (1 person, all use cases)  
**Status:** Active

---

## 1. Purpose

This handbook is the **single reference** for the dedicated tester responsible for validating the entire Uhired platform across all roles, journeys, and features before each release.

**Scope covers:**
- Homepage & marketing
- Company Admin (recruiter) portal
- Master Admin portal
- Candidate interview flow
- Video recording
- AI scorecard & analysis
- Practice interviews (secondary)

---

## 2. Tech Stack (Development Team Decision)

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes, Prisma ORM |
| Database | PostgreSQL (Supabase) |
| AI Interview | OpenAI Realtime (WebRTC voice) |
| AI Scoring | OpenAI Responses API (rubric + per-question) |
| Video Storage | S3 / Supabase Storage / Local (`public/interview-videos/`) |
| Email | SMTP or AWS SES |
| Auth | Cookie sessions (company, master, candidate) |

**Tester does not need to choose tech** — only verify behaviour matches requirements below.

---

## 3. Tester Role & Responsibilities

| Responsibility | Detail |
|----------------|--------|
| **Pre-release regression** | Run automated suite + manual checklist before every deploy |
| **New feature validation** | Test against user journey DD (`docs/USER-JOURNEY-DD.md`) |
| **Bug reporting** | Log: steps, expected vs actual, screenshot, session ID |
| **Environment** | Maintain test credentials; never use production candidate PII |
| **Sign-off** | Complete sign-off sheet (Section 10) before release approval |

**Recommended cadence:**
- Daily smoke (automated): ~5 min
- Full regression (automated + manual): before each release (~2–3 hours)
- Live interview test (browser, mic/cam): weekly or before major interview changes

---

## 4. Environment Setup

### 4.1 Prerequisites

```bash
# Clone repo, install deps
npm install

# Copy env and configure
cp .env.example .env
# Required for full testing:
#   DATABASE_URL, OPENAI_API_KEY
# Optional: SMTP_* or AWS SES for invite emails
# Optional: AWS S3 for cloud video storage (default: local)

# Migrate database
npm run db:migrate

# Start dev server
npm run dev
```

**Base URL:** `http://localhost:3000` (or staging URL)

### 4.2 Test Credentials

| Role | URL | Credentials |
|------|-----|-------------|
| **Master Admin** | `/master-login` | `.env` → `MASTER_ADMIN_EMAIL` / `MASTER_ADMIN_PASSWORD` (default: `master@uhired.com` / `master@123`) |
| **Company Admin** | `/company-login` | Company: `Uhired`, Domain: `uhired.com`, Email: `admin@uhired.com`, Passcode: `admin123` |
| **Candidate** | `/candidate` | No account — uses invite code from admin |
| **Practice** | `/practice` | No account — public flow |

### 4.3 Browser Requirements

- Chrome or Edge (latest)
- Camera + microphone allowed for live interview tests
- Disable ad-blockers on localhost if API calls fail

---

## 5. Automated Test Suite (Run First)

### 5.1 One command — full automated regression

```bash
npm run test:qa
```

Runs all suites below in sequence (~2–3 min). **Server must be running** (`npm run dev`).

### 5.2 Individual suites

| Command | What it tests |
|---------|---------------|
| `node scripts/test-user-journey.mjs` | Full recruiter + candidate E2E (16 checks) |
| `node scripts/test-admin-live-qa.mjs` | Admin login, dashboard, invite APIs |
| `node scripts/test-component-features.mjs` | Save requirement, candidate preview, master analytics |
| `node scripts/test-recording-scorecard.mjs` | Video upload + AI scorecard (15 checks) |
| `npm run test:interview:unit` | Speech, VAD, conversation FSM unit tests |
| `node scripts/test-master-login.mjs` | Master login success/failure |
| `npm run test:polish` | CMS, observer links, candidate portal APIs |

### 5.3 Expected result

```
PASS  User Journey (Recruiter + Candidate E2E)
PASS  Admin Live QA
PASS  Component Features
PASS  Video Recording + AI Scorecard
PASS  Interview Unit Tests

Total: 5/5 passed
```

**If any suite fails:** do not sign off release. File bug with suite name + failure output.

---

## 6. Manual Test Matrix — All Use Cases

### 6.1 Homepage

| # | Test | Steps | Expected |
|---|------|-------|----------|
| H1 | Homepage loads | Open `/` | Marketing page, header, footer visible |
| H2 | Company login link | Click Company Login | Lands on `/company-login` |
| H3 | Practice link | Click practice CTA | Lands on `/practice` |

---

### 6.2 Company Admin (Recruiter)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| A1 | Login | `/company-login` with valid creds | Redirect to `/admin` |
| A2 | Login failure | Wrong passcode | Red error, no redirect |
| A3 | Dashboard | Open Dashboard section | KPIs, recent sessions load |
| A4 | Create requirement | Overview → fill JD, role, skills → **Save Requirement** | Success message; appears in Requirements |
| A5 | Invite candidates | Overview → add emails → Send Invites | Codes shown; emails sent (or codes in UI if SMTP off) |
| A6 | Requirements history | Requirements section | List, search, edit, delete work |
| A7 | Interview sessions | Sessions section | Completed sessions listed with filters |
| A8 | Session detail | Open a completed session | Scorecard, transcript, recording link |
| A9 | AI scorecard | Session detail | Overall score, bars, summary, strengths, improvements, evidence |
| A10 | Per-question review | Session detail (wait 1 min or click Regrade) | Q&A review with Pass/Fail per question |
| A11 | Video recording | Session detail | "Recording: Available" + View/Download works |
| A12 | Share scorecard | Create share link | Public URL opens without login |
| A13 | Candidates list | Candidates section | Candidate rollup with session history |
| A14 | Logout | Click logout | Returns to login |

---

### 6.3 Master Admin

| # | Test | Steps | Expected |
|---|------|-------|----------|
| M1 | Login | `/master-login` | Lands on `/master/dashboard` |
| M2 | Create company | `/master/companies` → Create | Company saved with admin credentials |
| M3 | Company sessions | `/master/company-sessions` | List of all company interviews |
| M4 | Interview analytics | `/master/interview-analytics` | Requirements created, invites, sessions, trends |
| M5 | User analytics | `/master/user-analytics` | User counts by type |
| M6 | Reports | `/master/reports` | Period-filtered platform report |
| M7 | Stuck sessions | `/master/stuck-sessions` | LIVE sessions stuck > threshold listed |
| M8 | Logout | Logout | Returns to master login |

---

### 6.4 Candidate Interview

| # | Test | Steps | Expected |
|---|------|-------|----------|
| C1 | Invite landing | Open `/candidate?code=XXXX` from invite | Role + company preview card shown |
| C2 | Invalid code | Enter wrong code | Error message |
| C3 | Email mismatch | Valid code, wrong email | 403 rejected |
| C4 | Start interview | Valid code + name + email | Redirect to `/interview/{id}` |
| C5 | Preflight | Consent + Check camera & mic | Permissions granted, device OK |
| C6 | Live interview | Start voice interview | AI speaks, timer counts down, REC badge (company) |
| C7 | End interview | End or timer expiry | Thank you screen |
| C8 | Post-interview | Click "Go to homepage" | Lands on `/` |
| C9 | Re-entry blocked | Try same code after complete | "Already completed" error |

---

### 6.5 Video Recording (Requirement #1)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| V1 | Recording during interview | Complete company interview with camera on | REC indicator visible during live |
| V2 | Upload completes | Wait on thank-you screen | No upload error banner |
| V3 | Admin sees recording | Admin → session detail | `videoRecordingStatus: AVAILABLE` |
| V4 | View recording | Click View recording | Video plays in new tab |
| V5 | Download recording | Click Download | File downloads |
| V6 | No recording filter | Sessions → filter "No recording" | Only sessions without video listed |

---

### 6.6 AI Scorecard (Requirement #2)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| S1 | Score on complete | Finish interview | Scorecard created immediately (heuristic) |
| S2 | AI holistic analysis | Wait 1–2 min, refresh session | Summary, strengths, improvements updated by AI |
| S3 | Dimension scores | Session detail | Communication, Domain, Confidence bars shown |
| S4 | Answer accuracy | After background grading | Accuracy % shown |
| S5 | Per-question AI | Question review section | Each Q has Pass/Fail, score, feedback |
| S6 | Regrade | Click "Generate answer review" | Re-runs AI grading successfully |
| S7 | Share scorecard | Create share link | Public page shows score + Q&A review |
| S8 | PDF export | Download PDF from share page | PDF generates |

---

### 6.7 Edge Cases & Security

| # | Test | Expected |
|---|------|----------|
| E1 | Unauthenticated admin API | 401 Unauthorized |
| E2 | Expired invite code | Clear error on candidate page |
| E3 | LIVE session re-open from invite | 409 — cannot reopen from link |
| E4 | Wrong master credentials | Login rejected |
| E5 | Session cookie (if enabled) | Interview APIs reject wrong browser |

---

## 7. Test Data Guidelines

- Use emails like `qa-test-{timestamp}@example.com` for invites
- Do not use real candidate personal data in staging
- After testing, optional cleanup: delete test sessions from admin or master portal
- Video files stored locally: `public/interview-videos/{sessionId}.webm`

---

## 8. Bug Report Template

```
Title: [Area] Short description

Environment: local / staging / production
URL: 
Session ID (if applicable):

Steps to reproduce:
1.
2.
3.

Expected:
Actual:

Screenshots / logs:
Automated test failure (if any):
```

---

## 9. Release Checklist (Tester Sign-Off)

Before approving a release, confirm:

- [ ] `npm run test:qa` — all 5 suites PASS
- [ ] Manual: Recruiter flow (A1–A14) — spot check at minimum A1, A4, A5, A8, A11
- [ ] Manual: Candidate flow (C1–C8) — full live interview in browser
- [ ] Manual: Master admin (M1–M4) — login + analytics page
- [ ] Video recording verified on at least 1 real browser interview
- [ ] AI scorecard verified (holistic + per-question) with OPENAI_API_KEY set
- [ ] No P0/P1 bugs open for this release
- [ ] Staging env vars confirmed (DB, OpenAI, email, video storage)

**Tester name:** _______________  
**Date:** _______________  
**Build / commit:** _______________  
**Result:** PASS / FAIL  

---

## 10. Related Documents

| Document | Purpose |
|----------|---------|
| `docs/USER-JOURNEY-DD.md` | User journey design (recruiter + candidate) |
| `docs/QA-Step-by-Step-Test-Guide.md` | Detailed step-by-step manual guide (legacy, still valid) |
| `docs/Uhired-SRS.md` | Full software requirements specification |

---

## 11. Quick Reference — Routes

| Page | URL |
|------|-----|
| Homepage | `/` |
| Company login | `/company-login` |
| Admin portal | `/admin` |
| Master login | `/master-login` |
| Master dashboard | `/master/dashboard` |
| Master interview analytics | `/master/interview-analytics` |
| Candidate entry | `/candidate?code=...` |
| Interview room | `/interview/{sessionId}` |
| Public scorecard | `/share/scorecard/{token}` |
| Practice | `/practice` |
