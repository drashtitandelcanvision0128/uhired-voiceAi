# Uhired — Step-by-Step Test Guide

Manual QA guide for testing login, company setup, invites, and interviews.

**Last updated:** 20 July 2026  
**Base URL (local):** `http://localhost:3000`  
**Base URL (production):** use your deployed app URL instead.

---

## Today's Updates — 20 July 2026

- Timer starts only when the interview is live (not while connecting).
- Saved duration uses real interview time (not inflated by upload).
- Interview room: better intro, silence, turn-taking, and audio cutoff.
- AI prompt and complete-API duration fixes.
- Added interview test scripts (timer, duration, intro, audio, transcript).

**Quick checks:** timer idle before start → counts down when live → ends cleanly → admin duration looks correct.

---

## Before You Start

1. App is running (`npm run dev` or deployed URL is up).
2. Database is migrated.
3. Optional local demo company (recommended for quick testing):

```bash
npm run db:seed:dev-admin
```

**Demo company login (after seed):**

| Field | Value |
|--------|--------|
| Company name | `Uhired` |
| Company domain | `uhired.com` |
| Company email | `admin@uhired.com` |
| Passcode | `admin123` |

4. Allow **camera** and **microphone** in the browser for live interviews.
5. For invite emails: SMTP must be configured in `.env`. If email is not working, copy the invite **code** from the Admin portal after sending invites.

---

## Roles Overview

| Role | Who | Login page |
|------|-----|------------|
| Master Admin | Platform owner | `/master-login` |
| Company Admin | Recruiter / hiring team | `/company-login` |
| Invited Candidate | Job applicant (no account) | `/candidate` |
| Practice Candidate | Public practice user (no account) | `/practice` |

There is **no public company signup**. Companies are created by Master Admin.

---

## Part 1 — Master Admin Login

### Steps

1. Open: `http://localhost:3000/master-login`
2. Enter the **Master Admin Key** (from `.env` → `MASTER_ADMIN_KEY`).
3. Click **Sign In**.
4. You should land on **Global Overview** (`/master/overview`).

### What to check

- [ ] Login succeeds with the correct key.
- [ ] Wrong key is rejected with a **visible red error**: `Invalid Master Admin key.` (stays on login page; no redirect).
- [ ] Sidebar navigation works (Overview, Companies, Promo Codes, Practice Sessions).
- [ ] **Logout** works.

**Automated check (optional):** `node scripts/test-login-failure.mjs` (with dev server on `LOGIN_TEST_BASE_URL`, default `http://localhost:3001`).

---

## Part 2 — Create a Company (Master Admin)

### Steps

1. After Master login, go to **Company Management** (`/master/companies`).
2. Fill in:
   - Company name
   - Domain (example: `acme.com`)
   - Admin email
   - Admin passcode
   - AI interviewer name
   - Voice: Male / Female
3. Click **Create Company**.
4. Save the company credentials (name, domain, email, passcode) for the next part.
5. Optional: open **Promo Codes** (`/master/promo-codes`) and create a promo code for practice interviews.

### What to check

- [ ] Company is created successfully.
- [ ] Company can be updated later.
- [ ] Passcode can be regenerated if needed.
- [ ] Promo code can be created for practice testing.

---

## Part 3 — Company Admin Login

### Steps

1. Open: `http://localhost:3000/company-login`  
   (Or from the public header: **Company Login**)
2. Enter:
   - Company name
   - Company domain name
   - Company email
   - Passcode
3. Click **Continue to Admin Portal**.
4. You should land on the Admin dashboard (`/admin`).

### Demo credentials (if you ran the seed)

- Company name: `Uhired`
- Domain: `uhired.com`
- Email: `admin@uhired.com`
- Passcode: `admin123`

### What to check

- [ ] Correct credentials open `/admin`.
- [ ] Wrong passcode / wrong domain is rejected with a **visible red error banner**: `Invalid company credentials.` (stays on login page; no redirect).
- [ ] Empty fields show client-side error: `All fields are required.` (before API call).
- [ ] Sidebar shows: Overview, Interview Sessions, Candidates, Requirements, etc.
- [ ] **Logout** works.

**Manual wrong-password check:** enter valid company name, domain, and email from seed data, but use passcode `wrong-password` → expect the red banner above the submit button, not a silent failure.

---

## Part 4 — Create Interview Requirement & Invite Candidates

Company interviews are **not calendar bookings**. Flow = create requirement → send invite emails with access codes.

### Steps

1. Log in as Company Admin (`/company-login` → `/admin`).
2. Go to **Invite Candidates** / **Requirements** (or use **Invite Candidates** in the sidebar).
3. Fill **Interview Requirements**:
   - Job description *
   - Target role *
   - Key skills *
   - Duration (minutes)
   - Mandatory / optional questions (if available)
4. Add candidate emails:
   - Manual entry, and/or
   - Excel upload
5. Click **Send Interview Invites**.
6. Note the result:
   - Sent / Incorrect / Failed
   - Per-email **Code** (important if email does not arrive)
7. Candidate receives email (subject like `{Company} — your interview invitation`) with button **Start interview**.

### What to check

- [ ] Requirement form validates required fields.
- [ ] Invites send successfully (or codes appear in admin UI).
- [ ] Invite code is shown for each email.
- [ ] Codes expire after **24 hours** and are **single-use** (test separately if needed).

---

## Part 5 — Candidate Login / Join Interview (Invited)

Candidates do **not** have a password account. They join with invite code + name + email.

### Steps

1. Open the invite link from email, **or** go to:  
   `http://localhost:3000/candidate`  
   (Link may look like `/candidate?code=YOURCODE`)
2. Enter:
   - Interview session code
   - Full name
   - Email (**must match the invite email**)
3. Click **Start My Interview**.
4. You are redirected to the interview room: `/interview/{sessionId}`

### What to check

- [ ] Matching email + valid code starts the interview.
- [ ] Wrong email is rejected.
- [ ] Invalid / expired / used code is rejected.
- [ ] Pre-filled code from `?code=` works.

---

## Part 6 — Complete the Live Interview

### Steps

1. In the interview room (`/interview/{sessionId}`):
2. Click **Check camera & mic**.
3. Turn **Camera** and **Mic** on (allow browser permissions).
4. Click **Start voice interview**.
5. Speak with the AI interviewer.
6. Watch the countdown timer / progress (`Progress X of Y`).
7. End the interview by:
   - Waiting for time to expire, **or**
   - Clicking **End Interview**
8. Wait for **Saving your interview…**
9. See **Thank you** screen → click **Close**.

### What to check

- [ ] Camera / mic permission prompt appears.
- [ ] Voice interview connects (status like “Connecting to voice interviewer…”).
- [ ] Timer does **not** count down during connecting; starts when interview is live.
- [ ] Timer counts down for the allocated duration.
- [ ] Company sessions may show **REC** when recording.
- [ ] Ending interview saves and shows Thank you.
- [ ] Saved duration on admin/results matches interview clock (not inflated by upload time).
- [ ] Close returns to `/candidate` (invited) or home (practice).

---

## Part 7 — Company Admin Reviews Results

### Steps

1. Log in again as Company Admin (`/admin`).
2. Open **Interview Sessions**.
3. Find the completed session (status should be completed).
4. Open the session and review:
   - Scorecard
   - Transcript
   - Video status (if recording enabled)
5. Optional actions:
   - **Create share link** → open public scorecard URL `/share/scorecard/[token]`
   - **Generate answer review**
   - **Re-run answer grading**
   - Download PDF (if available)

### What to check

- [ ] Completed interview appears in the list.
- [ ] Scorecard / transcript load.
- [ ] Share link opens without admin login.
- [ ] Answer review / regrade actions work (if OpenAI is configured).

---

## Part 8 — Practice Interview (Public Candidate)

Use this for public practice flow (no company invite).

### Steps

1. Open: `http://localhost:3000/practice`  
   (Or from landing page: **Get Started** / **Start Your Session**)
2. Choose:
   - Focus area (or custom)
   - Duration
   - Name
   - Email
3. Either:
   - Enter a **promo code** (created by Master Admin), **or**
   - Click **Pay & Start Session** (Razorpay test payment)
4. You are redirected to `/interview/{sessionId}`.
5. Complete the interview the same way as Part 6.
6. After **Close**, you return to home `/`.

### What to check

- [ ] Promo code starts a session without payment.
- [ ] Invalid promo code is rejected.
- [ ] Paid path opens Razorpay (when keys are set).
- [ ] Interview room works the same as company interviews.
- [ ] Session appears under Master → **Practice Sessions**.

---

## Suggested Full Happy-Path Test Order

Run these in order for a full end-to-end check:

1. **Master login** → create company (or use seed demo company).
2. **Company login** → create requirement → invite a test email → copy the code.
3. **Candidate join** with matching email + code → complete interview.
4. **Admin review** → confirm COMPLETED + scorecard → create share link → open it.
5. **Master** → create promo code → **Practice** flow → complete practice interview.
6. Confirm practice session in Master → **Practice Sessions**.

---

## Quick URL Cheat Sheet

| Page | URL |
|------|-----|
| Home | `/` |
| Practice | `/practice` |
| Candidate entry | `/candidate` |
| Interview room | `/interview/[sessionId]` |
| Company login | `/company-login` |
| Company admin | `/admin` |
| Master login | `/master-login` |
| Master overview | `/master/overview` |
| Master companies | `/master/companies` |
| Master promo codes | `/master/promo-codes` |
| Shared scorecard | `/share/scorecard/[token]` |

---

## Common Test Buttons / Labels

| Screen | Labels |
|--------|--------|
| Company login | **Continue to Admin Portal** |
| Master login | **Sign In** |
| Candidate entry | **Start My Interview** |
| Interview room | **Check camera & mic**, **Start voice interview**, **End Interview**, **Close** |
| Admin invites | **Send Interview Invites**, **Invite Candidates** |
| Admin results | **Create share link**, **Generate answer review**, **Re-run answer grading** |
| Practice | **Pay & Start Session** |
| Invite email | **Start interview** |

---

## Notes for Testers

- Invite codes: **24-hour expiry**, mostly **single-use**.
- Candidate email must **exactly match** the invited email.
- Live AI voice needs `OPENAI_API_KEY`.
- Video recording needs storage configured (`VIDEO_STORAGE_PROVIDER`).
- If SMTP fails, still test using the **code shown in Admin** after invite send.
- Prefer `/practice` for real practice checkout (landing page booking UI may be marketing-only).

---

*Document purpose: manual QA / UAT. For full product requirements, see `docs/Uhired-SRS.md`.*  
*Last updated: 20 July 2026 — interview timer, duration accuracy, and live room behaviour.*
