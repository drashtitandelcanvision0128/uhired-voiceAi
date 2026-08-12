# Uhired — User Guide (आसान गाइड)

**Platform:** [uhired.in](https://uhired.in)  
**यह गाइड किसके लिए है:** Recruiters, candidates, company admins, aur platform operators — sabke liye simple steps.

---

## Quick Links

| Aap kaun ho? | Kya karna hai | Link |
|--------------|---------------|------|
| **Company / Recruiter** | Login karo | [/company-login](https://uhired.in/company-login) |
| **Company / Recruiter** | Naya account banao | [/company-register](https://uhired.in/company-register) |
| **Job Candidate** | Interview join karo | Email se invite link, ya [/candidate](https://uhired.in/candidate) |
| **Practice user** | Mock interview lo | [/practice](https://uhired.in/practice) |
| **Platform Admin** | Master login | [/master-login](https://uhired.in/master-login) |
| **Koi bhi** | Homepage | [/](https://uhired.in) |

---

## 1. Platform par kaun-kaun use kar sakta hai? (Roles)

Uhired par **4 tarah ke users** hain:

```
┌─────────────────────────────────────────────────────────────────┐
│  PUBLIC USER          → Homepage, Practice (bina company login) │
│  COMPANY ADMIN        → Hiring, invites, scorecards           │
│  CANDIDATE            → Interview dene wala (invite se)         │
│  MASTER ADMIN         → Poora platform manage (Uhired team)     │
└─────────────────────────────────────────────────────────────────┘
```

### Role 1 — Public User (Koi bhi visitor)

- **Kaun:** Koi bhi jo website visit kare
- **Kya kar sakta hai:** Homepage dekho, About/Contact, **Practice interview** (paid mock interview)
- **Login:** Zaroori nahi
- **Register:** Zaroori nahi (practice ke liye sirf naam + email + payment)

---

### Role 2 — Company Admin / Recruiter (Hiring team)

- **Kaun:** Company ka HR, recruiter, hiring manager
- **Kya kar sakta hai:**
  - Job / role create karna (Interview Requirement)
  - Candidates ko email invite bhejna
  - AI interviews ka result dekhna (scorecard, video, transcript)
  - Dashboard, candidates list, requirements manage
- **Login page:** `/company-login`
- **Dashboard:** `/admin` (login ke baad)

---

### Role 3 — Candidate (Interview dene wala)

- **Kaun:** Wo person jisko company ne interview invite bheja
- **Kya kar sakta hai:** Invite link se interview join karna, AI se baat karna, interview complete karna
- **Login account:** **Nahi hota** — password ki zaroorat nahi
- **Register:** **Nahi hota** — sirf invite code + naam + email
- **Entry page:** `/candidate?code=XXXX` (email mein link aata hai)

---

### Role 4 — Master Admin (Platform operator)

- **Kaun:** Uhired platform ki internal team
- **Kya kar sakta hai:** Saari companies manage, analytics, promo codes, system settings
- **Login page:** `/master-login`
- **Dashboard:** `/master/dashboard`
- **Register:** Public register **nahi** — sirf existing master credentials se login

---

## 2. Register kaise karein?

| Role | Register ho sakta hai? | Kaise? |
|------|------------------------|--------|
| **Company Admin** | Haan | `/company-register` par form bharo |
| **Candidate** | Nahi | Company aapko invite bhejegi |
| **Practice user** | Nahi (account nahi) | `/practice` par direct start |
| **Master Admin** | Nahi (public) | Uhired team setup karti hai |

---

### Company Register (Step-by-step)

1. Open karo: **https://uhired.in/company-register**
2. Form bharo:

| Field | Example | Note |
|-------|---------|------|
| Company Name | `Acme Corp` | Unique hona chahiye |
| Company Domain | `acme.com` | Apni company ka domain |
| Admin Email | `hr@acme.com` | Login ke liye use hoga |
| Passcode | `YourSecurePass123` | Ye aapka password jaisa hai |
| Confirm Passcode | Same as above | Dobara likho |

3. **Register** button dabao
4. Success ke baad automatically **Admin Dashboard** (`/admin`) par chale jaoge
5. Agli baar **Company Login** se login karna

**Important:**
- Ek company name / domain sirf ek baar register ho sakta hai
- Passcode bhool gaye? → `/company-login/forgot-passcode` (support contact)

---

### Candidate — Register nahi, Invite se aao

Candidates ko **khud register nahi karna**. Flow:

1. Recruiter aapko **email** bhejega
2. Email mein **"Start interview"** link hoga
3. Link kholo → role/company dikhega
4. Apna **naam** aur **wahi email** likho jo invite par tha
5. **Start My Interview** → interview room khulega

**Agar email nahi aaya:** Recruiter se **invite code** maango, phir manually jao:  
`https://uhired.in/candidate` aur code paste karo.

---

### Practice User — Bina register

1. Jao: **https://uhired.in/practice**
2. Apna naam, email, role/topic choose karo
3. Payment karo (Razorpay)
4. Interview start ho jayega — **koi company account nahi chahiye**

---

## 3. Login kaise karein?

### A) Company Admin Login (Recruiter)

**URL:** `https://uhired.in/company-login`

| Field | Kya likhna hai |
|-------|----------------|
| Company Name | Register karte waqt jo name diya tha |
| Company Domain | e.g. `acme.com` |
| Company Email | Admin email |
| Passcode | Apna passcode |

→ **Continue to Admin Portal** → `/admin` dashboard

**Pehli baar?** → [Register here](https://uhired.in/company-register) link use karo

---

### B) Master Admin Login

**URL:** `https://uhired.in/master-login`

| Field | Kya likhna hai |
|-------|----------------|
| Admin Email | Master admin email (Uhired team se milta hai) |
| Passcode | Master passcode |

→ Dashboard: `/master/dashboard`

**Note:** Ye login sirf platform operators ke liye hai. Normal companies isse login **nahi** kar sakti.

---

### C) Candidate — Login nahi, Invite Code

**URL:** `https://uhired.in/candidate`  
ya email link: `https://uhired.in/candidate?code=YOUR_CODE`

| Field | Kya likhna hai |
|-------|----------------|
| Interview Code | Email se (auto-fill ho sakta hai) |
| Full Name | Apna poora naam |
| Email | **Wahi email** jis par invite aaya |

→ **Start My Interview**

**Password nahi chahiye.**

---

### D) Practice — Login nahi

**URL:** `https://uhired.in/practice`  
Direct form + payment → interview start.

---

## 4. Login ke baad kya karna hai?

### Recruiter (Company Admin) — `/admin`

| Section | Kya karein |
|---------|------------|
| **Dashboard** | Overview — sessions, stats |
| **Overview** | Naya job create karo, candidates invite bhejo |
| **Interview Sessions** | Sab interviews dekho, video/scorecard kholo |
| **Candidates** | Candidate-wise list |
| **Requirements** | Pehle banaye jobs / roles |
| **Settings** | AI interviewer voice, branding |

**Typical flow:**
```
Login → Overview → Job details bharo → Save Requirement
      → Candidate emails add karo → Send Invites
      → Interview Sessions mein results dekho
```

---

### Candidate — Interview flow

```
Invite link kholo → Naam + email → Start Interview
→ Camera/Mic allow karo → Consent accept karo
→ AI se baat karo → End Interview → Homepage
```

**Tips:**
- Chrome/Edge browser use karo
- Camera aur microphone on rakho
- Same email use karo jo invite par tha
- Interview ek baar complete hone ke baad dubara nahi khul sakta (same invite se)

---

### Master Admin — `/master`

| Page | Kya karein |
|------|------------|
| Dashboard | Platform stats |
| Company Management | Nayi company banao, edit karo |
| Company Interviews | Sab companies ke interviews |
| Interview Analytics | Requirements + sessions analytics |
| Promo Codes | Practice discounts |

---

## 5. Kaun kahan jaaye — Simple diagram

```mermaid
flowchart TD
    A[Homepage uhired.in] --> B{Main kaun ho?}
    B -->|Company HR / Recruiter| C[company-login]
    B -->|Nayi company| D[company-register]
    B -->|Interview invite mila| E[candidate?code=...]
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
| Company login fail | Company name, domain, email, passcode check karo — sab register wale se match hona chahiye |
| Candidate code invalid | Code expire ho sakta hai (24h) — recruiter se naya invite maango |
| Email mismatch | Candidate email **bilkul wahi** likho jo invite par tha |
| Invite email nahi aaya | Admin portal se invite code copy karo, manually `/candidate` par daalo |
| Camera/mic nahi chal raha | Browser permission allow karo, Chrome use karo |
| Interview dubara nahi khul raha | Already complete — ek invite = ek interview |
| Forgot company passcode | `/company-login/forgot-passcode` ya support contact |

---

## 7. Demo Credentials (Testing / Local)

Agar local development ya demo environment par ho:

| Role | Login URL | Credentials |
|------|-----------|-------------|
| Company Admin | `/company-login` | Name: `Uhired`, Domain: `uhired.com`, Email: `admin@uhired.com`, Passcode: `admin123` |
| Master Admin | `/master-login` | `.env` file se `MASTER_ADMIN_EMAIL` / `MASTER_ADMIN_PASSWORD` |
| Candidate | `/candidate` | Koi bhi valid invite code (admin se bhejwao) |

**Production par demo credentials use mat karo.**

---

## 8. Support

- **Contact:** [uhired.in/contact](https://uhired.in/contact)
- **Technical / QA guide (team):** `docs/QA-TESTER-HANDBOOK.md`
- **Developer README:** `README.md`

---

## 9. One-Page Cheat Sheet

```
RECRUITER     → company-login  → admin portal → invite candidates → dekho results
CANDIDATE     → email link     → candidate page → interview room → done
NEW COMPANY   → company-register → auto login → admin
PRACTICE      → practice page  → pay → interview (no account)
MASTER ADMIN  → master-login   → platform manage
PUBLIC        → homepage       → no login needed
```

---

*Last updated: August 2026*
