# Uhired — User Guide

**Platform:** [uhired.in](https://uhired.in)  
**Who this guide is for:** Recruiters, candidates, company admins, and platform operators who need a simple overview of how Uhired works.

---

## Quick Links

| Who are you? | What do you need? | Link |
|--------------|-------------------|------|
| **Company / Recruiter** | Sign in | [/company-login](https://uhired.in/company-login) |
| **Company / Recruiter** | Create a new account | [/company-register](https://uhired.in/company-register) |
| **Job Candidate** | Join an interview | Invite link from email, or [/candidate](https://uhired.in/candidate) |
| **Practice User** | Start a mock interview | [/practice](https://uhired.in/practice) |
| **Platform Admin** | Master login | [/master-login](https://uhired.in/master-login) |
| **Anyone** | Homepage | [/](https://uhired.in) |

---

## 1. Who can use the platform? (Roles)

Uhired has **4 user types**:

```
┌─────────────────────────────────────────────────────────────────┐
│  PUBLIC USER          → Homepage, Practice (no company login)   │
│  COMPANY ADMIN        → Hiring, invites, scorecards           │
│  CANDIDATE            → Invited interview participant          │
│  MASTER ADMIN         → Full platform control (Uhired team)    │
└─────────────────────────────────────────────────────────────────┘
```

### Role 1 — Public User

- **Who:** Anyone visiting the website
- **What they can do:** Browse the homepage, About/Contact pages, and start a **practice interview** (paid mock interview)
- **Login:** Not required
- **Register:** Not required (practice only needs name + email + payment)

---

### Role 2 — Company Admin / Recruiter

- **Who:** HR, recruiter, or hiring manager at a company
- **What they can do:**
  - Create a job or role (Interview Requirement)
  - Send email invites to candidates
  - Review AI interview results (scorecard, video, transcript)
  - Manage the dashboard, candidates list, and requirements
- **Login page:** `/company-login`
- **Dashboard:** `/admin` after login

---

### Role 3 — Candidate

- **Who:** The person invited by a company to take an interview
- **What they can do:** Join from the invite link, speak with the AI interviewer, and complete the interview
- **Login account:** **None** — no password required
- **Register:** **No separate registration** — only invite code + name + email
- **Entry page:** `/candidate?code=XXXX` from the email link

---

### Role 4 — Master Admin

- **Who:** Uhired's internal platform team
- **What they can do:** Manage all companies, analytics, promo codes, and system settings
- **Login page:** `/master-login`
- **Dashboard:** `/master/dashboard`
- **Register:** No public registration — sign in only with existing master credentials

---

## 2. How do you register?

| Role | Can register? | How? |
|------|---------------|------|
| **Company Admin** | Yes | Fill out the form on `/company-register` |
| **Candidate** | No | A company sends you an invite |
| **Practice User** | No separate account | Start directly on `/practice` |
| **Master Admin** | No public registration | Set up by the Uhired team |

---

### Company Registration (Step by step)

1. Open **https://uhired.in/company-register**
2. Fill out the form:

| Field | Example | Note |
|-------|---------|------|
| Company Name | `Acme Corp` | Must be unique |
| Company Domain | `acme.com` | Your company domain |
| Admin Email | `hr@acme.com` | Used for login |
| Passcode | `YourSecurePass123` | Works like your password |
| Confirm Passcode | Same as above | Enter it again |

3. Click **Register**
4. After success, you are automatically taken to the **Admin Dashboard** (`/admin`)
5. Next time, sign in through **Company Login**

**Important:**
- A company name/domain can only be registered once
- Forgot your passcode? Use `/company-login/forgot-passcode`

---

### Candidate — No registration, join by invite

Candidates do **not** register themselves. The flow is:

1. The recruiter sends you an **email**
2. The email contains a **"Start interview"** link
3. Open the link to see the role/company
4. Enter your **name** and the **same email** used in the invite
5. Click **Start My Interview** to open the interview room

**If the email did not arrive:** Ask the recruiter for the **invite code**, then go to:  
`https://uhired.in/candidate` and paste the code.

---

### Practice User — No registration

1. Go to **https://uhired.in/practice**
2. Enter your name, email, and choose a role/topic
3. Complete payment through Razorpay
4. The interview starts immediately — **no company account required**

---

## 3. How do you sign in?

### A) Company Admin Login

**URL:** `https://uhired.in/company-login`

| Field | What to enter |
|-------|---------------|
| Company Name | The name used during registration |
| Company Domain | e.g. `acme.com` |
| Company Email | Admin email |
| Passcode | Your passcode |

→ **Continue to Admin Portal** → `/admin` dashboard

**First time?** Use [Register here](https://uhired.in/company-register)

---

### B) Master Admin Login

**URL:** `https://uhired.in/master-login`

| Field | What to enter |
|-------|---------------|
| Admin Email | Master admin email provided by the Uhired team |
| Passcode | Master passcode |

→ Dashboard: `/master/dashboard`

**Note:** This login is only for platform operators. Regular companies cannot use it.

---

### C) Candidate — No login, use invite code

**URL:** `https://uhired.in/candidate`  
ya email link: `https://uhired.in/candidate?code=YOUR_CODE`

| Field | What to enter |
|-------|---------------|
| Interview Code | From the email (may auto-fill) |
| Full Name | Your full name |
| Email | **The same email** that received the invite |

→ **Start My Interview**

**No password required.**

---

### D) Practice — No login

**URL:** `https://uhired.in/practice`  
Just complete the form and payment to start the interview.

---

## 4. What do you do after login?

### Recruiter (Company Admin) — `/admin`

| Section | What to do |
|---------|------------|
| **Dashboard** | View overall interview stats and activity |
| **Overview** | Create a new job and send candidate invites |
| **Interview Sessions** | Review interviews, videos, and scorecards |
| **Candidates** | View the candidate list |
| **Requirements** | Manage previously created jobs/roles |
| **Settings** | Update AI interviewer voice and branding |

**Typical flow:**
```
Login → Overview → Fill in job details → Save Requirement
      → Add candidate emails → Send Invites
      → Review results in Interview Sessions
```

---

### Candidate — Interview flow

```
Open invite link → Enter name + email → Start Interview
→ Allow camera/mic → Accept consent
→ Speak with the AI → End interview → Return to homepage
```

**Tips:**
- Use Chrome or Edge
- Keep camera and microphone enabled
- Use the same email that received the invite
- Once completed, the same invite cannot be reused

---

### Master Admin — `/master`

| Page | What to do |
|------|------------|
| Dashboard | Platform stats |
| Company Management | Create and edit companies |
| Company Interviews | View interviews across all companies |
| Interview Analytics | Review requirement and interview analytics |
| Promo Codes | Practice discounts |

---

## 5. Who goes where? Simple diagram

```mermaid
flowchart TD
    A[Homepage uhired.in] --> B{Who are you?}
    B -->|Company HR / Recruiter| C[company-login]
    B -->|New company| D[company-register]
    B -->|Received interview invite| E[candidate?code=...]
    B -->|Practice interview| F[practice]
    B -->|Uhired team| G[master-login]

    C --> H[/admin Dashboard]
    D --> H
    E --> I[/interview Live AI Room]
    F --> I
    G --> J[/master Platform Control]
```

---

## 6. Common Problems & Solutions

| Problem | Solution |
|---------|----------|
| Company login fails | Check company name, domain, email, and passcode — they must match the registered details |
| Candidate code is invalid | The code may have expired (24h) — ask the recruiter for a new invite |
| Email mismatch | The candidate must enter **the exact same email** used for the invite |
| Invite email not received | Copy the invite code from the admin portal and enter it manually on `/candidate` |
| Camera/mic not working | Allow browser permissions and use Chrome |
| Interview cannot be reopened | It is already completed — one invite equals one interview |
| Forgot company passcode | Use `/company-login/forgot-passcode` or contact support |

---

## 7. Demo Credentials (Testing / Local)

If you are working in local development or a demo environment:

| Role | Login URL | Credentials |
|------|-----------|-------------|
| Company Admin | `/company-login` | Name: `Uhired`, Domain: `uhired.com`, Email: `admin@uhired.com`, Passcode: `admin123` |
| Master Admin | `/master-login` | `.env` file se `MASTER_ADMIN_EMAIL` / `MASTER_ADMIN_PASSWORD` |
| Candidate | `/candidate` | Any valid invite code |

**Do not use demo credentials in production.**

---

## 8. Support

- **Contact:** [uhired.in/contact](https://uhired.in/contact)
- **Technical / QA guide (team):** `docs/QA-TESTER-HANDBOOK.md`
- **Developer README:** `README.md`

---

## 9. One-Page Cheat Sheet

```
RECRUITER     → company-login    → admin portal   → invite candidates → review results
CANDIDATE     → email link       → candidate page → interview room    → done
NEW COMPANY   → company-register → auto login     → admin
PRACTICE      → practice page  → pay → interview (no account)
MASTER ADMIN  → master-login   → manage platform
PUBLIC        → homepage       → no login needed
```

---

*Last updated: August 2026*
