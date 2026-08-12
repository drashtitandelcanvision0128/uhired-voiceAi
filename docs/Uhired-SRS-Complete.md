# Uhired (Shortlist) — Software Requirements Specification (SRS)

**Document Version:** 2.0 
**Date:** August 3, 2026 
**Product:** Uhired — AI Interview Practice & Hiring Platform 
**Live URL:** https://uhired.in 
**Timeline:** 1 Month (30 Calendar Days / 4 Weeks) 
**Prepared For:** Development Team, QA, Stakeholders, Clients 
**Status:** Approved for Implementation Reference


## Table of Contents

1. Introduction
2. Product Overview
3. Stakeholders & User Roles
4. System Architecture
5. UI/UX Design Specification
6. Database Design
7. Backend Architecture
8. API Specification
9. Frontend Pages & Components
10. Functional Requirements
11. Non-Functional Requirements
12. External Integrations
13. Security Requirements
14. 1-Month Delivery Timeline
15. Testing & QA Plan
16. Deployment & DevOps
17. Acceptance Criteria
18. Risk Register
19. Appendix

[PAGE_BREAK]

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the **complete technical and functional requirements** for the **Uhired** platform — an AI-powered interview practice and hiring workflow system. This document covers every layer of the application:

- **Database** — PostgreSQL schema, models, relationships, indexes
- **Backend** — Next.js API routes, business logic, integrations
- **API** — All 48+ REST endpoints with auth, request/response formats
- **Frontend/UI** — All pages, components, design system, user flows
- **Design** — Colors, typography, layout rules, responsive behavior
- **Timeline** — 30-day delivery plan with weekly and daily milestones

### 1.2 Scope

| In Scope | Out of Scope (Phase 2+) |
|----------|-------------------------|
| Practice interview flow (B2C) | Native mobile apps (iOS/Android) |
| Company hiring workflow (B2B) | ATS integrations (Greenhouse, Lever) |
| Live AI interview room | Multi-language interviews |
| Automated scoring & scorecards | Advanced RBAC (multiple recruiter roles) |
| Admin & Master admin portals | White-label branding per company |
| Razorpay payments | SOC2/ISO certification |
| Email invites & scorecard sharing | Candidate self-service history portal |
| Marketing website | Blog, careers, pricing pages |
| Video recording (company sessions) | Real-time human interviewer collaboration |

### 1.3 Definitions

| Term | Definition |
|------|------------|
| Practice Interview | Self-service paid AI interview purchased by individual candidate |
| Company Interview | Structured interview created by recruiter for specific role/candidate |
| Requirement | Job role configuration with domain, questions, duration, JD |
| Scorecard | AI-generated evaluation report after interview completion |
| Access Code | Unique code for candidate to join assigned interview |
| Master Admin | Platform super-admin managing all companies |
| Realtime API | OpenAI voice conversation engine for live interviews |
| VAD | Smart silence detection during interview |

### 1.4 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.x |
| Language | TypeScript | 5.x |
| UI Library | React | 19.x |
| Styling | Tailwind CSS | 4.x |
| UI Components | Radix UI, Lucide Icons, Framer Motion | Latest |
| Database | PostgreSQL (Supabase hosted) | 15+ |
| ORM | Prisma | 6.x |
| AI Engine | OpenAI Realtime API + GPT-4.1-mini | Latest |
| Payments | Razorpay | 2.x |
| Email | Nodemailer (SMTP) / AWS SES | — |
| Video Storage | AWS S3 / Local (dev) | — |
| PDF | pdf-lib | 1.x |
| Validation | Zod | 4.x |
| Face Detection | MediaPipe (client-side) | 0.10.x |
| Deployment | Docker / Coolify / Vercel | — |

[PAGE_BREAK]

## 2. Product Overview

### 2.1 Vision Statement

**Uhired** enables candidates to practice realistic AI-led interviews and enables companies to conduct structured, AI-powered interview workflows with automated scoring, recruiter dashboards, and shareable evaluation reports.


### 2.2 Business Objectives

1. Reduce manual screening effort for hiring companies by **60%+**
2. Provide measurable, consistent interview feedback at scale
3. Generate revenue through practice session purchases (₹25–₹50 per 10-min block)
4. Deliver production-ready MVP within **30 days**
5. Support multi-tenant B2B company architecture

### 2.3 Key Differentiators

- Real-time AI interviewer with natural **voice conversation** (OpenAI Realtime)
- Automated **scorecard** with dimension-level scoring (communication, domain depth, confidence)
- Company-branded interview workflows with **custom question banks**
- **Shareable, expiring** scorecard links with PDF export
- Built-in **Razorpay** payment flow for self-service practice
- **Face detection** and video compliance during company interviews
- **Semantic grading** — meaning-based evaluation, not keyword matching

### 2.4 User Journey Overview

```
PRACTICE FLOW (B2C):
 Home → /practice → Select domain/topic → Enter name/email →
 Pay (Razorpay) OR Promo code → Interview Room → Scorecard

COMPANY FLOW (B2B):
 Company Login → Admin Dashboard → Create Requirement →
 Invite Candidates (email) → Candidate verifies code →
 Interview Room → Scorecard → Admin reviews → Share link/PDF

MASTER ADMIN:
 Master Login → Overview → Manage Companies → Promo Codes →
 Monitor Practice Sessions
```

[PAGE_BREAK]

## 3. Stakeholders & User Roles

### 3.1 Primary Actors

| Actor | Description | Login Route | Auth Method |
|-------|-------|-------------|-------------|-------------|
| Practice Candidate | Purchases/redeems practice session | /practice | No login — session cookie after payment |
| Company Admin | Creates requirements, invites, reviews | /company-login → /admin | Email + Passcode (cookie session) |
| Invited Candidate | Joins company interview via invite | /candidate | Access code + email verification |
| Master Admin | Platform-wide management | /master-login → /master | Master admin key (cookie session) |
| Public Visitor | Marketing pages, shared scorecards | /, /about, /contact | None |

### 3.2 System Actors

| System | Role | Criticality |
|--------|------|-------------|
| OpenAI Realtime API | Live voice interview conversation | Critical |
| OpenAI GPT-4.1-mini | Scoring, question generation, grading | Critical |
| Razorpay | Practice session payments (INR) | Critical (revenue) |
| PostgreSQL (Supabase) | Primary data store | Critical |
| SMTP / AWS SES | Candidate invite & contact emails | High |
| AWS S3 | Interview video storage (production) | High |
| MediaPipe | Client-side face detection | Medium |

[PAGE_BREAK]

## 4. System Architecture

### 4.1 High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│ CLIENT (Browser) │
│ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌────────────┐ │
│ │Marketing│ │ Practice│ │Candidate │ │ Interview │ │Admin/Master│ │
│ │ Pages │ │ Flow │ │ Verify │ │ Room │ │ Dashboard │ │
│ └────┬────┘ └────┬────┘ └────┬─────┘ └─────┬─────┘ └─────┬──────┘ │
│ │ │ │ │ │ │
│ └───────────┴───────────┴─────────────┴──────────────┘ │
│ HTTPS / WebSocket │
└──────────────────────────────┬───────────────────────────────────────┘
 │
┌──────────────────────────────▼───────────────────────────────────────┐
│ NEXT.JS 16 APPLICATION SERVER │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ App Router Pages (SSR/CSR) │ API Routes (48+ endpoints) │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ Middleware (company admin route protection) │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ lib/ — Business Logic (85+ modules) │ │
│ │ auth/ │ interview/ │ scoring/ │ integrations/ │ scorecard/ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└──────────┬──────────┬──────────┬──────────┬────────────────────────┘
 │ │ │ │
 ┌──────▼──┐ ┌─────▼────┐ ┌──▼───┐ ┌───▼────┐
 │ OpenAI │ │ Razorpay │ │ SMTP │ │ AWS S3 │
 │Realtime │ │ Payments │ │ Email│ │ Video │
 └─────────┘ └──────────┘ └──────┘ └────────┘
 │
┌──────────▼───────────────────────────────────────────────────────────┐
│ POSTGRESQL DATABASE (Prisma ORM — 13 Models) │
│ Company │ Requirement │ Candidate │ InterviewSession │ Scorecard │
│ InterviewTurn │ PracticePayment │ PromoCode │ ScoringBatchJob │ ... │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 Project Folder Structure

```
Shortlist/
├── prisma/
│ ├── schema.prisma # 13 database models
│ └── migrations/ # Migration history
├── public/marketing/ # Marketing images & assets
├── scripts/ # Seeds, E2E tests, batch scoring
├── docs/ # SRS, QA guides, artifacts
├── src/
│ ├── app/
│ │ ├── page.tsx # Marketing home (/)
│ │ ├── about/ # About page
│ │ ├── contact/ # Contact form
│ │ ├── privacy/ │ terms/ # Legal pages
│ │ ├── practice/ # Practice interview + payment
│ │ ├── candidate/ # Candidate invite verification
│ │ ├── interview/[sessionId]/ # Live AI interview room
│ │ ├── admin/ # Company admin dashboard
│ │ ├── company-login/ # Company auth
│ │ ├── company-register/ # Company registration
│ │ ├── master/ # Master admin portal
│ │ ├── master-login/ # Master auth
│ │ ├── sessions/ # Session management
│ │ ├── profile/ # Company profile
│ │ ├── share/scorecard/[token]/# Public scorecard
│ │ └── api/ # 48+ API route handlers
│ ├── components/
│ │ ├── marketing/ # Header, footer, hero, contact form
│ │ ├── ui/ # Button, input, card, textarea
│ │ ├── admin-dashboard.tsx
│ │ ├── company-interview-room.tsx
│ │ └── scorecard-share-public.tsx
│ └── lib/ # 85+ utility modules
├── middleware.ts # Route protection
├── Dockerfile # Production Docker build
└── DEPLOYMENT.md # Deployment guide
```

### 4.3 Data Flow — Interview Completion

```
1. Candidate completes interview in browser
2. POST /api/interview/[sessionId]/complete
3. Server saves final transcript turns to InterviewTurn table
4. Server generates immediate heuristic scorecard → Scorecard table
5. Server creates ScoringBatchJob (PENDING) for deep AI grading
6. Background: GPT-4.1-mini grades each question → updates Scorecard
7. Admin views scorecard in dashboard
8. Admin generates ScorecardShareLink → public URL with token
9. Recipient views scorecard + downloads PDF via /api/share/scorecard/[token]/pdf
```

[PAGE_BREAK]

## 5. UI/UX Design Specification

### 5.1 Design Philosophy

- **Mobile-first** responsive design
- **Professional & trustworthy** — hiring platform aesthetic
- **Minimal animations** — subtle hover/transitions only (Framer Motion for marketing)
- **Accessible** — form labels, focus states, contrast ratio ≥ 4.5:1
- **Consistent** — shared header/footer on marketing pages, unified card style

### 5.2 Color Palette

| Token | Hex Value | Usage |
|-------|-----------|-------|
| --primary | #0055D4 | Primary buttons, links, brand accent |
| --primary-container | #0055D4 | Button backgrounds, CTAs |
| --secondary | #f8f9fa | Secondary backgrounds |
| --background | #ffffff | Page background |
| --foreground | #1a1a1a | Primary text |
| --accent | #0891b2 | Highlights, rings, chart-1 |
| --surface | #ffffff | Cards, elevated surfaces |
| --muted | #e5e7eb | Disabled states, borders |
| --muted-foreground | #6b7280 | Secondary text |
| --destructive | #dc2626 | Error states, delete actions |
| --border | #e5e7eb | Card borders, dividers |
| --chart-1 to --chart-5 | Various | Dashboard charts |

**Dark mode** tokens are defined in globals.css for future support.

### 5.3 Typography

| Element | Font Family | Weight | Size |
|---------|------------|--------|------|
| Headlines | Manrope (--font-headline) | 700–800 | 2rem–3.5rem |
| Body text | Inter (--font-body) | 400–500 | 0.875rem–1rem |
| Labels | Inter | 600 | 0.75rem–0.875rem |
| Code/Mono | Consolas | 400 | 0.875rem |

### 5.4 Component Library / UI Components

| Component | File | Usage |
|-----------|------|-------|
| Button | components/ui/button.tsx | Primary, secondary, outline, ghost variants |
| Input | components/ui/input.tsx | Form fields, search |
| Textarea | components/ui/textarea.tsx | Message fields, JD input |
| Card | components/ui/card.tsx | Elevated content sections (.card CSS class) |
| Site Header | components/marketing/site-header.tsx | Sticky nav: Home, About, Contact, Login, CTA |
| Site Footer | components/marketing/site-footer.tsx | Links, social, copyright |
| Hero Section | components/marketing/hero-section.tsx | Landing page hero |
| Contact Form | components/marketing/contact-form.tsx | POST /api/contact |
| Admin Dashboard | components/admin-dashboard.tsx | Full company admin UI |
| Interview Room | components/company-interview-room.tsx | Live interview (3000+ lines) |
| Scorecard Share | components/scorecard-share-public.tsx | Public scorecard view |

### 5.5 Layout Rules

| Rule | Specification |
|------|--------------|
| Max content width | 1280px (marketing), 1440px (admin) |
| Card border radius | 0.75rem (--radius) |
| Card shadow | Subtle box-shadow on .card class |
| Sticky header | Marketing pages — fixed top navbar |
| Grid | Tailwind grid for features (2-col mobile, 4-col desktop) |
| Spacing scale | Tailwind default (4px increments) |
| CTA buttons | Gradient background, rounded-full or rounded-lg |

### 5.6 Page-by-Page UI Specification

#### 5.6.1 Marketing Home (/)

| Section | Content | Design Notes |
|---------|---------|-------------|
| Hero | Headline, subtext, "Start Practice" CTA, "For Companies" CTA | Full-width, gradient background, product screenshot |
| How It Works | 3 steps: Choose role → AI Interview → Get Scorecard | Icon cards, horizontal on desktop |
| Features | 4 cards: AI Interviewer, Real-time Feedback, Company Dashboard, Secure | Grid layout, icons from Lucide |
| Social Proof | Stats/testimonials (static v1) | Muted background section |
| Final CTA | Banner → /practice | Primary color background |
| Footer | About, Contact, Privacy, Terms, Company Login links | Dark footer |

#### 5.6.2 Practice Page (/practice)

| Element | Specification |
|---------|--------------|
| Domain selector | Dropdown: PM, Engineering, Sales, Data Science, Custom |
| Topic input | Text field for specific focus area |
| Duration slider | 10–120 minutes, price updates dynamically |
| Name & Email | Required fields before payment |
| Promo code | Optional field with validation |
| Price display | ₹X based on PRACTICE_BASE_PRICE_RUPEES env (₹25/10min default) |
| Pay button | Opens Razorpay checkout modal |
| Success | Redirect to /interview/[sessionId] |

#### 5.6.3 Interview Room (/interview/[sessionId])

| Element | Specification |
|---------|--------------|
| Preflight | Camera + mic permission check before start |
| AI Avatar | Interviewer visual representation |
| Timer | Countdown based on durationMin |
| Transcript panel | Real-time speaker-labeled transcript |
| Status indicators | Connecting → Live → Ending → Complete |
| Video recording | Company sessions only — uploads to S3 |
| Face detection | MediaPipe — warns on camera obstruction |
| VAD | Voice activity detection for silence handling |
| End interview | Manual end or auto on timer expiry |

#### 5.6.4 Company Admin Dashboard (/admin)

| Section | Content |
|---------|---------|
| KPI Cards | Total sessions, open, completed, avg score, completion rate |
| Trend Charts | Sessions created vs completed over time |
| Score Distribution | Bucket chart (0-20, 21-40, etc.) |
| Recent Sessions | Table: candidate, score, status, duration |
| Period Filter | 7d, 30d, this month, this year |
| Requirements Tab | Create/edit requirements, invite candidates |
| Sessions Tab | Filterable session list with detail view |
| Candidates Tab | Candidate records management |
| Settings Tab | Company profile, interviewer name, voice gender, passcode |

#### 5.6.5 Master Admin (/master)

| Page | Content |
|------|---------|
| Overview | Platform metrics: companies, sessions, revenue |
| Companies | CRUD, activate/deactivate, passcode reset |
| Promo Codes | Create, edit, usage counts |
| Practice Sessions | All practice sessions with payment status |

[PAGE_BREAK]

## 6. Database Design

### 6.1 Entity Relationship Overview

```
Company (1) ──────< Requirement (N)
Company (1) ──────< Candidate (N)
Company (1) ──────< RequirementInvite (N)
Company (1) ──────< ScorecardShareLink (N)
Company (1) ──────< InterviewSession (N)

Requirement (1) ──< RequirementQuestion (N)
Requirement (1) ──< RequirementInvite (N)
Requirement (1) ──< InterviewSession (N)

Candidate (1) ────< InterviewSession (N)

InterviewSession (1) ──< InterviewTurn (N)
InterviewSession (1) ──< InterviewQuestion (N)
InterviewSession (1) ─── Scorecard (1)
InterviewSession (1) ──< ScoringBatchJob (N)
InterviewSession (1) ──< ScorecardShareLink (N)
InterviewSession (1) ─── PracticePayment (1)

PromoCode — standalone (no relations)
```

### 6.2 Model: Company

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (cuid) | PK | Unique identifier |
| name | String | UNIQUE, NOT NULL | Company name |
| domain | String | NOT NULL | Company domain (e.g., acme.com) |
| adminEmail | String | NOT NULL | Admin login email |
| adminPasscode | String | NOT NULL | Hashed/plain passcode for login |
| interviewerName | String? | NULLABLE | AI interviewer display name |
| interviewerVoiceGender | Enum | MALE/FEMALE, default MALE | Voice selection |
| isActive | Boolean | default true | Account active status |
| createdAt | DateTime | auto | Record creation |
| updatedAt | DateTime | auto | Last update |

### 6.3 Model: Requirement

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (cuid) | PK | Unique identifier |
| companyId | String | FK → Company | Owner company |
| accessCode | String? | UNIQUE | Optional direct access code |
| title | String? | NULLABLE | Job title (e.g., Senior PM) |
| domain | String | NOT NULL | Domain (e.g., Product Management) |
| topic | String | NOT NULL | Specific topic focus |
| durationMin | Int | NOT NULL | Interview duration in minutes |
| jobDescription | String? | NULLABLE | Full JD text for AI question gen |
| keySkills | Json? | NULLABLE | Array of key skills |
| maxOptionalQuestions | Int | default 0 | Optional question pool size |
| isArchived | Boolean | default false | Soft archive flag |
| createdAt | DateTime | auto | Record creation |
| updatedAt | DateTime | auto | Last update |

### 6.4 Model: RequirementQuestion

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (cuid) | PK | Unique identifier |
| requirementId | String | FK → Requirement | Parent requirement |
| prompt | String | NOT NULL | Interview question text |
| expectedAnswer | String? | NULLABLE | Ideal answer for grading |
| gradingRubric | String? | NULLABLE | Rubric for AI scoring |
| difficulty | String | default "medium" | easy/medium/hard |
| orderIndex | Int | NOT NULL | Question order |
| isMandatory | Boolean | default true | Must be asked in interview |

### 6.5 Model: RequirementInvite

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (cuid) | PK | Unique identifier |
| requirementId | String | FK → Requirement | Linked requirement |
| companyId | String | FK → Company | Owner company |
| email | String | NOT NULL | Candidate email |
| accessCode | String | UNIQUE | Unique invite code |
| emailSentAt | DateTime? | NULLABLE | When invite email was sent |
| expiresAt | DateTime | NOT NULL | Invite expiry datetime |
| usedAt | DateTime? | NULLABLE | When candidate used invite |
| createdAt | DateTime | auto | Record creation |
| updatedAt | DateTime | auto | Last update |

**Unique constraint:** (requirementId, email) — one invite per email per requirement

### 6.6 Model: Candidate

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (cuid) | PK | Unique identifier |
| companyId | String | FK → Company | Owner company |
| name | String | NOT NULL | Candidate full name |
| email | String? | NULLABLE | Candidate email |
| isArchived | Boolean | default false | Soft archive |
| createdAt | DateTime | auto | Record creation |
| updatedAt | DateTime | auto | Last update |

**Index:** (companyId, email)

### 6.7 Model: InterviewSession (Core)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (cuid) | PK | Unique identifier |
| accessCode | String | UNIQUE | Session access code |
| sessionType | Enum | PRACTICE/COMPANY | Session type |
| status | Enum | READY/LIVE/COMPLETED | Session status |
| candidateName | String? | NULLABLE | Candidate display name |
| candidateEmail | String? | NULLABLE | Candidate email |
| candidateId | String? | FK → Candidate | Linked candidate record |
| domain | String | NOT NULL | Interview domain |
| topic | String | NOT NULL | Interview topic |
| durationMin | Int | NOT NULL | Duration in minutes |
| companyName | String? | NULLABLE | Company display name |
| companyId | String? | FK → Company | Owner company |
| requirementId | String? | FK → Requirement | Linked requirement |
| positionTitle | String? | NULLABLE | Job position title |
| jobDescription | String? | NULLABLE | JD snapshot |
| keySkills | Json? | NULLABLE | Skills snapshot |
| isPaid | Boolean | default false | Payment completed |
| promoCode | String? | NULLABLE | Promo code used |
| startedAt | DateTime? | NULLABLE | Interview start time |
| endedAt | DateTime? | NULLABLE | Interview end time |
| createdAt | DateTime | auto | Record creation |
| updatedAt | DateTime | auto | Last update |

### 6.8 Model: InterviewTurn (Transcript)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (cuid) | PK | Unique identifier |
| sessionId | String | FK → InterviewSession | Parent session |
| speaker | Enum | CANDIDATE/INTERVIEWER | Who spoke |
| message | String | NOT NULL | Transcript text |
| orderIndex | Int | default 0 | Turn order in conversation |
| timestampMs | Int? | NULLABLE | Milliseconds from interview start |
| transcriptionConfidence | Float? | NULLABLE | ASR confidence 0–1 |
| createdAt | DateTime | auto | Record creation |

### 6.9 Model: InterviewQuestion

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (cuid) | PK | Unique identifier |
| sessionId | String | FK → InterviewSession | Parent session |
| prompt | String | NOT NULL | Question text (copied from requirement) |
| expectedAnswer | String? | NULLABLE | Ideal answer |
| gradingRubric | String? | NULLABLE | Grading rubric |
| difficulty | String | default "medium" | Difficulty level |
| orderIndex | Int | NOT NULL | Question order |
| isMandatory | Boolean | default true | Mandatory flag |

### 6.10 Model: Scorecard

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (cuid) | PK | Unique identifier |
| sessionId | String | UNIQUE, FK | One scorecard per session |
| overallScore | Int | NOT NULL | 0–100 overall score |
| communication | Int | NOT NULL | 0–100 communication score |
| domainDepth | Int | NOT NULL | 0–100 domain knowledge score |
| confidence | Int | NOT NULL | 0–100 confidence score |
| summary | String | NOT NULL | AI-generated summary text |
| strengths | Json? | NULLABLE | Array of strength strings |
| improvements | Json? | NULLABLE | Array of improvement strings |
| evidence | Json? | NULLABLE | Supporting evidence quotes |
| accuracyPercent | Int? | NULLABLE | Question-level accuracy % |
| questionResults | Json? | NULLABLE | Per-question grading results |
| scoringMode | String? | default "heuristic" | heuristic/rubric |
| scoringModel | String? | NULLABLE | Model used (gpt-4.1-mini) |
| createdAt | DateTime | auto | Record creation |
| updatedAt | DateTime | auto | Last update |

### 6.11 Model: ScorecardShareLink

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (cuid) | PK | Unique identifier |
| tokenHash | String | UNIQUE | SHA-256 hash of share token |
| sessionId | String | FK → InterviewSession | Linked session |
| companyId | String | FK → Company | Owner company |
| expiresAt | DateTime | NOT NULL | Link expiry (default 14 days) |
| revokedAt | DateTime? | NULLABLE | Manual revocation timestamp |
| includeCandidateName | Boolean | default false | Show/hide candidate name |
| createdAt | DateTime | auto | Record creation |
| updatedAt | DateTime | auto | Last update |

### 6.12 Model: PracticePayment

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (cuid) | PK | Unique identifier |
| orderId | String | UNIQUE | Razorpay order ID |
| paymentId | String? | UNIQUE | Razorpay payment ID |
| signature | String? | NULLABLE | Payment signature |
| amountPaise | Int | NOT NULL | Amount in paise |
| currency | String | default "INR" | Currency code |
| status | Enum | CREATED/VERIFIED/FAILED | Payment status |
| candidateName | String | NOT NULL | Buyer name |
| candidateEmail | String | NOT NULL | Buyer email |
| domain | String | NOT NULL | Selected domain |
| topic | String | NOT NULL | Selected topic |
| durationMin | Int | NOT NULL | Selected duration |
| promoCode | String? | NULLABLE | Promo code if used |
| sessionId | String? | UNIQUE, FK | Created session after payment |
| createdAt | DateTime | auto | Record creation |
| updatedAt | DateTime | auto | Last update |

### 6.13 Model: PromoCode

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (cuid) | PK | Unique identifier |
| code | String | UNIQUE | Promo code string |
| durationMin | Int | NOT NULL | Free minutes granted |
| isActive | Boolean | default true | Active status |
| createdAt | DateTime | auto | Record creation |
| updatedAt | DateTime | auto | Last update |

### 6.14 Model: ScoringBatchJob

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (cuid) | PK | Unique identifier |
| sessionId | String | FK → InterviewSession | Session being graded |
| status | Enum | PENDING/SUBMITTED/COMPLETED/FAILED | Job status |
| batchId | String? | NULLABLE | OpenAI batch ID |
| inputPayload | Json | NOT NULL | Grading input data |
| resultPayload | Json? | NULLABLE | Grading results |
| error | String? | NULLABLE | Error message if failed |
| retryCount | Int | default 0 | Retry attempts |
| submittedAt | DateTime? | NULLABLE | Submission time |
| completedAt | DateTime? | NULLABLE | Completion time |
| createdAt | DateTime | auto | Record creation |
| updatedAt | DateTime | auto | Last update |

### 6.15 Enumerations

| Enum | Values | Usage |
|------|--------|-------|
| SessionType | PRACTICE, COMPANY | InterviewSession.sessionType |
| SessionStatus | READY, LIVE, COMPLETED | InterviewSession.status |
| TurnSpeaker | CANDIDATE, INTERVIEWER | InterviewTurn.speaker |
| PaymentStatus | CREATED, VERIFIED, FAILED | PracticePayment.status |
| ScoringJobStatus | PENDING, SUBMITTED, COMPLETED, FAILED | ScoringBatchJob.status |
| InterviewerVoiceGender | MALE, FEMALE | Company.interviewerVoiceGender |

[PAGE_BREAK]

## 7. Backend Architecture

### 7.1 lib/ Module Organization

| Module Path | Files | Responsibility |
|-------------|-------|---------------|
| lib/prisma.ts | 1 | Prisma client singleton |
| lib/env.ts | 1 | Zod-validated environment variables |
| lib/constants.ts | 1 | App-wide constants |
| lib/auth/ | 3 | company-admin-auth, master-auth, candidate-interview-auth |
| lib/integrations/openai/ | 3 | OpenAI client, realtime, scoring calls |
| lib/integrations/razorpay/ | 1 | Razorpay payment client |
| lib/integrations/email/ | 2 | SMTP delivery, invite emails |
| lib/integrations/storage/ | 1 | S3/local video storage |
| lib/interview/ | 8 | Prompt, questions, duration, realtime-session, VAD |
| lib/interview/grading/ | 2 | Question-level and session grading |
| lib/scoring.ts | 1 | Heuristic + AI scoring orchestration |
| lib/scorecard/ | 5 | PDF generation, share links, role catalog |
| lib/requirements/ | 3 | Requirement CRUD helpers |
| lib/candidate/ | 2 | Candidate verification logic |
| lib/speech-transcription.ts | 1 | ASR transcription |
| lib/voice-activity-detection.ts | 1 | VAD logic |
| lib/semantic-evaluation.ts | 1 | Embedding-based evaluation |
| lib/generate-ideal-answers.ts | 1 | AI ideal answer generation |

### 7.2 Authentication Flow

#### Company Admin Auth
```
1. POST /api/company-auth/login { email, passcode, companyName, domain }
2. Server validates against Company table
3. Sets HttpOnly cookie: company-admin-session
4. Middleware protects /admin, /sessions, /profile routes
5. GET /api/company-auth/session validates cookie on each request
```

#### Master Admin Auth
```
1. POST /api/master/auth/login { key: MASTER_ADMIN_KEY }
2. Sets HttpOnly cookie: master-admin-session
3. Protects /master/* routes
```

#### Candidate Interview Auth
```
1. POST /api/candidate/verify { accessCode, name, email }
2. Validates RequirementInvite or session accessCode
3. Sets HttpOnly cookie: candidate-interview-session
4. Protects /interview/[sessionId] route
```

### 7.3 Scoring Pipeline

```
Interview Complete
 │
 ├─► Immediate: Heuristic scorecard (word count based)
 │ └─► Scorecard record created (scoringMode: "heuristic")
 │
 └─► Async: ScoringBatchJob created (status: PENDING)
 │
 ├─► Extract Q&A pairs from transcript
 ├─► For each question: GPT-4.1-mini rubric grading
 ├─► Semantic evaluation via embeddings
 ├─► Update Scorecard with questionResults, accuracyPercent
 └─► ScoringBatchJob status → COMPLETED
```

[PAGE_BREAK]

## 8. API Specification 

### 8.1 API Overview

Total API Routes: **48 endpoints** across 8 groups.

| Group | Base Path | Auth Required | Count |
|-------|-----------|---------------|-------|
| Practice & Payment | /api/practice/* | No (public) | 4 |
| Interview | /api/interview/* | Candidate session cookie | 8 |
| Company Auth | /api/company-auth/* | No (login endpoint) | 4 |
| Company Admin | /api/admin/* | Company admin cookie | 15 |
| Candidate | /api/candidate/* | No | 1 |
| Master Admin | /api/master/* | Master admin cookie | 10 |
| AI | /api/ai/* | Company admin cookie | 2 |
| Share & Contact | /api/share/*, /api/contact | Token (share) / None | 2 |

### 8.2 Practice & Payment APIs

#### POST /api/practice/payment/order
- **Auth:** None
- **Request:** `{ candidateName, candidateEmail, domain, topic, durationMin, promoCode? }`
- **Response:** `{ orderId, amount, currency, keyId }`
- **Logic:** Creates Razorpay order, stores PracticePayment (CREATED)

#### POST /api/practice/payment/verify
- **Auth:** None
- **Request:** `{ orderId, paymentId, signature }`
- **Response:** `{ ok: true, sessionId }`
- **Logic:** Verifies HMAC-SHA256 signature, creates InterviewSession, updates payment (VERIFIED)

#### POST /api/practice/payment/webhook
- **Auth:** Razorpay webhook secret
- **Request:** Razorpay event payload
- **Logic:** Async payment status updates

#### POST /api/practice/start
- **Auth:** None
- **Request:** `{ candidateName, candidateEmail, domain, topic, durationMin, promoCode? }`
- **Response:** `{ sessionId, accessCode }`
- **Logic:** Creates session directly (promo code bypass)

### 8.3 Interview APIs

#### GET /api/interview/[sessionId]/details
- **Auth:** Candidate session cookie
- **Response:** Session config, questions, company info, interviewer profile

#### POST /api/interview/[sessionId]/realtime
- **Auth:** Candidate session cookie
- **Request:** `{ action: "create" | "connect" }`
- **Response:** `{ clientSecret, sessionConfig }` (OpenAI ephemeral token)
- **Logic:** Creates OpenAI Realtime session with interview prompt

#### POST /api/interview/[sessionId]/turn
- **Auth:** Candidate session cookie
- **Request:** `{ speaker, message, orderIndex, timestampMs?, transcriptionConfidence? }`
- **Response:** `{ ok: true, turnId }`
- **Logic:** Saves transcript turn to InterviewTurn table

#### POST /api/interview/[sessionId]/complete
- **Auth:** Candidate session cookie
- **Request:** `{ transcript?: Turn[] }`
- **Response:** `{ ok: true, scorecard: ScorecardData }`
- **Logic:** Marks session COMPLETED, generates scorecard, creates ScoringBatchJob

#### POST /api/interview/[sessionId]/video/upload-url
- **Auth:** Candidate session cookie
- **Response:** `{ uploadUrl, key }` (S3 pre-signed URL)

#### POST /api/interview/[sessionId]/video/metadata
- **Auth:** Candidate session cookie
- **Request:** `{ key, durationSec, sizeBytes }`
- **Logic:** Saves video metadata for playback

#### GET /api/interview/[sessionId]/video
- **Auth:** Company admin or candidate session
- **Response:** `{ playbackUrl, status }`

### 8.4 Company Admin APIs

#### GET /api/admin/dashboard
- **Auth:** Company admin cookie
- **Query:** `?period=7d|30d|month|year`
- **Response:** KPIs, trends, score distribution, recent sessions, invite metrics

#### GET /api/admin/sessions
- **Auth:** Company admin cookie
- **Query:** `?status=&search=&page=&limit=&scoreMin=&scoreMax=`
- **Response:** Paginated session list with scorecard summary

#### GET/POST /api/admin/requirements
- **Auth:** Company admin cookie
- **POST Request:** `{ title, domain, topic, durationMin, jobDescription, questions[], keySkills[] }`
- **Response:** Created requirement with accessCode

#### POST /api/admin/requirements/invite-candidates
- **Auth:** Company admin cookie
- **Request:** `{ requirementId, emails: string[] }`
- **Response:** `{ sent: number, failed: number, invites: InviteResult[] }`
- **Logic:** Creates RequirementInvite records, sends SMTP emails

#### POST /api/admin/requirements/verify-emails
- **Auth:** Company admin cookie
- **Request:** `{ emails: string[] }`
- **Response:** `{ valid: string[], invalid: string[] }`

#### GET/PATCH /api/admin/session/[sessionId]
- **Auth:** Company admin cookie
- **Response:** Full session detail with transcript, scorecard, video status

#### POST /api/admin/session/[sessionId]/regrade
- **Auth:** Company admin cookie
- **Logic:** Triggers new ScoringBatchJob for re-grading

#### GET/POST /api/admin/session/[sessionId]/scorecard-share
- **Auth:** Company admin cookie
- **POST Request:** `{ includeCandidateName, expiresInDays }`
- **Response:** `{ shareUrl, token, expiresAt }`

#### GET/PUT /api/admin/company-settings
- **Auth:** Company admin cookie
- **PUT Request:** `{ name?, interviewerName?, interviewerVoiceGender?, newPasscode? }`

#### GET /api/admin/candidates
- **Auth:** Company admin cookie
- **Response:** Paginated candidate list

### 8.5 Master Admin APIs

#### POST /api/master/auth/login
- **Request:** `{ key: string }`
- **Response:** `{ ok: true }`

#### GET /api/master/overview
- **Response:** Platform metrics, weekly growth, recent activity

#### GET/POST /api/master/companies
- **POST Request:** `{ name, domain, adminEmail, adminPasscode, interviewerName?, interviewerVoiceGender? }`

#### PATCH /api/master/companies/[companyId]/passcode
- **Logic:** Regenerates admin passcode

#### GET/POST /api/master/promo-codes
- **POST Request:** `{ code, durationMin, isActive }`

#### GET /api/master/practice-sessions
- **Response:** All practice sessions with payment and score data

### 8.6 AI APIs

#### POST /api/ai/generate-questions
- **Auth:** Company admin cookie
- **Request:** `{ jobDescription, domain, count }`
- **Response:** `{ questions: [{ prompt, expectedAnswer, difficulty }] }`

#### POST /api/ai/relevancy
- **Auth:** Company admin cookie
- **Request:** `{ question, answer }`
- **Response:** `{ relevant: boolean, score: number }`

### 8.7 Public APIs

#### POST /api/candidate/verify
- **Request:** `{ accessCode, name, email }`
- **Response:** `{ ok: true, sessionId }`
- **Logic:** Validates invite, creates/links Candidate, creates InterviewSession

#### POST /api/contact
- **Request:** `{ name, email, subject, message, honeypot? }`
- **Response:** `{ ok: true }`
- **Logic:** Zod validation, honeypot check, rate limit (5/hr/IP), SMTP send

#### GET /api/share/scorecard/[token]/pdf
- **Auth:** Token in URL (no login)
- **Response:** PDF binary (application/pdf)
- **Logic:** Validates token hash, expiry, revocation; generates PDF via pdf-lib

[PAGE_BREAK]

## 9. Frontend Pages & Routes

### 9.1 Complete Route Map

| Route | Page File | Auth | Description |
|-------|-----------|------|-------------|
| / | app/page.tsx | Public | Marketing home |
| /about | app/about/page.tsx | Public | About Us |
| /contact | app/contact/page.tsx | Public | Contact form |
| /privacy | app/privacy/page.tsx | Public | Privacy policy |
| /terms | app/terms/page.tsx | Public | Terms of service |
| /practice | app/practice/page.tsx | Public | Practice interview + payment |
| /candidate | app/candidate/page.tsx | Public | Candidate invite verification |
| /interview/[sessionId] | app/interview/[sessionId]/page.tsx | Candidate cookie | Live interview room |
| /company-login | app/company-login/page.tsx | Public | Company admin login |
| /company-register | app/company-register/page.tsx | Public | Company registration |
| /company-login/forgot-passcode | app/company-login/forgot-passcode/page.tsx | Public | Passcode recovery |
| /admin | app/admin/page.tsx | Company admin | Admin dashboard |
| /sessions | app/sessions/page.tsx | Company admin | Session management |
| /profile | app/profile/page.tsx | Company admin | Company profile |
| /master-login | app/master-login/page.tsx | Public | Master admin login |
| /master | app/master/page.tsx | Master admin | Master home |
| /master/overview | app/master/overview/page.tsx | Master admin | Platform overview |
| /master/companies | app/master/companies/page.tsx | Master admin | Company management |
| /master/promo-codes | app/master/promo-codes/page.tsx | Master admin | Promo codes |
| /master/practice-sessions | app/master/practice-sessions/page.tsx | Master admin | Practice monitoring |
| /share/scorecard/[token] | app/share/scorecard/[token]/page.tsx | Public (token) | Public scorecard view |

### 9.2 Middleware Protection

| Protected Routes | Auth Check |
|-----------------|------------|
| /admin, /sessions, /profile | Company admin session cookie |
| /master/* (except /master-login) | Master admin session cookie |
| /interview/[sessionId] | Candidate interview session cookie |

[PAGE_BREAK]

## 10. Functional Requirements

### 10.1 Module: Public Website

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| PW-01 | Marketing landing page with hero, features, CTAs | High | Done |
| PW-02 | About, Contact, Privacy, Terms pages | High | Done |
| PW-03 | Contact form with SMTP delivery | Medium | Done |
| PW-04 | Navigation to Practice, Company Login, Candidate | High | Done |
| PW-05 | SEO metadata on all public pages | Medium | Done |

### 10.2 Module: Practice Interview

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| PR-01 | Domain/topic selection (predefined + custom) | High | Done |
| PR-02 | Duration configuration (10–120 min) | High | Done |
| PR-03 | Dynamic pricing (₹25/10-min block configurable) | High | Done |
| PR-04 | Name and email collection | High | Done |
| PR-05 | Promo code bypass for payment | High | Done |
| PR-06 | Razorpay order creation and checkout | High | Done |
| PR-07 | Payment signature verification | High | Done |
| PR-08 | Session creation and redirect to interview room | High | Done |
| PR-09 | Razorpay webhook for async status | Medium | Done |

### 10.3 Module: Company Workflow

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| CW-01 | Company admin login (email + passcode) | High | Done |
| CW-02 | Requirement creation with JD, skills, questions | High | Done |
| CW-03 | AI question generation from job description | High | Done |
| CW-04 | AI ideal answer generation | Medium | Done |
| CW-05 | Candidate invite by email (single + bulk) | High | Done |
| CW-06 | Email deliverability verification | Medium | Done |
| CW-07 | Unique expiring access codes per invite | High | Done |
| CW-08 | Invite status tracking (sent, used, expired) | High | Done |

### 10.4 Module: Live Interview

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| LI-01 | Camera/mic preflight check | High | Done |
| LI-02 | OpenAI Realtime API voice session | High | Done |
| LI-03 | AI follows configured questions/agenda | High | Done |
| LI-04 | Countdown timer | High | Done |
| LI-05 | Full transcript with speaker labels + timestamps | High | Done |
| LI-06 | Face detection with obstruction warning | Medium | Done |
| LI-07 | VAD silence detection and nudges | Medium | Done |
| LI-08 | State recovery on page refresh | High | Done |
| LI-09 | Video recording + S3 upload (company) | High | Done |
| LI-10 | Configurable interviewer name/voice per company | Medium | Done |
| LI-11 | Prevent re-entry to completed interviews | High | Done |

### 10.5 Module: Scoring

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| SC-01 | Immediate scorecard on completion | High | Done |
| SC-02 | Dimension scores: overall, communication, domain, confidence | High | Done |
| SC-03 | Summary, strengths, improvements, evidence | High | Done |
| SC-04 | Background question-level AI grading | High | Done |
| SC-05 | Session regrade capability | Medium | Done |
| SC-06 | ScoringBatchJob async processing | High | Done |
| SC-07 | Semantic evaluation (not keyword matching) | High | Done |

### 10.6 Module: Admin Dashboard

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| AD-01 | KPI dashboard with period filtering | High | Done |
| AD-02 | Session list with filters and search | High | Done |
| AD-03 | Session detail: transcript, scorecard, video | High | Done |
| AD-04 | Scorecard share link generation | High | Done |
| AD-05 | PDF export via share link | High | Done |
| AD-06 | Link expiry and revocation | Medium | Done |
| AD-07 | Candidate management | Medium | Done |
| AD-08 | Company profile and passcode update | Medium | Done |

### 10.7 Module: Master Admin

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| MA-01 | Platform overview dashboard | High | Done |
| MA-02 | Company CRUD with activate/deactivate | High | Done |
| MA-03 | Passcode regeneration | High | Done |
| MA-04 | Promo code management | High | Done |
| MA-05 | Practice session monitoring | High | Done |

[PAGE_BREAK]

## 11. Non-Functional Requirements

### 11.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NF-P01 | API response time (dashboard, lists) | < 2 seconds |
| NF-P02 | AI connection establishment | < 5 seconds |
| NF-P03 | List endpoint pagination | Default 10, max 50 |
| NF-P04 | Dashboard auto-refresh | 30 seconds |

### 11.2 Security

| ID | Requirement |
|----|-------------|
| NF-S01 | Admin areas require cookie-based authentication |
| NF-S02 | Candidate access guarded by session cookies |
| NF-S03 | Share links use cryptographic token hashing |
| NF-S04 | Razorpay signature validation (HMAC-SHA256) |
| NF-S05 | All secrets in environment variables only |
| NF-S06 | Production cookies: Secure + HttpOnly |
| NF-S07 | Share links expire after configurable TTL (14 days default) |

### 11.3 Reliability

| ID | Requirement |
|----|-------------|
| NF-R01 | Interview state persists across page refresh |
| NF-R02 | Transcript stored server-side on completion |
| NF-R03 | Payment state: CREATED → VERIFIED / FAILED |
| NF-R04 | Grading failures don't block scorecard delivery |
| NF-R05 | Email failures logged but don't block invite flow |

### 11.4 Usability

| ID | Requirement |
|----|-------------|
| NF-U01 | Candidate join: max 3 inputs (code, name, email) |
| NF-U02 | Practice purchase: < 2 minutes to interview start |
| NF-U03 | All errors show human-readable messages |
| NF-U04 | Clear status indicators in interview room |

[PAGE_BREAK]

## 12. External Integrations

| Service | Purpose | Env Variables | Fallback |
|---------|---------|---------------|----------|
| OpenAI Realtime | Live voice interview | OPENAI_API_KEY | None — interview cannot proceed |
| OpenAI GPT-4.1-mini | Scoring, question gen | OPENAI_API_KEY, SCORING_MODEL | Heuristic scoring |
| Razorpay | Practice payments | RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET | Promo code bypass |
| PostgreSQL (Supabase) | Database | DATABASE_URL, DIRECT_URL | None |
| SMTP / AWS SES | Email delivery | SMTP_HOST, SMTP_USER, SMTP_PASS | Manual code delivery |
| AWS S3 | Video storage | AWS_S3_BUCKET, AWS_ACCESS_KEY_ID | Skip recording |
| MediaPipe | Face detection | Client-side CDN | Skip face check |

[PAGE_BREAK]

## 13. Security Requirements

### 13.1 Authentication Secrets

| Secret | Purpose | Storage |
|--------|---------|---------|
| ADMIN_PORTAL_KEY | Company admin session signing | Server env only |
| MASTER_ADMIN_KEY | Master admin session signing | Server env only |
| COMPANY_SESSION_SECRET | Cookie encryption | Server env only |
| CANDIDATE_INTERVIEW_SESSION_SECRET | Candidate cookie signing | Server env only |
| RAZORPAY_KEY_SECRET | Payment verification | Server env only |
| RAZORPAY_WEBHOOK_SECRET | Webhook validation | Server env only |
| OPENAI_API_KEY | AI API calls | Server env only |
| SMTP_PASS | Email authentication | Server env only |
| AWS_SECRET_ACCESS_KEY | S3 access | Server env only |

### 13.2 Public (Client-Safe) Variables

| Variable | Purpose |
|----------|---------|
| NEXT_PUBLIC_APP_URL | App base URL |
| NEXT_PUBLIC_RAZORPAY_KEY_ID | Razorpay checkout (public by design) |

[PAGE_BREAK]

## 14. 1-Month Delivery Timeline 

### Overview

| Week | Focus Area | Key Deliverables |
|------|-----------|-------|------------------|
| Week 1 (Days 1–7) | Foundation & Audit | Staging deploy, bug fixes, production env |
| Week 2 (Days 8–14) | Core Flow Polish | Practice, invite, interview, scoring stable |
| Week 3 (Days 15–21) | Operations & Security | Email, payments live, pilot interview |
| Week 4 (Days 22–30) | QA, UAT & Launch | Regression, UAT, production launch |

### Week 1: Foundation & Audit (Days 1–7)

**Objective:** All flows functional on staging with production-grade configuration.

| Day | Task | Module | Deliverable |
|-----|------|--------|-------------|
| 1 | Full practice flow audit: purchase → interview → scorecard | Practice, Payment, Interview | Bug list with priorities |
| 2 | Full company flow audit: requirement → invite → interview → dashboard | Company, Admin | Bug list with priorities |
| 3 | Production environment setup: DB, OpenAI, Razorpay, SMTP, S3 | DevOps, Integrations | .env.production configured |
| 4 | Database migration to production, seed master admin + test company | Database, Prisma | Production DB running |
| 5 | Fix critical authentication and session bugs | Auth, Middleware | Auth stable on staging |
| 6 | Fix payment verification and webhook handling | Razorpay, Practice | Payments working end-to-end |
| 7 | Deploy to staging, smoke test all 3 user types | All modules | Staging URL live |

**Week 1 Exit Criteria:** End-to-end demo on staging without critical failures.

### Week 2: Core Flow Polish (Days 8–14)

**Objective:** All user-facing flows stable and reliable.

| Day | Task | Module | Deliverable |
|-----|------|--------|-------------|
| 8 | Practice flow: pricing edge cases, promo validation, error messages | Practice, UI | Practice flow stable |
| 9 | Invite flow: email template, delivery tracking, expiry handling | Email, Company | Invites working reliably |
| 10 | Interview room: preflight checks, reconnect logic, transcript saving | Interview, Realtime | Interview reconnect stable |
| 11 | Interview room: timer accuracy, pause/resume, video upload | Interview, S3 | Room feature-complete |
| 12 | Scoring: scorecard quality review, regrade flow, question grading | Scoring, AI | Scoring reliable |
| 13 | Admin dashboard: session list, filters, scorecard view | Admin, UI | Dashboard functional |
| 14 | Scorecard sharing: link generation, PDF export, expiry | Scorecard, Share | Sharing working |

**Week 2 Exit Criteria:** 10+ test interviews (practice + company) complete without major failure.

### Week 3: Operations, Security & Integration (Days 15–21)

**Objective:** Production-grade infrastructure and security.

| Day | Task | Module | Deliverable |
|-----|------|--------|-------------|
| 15 | Master admin portal: company CRUD, promo codes, monitoring | Master Admin | Master portal complete |
| 16 | Production email: SES/SMTP config, SPF/DKIM/DMARC, domain verify | Email, DevOps | Emails delivering reliably |
| 17 | Production payments: Razorpay live mode, webhook, edge cases | Razorpay, Payment | Payments live-ready |
| 18 | Video storage: S3 production bucket, upload/retrieval, cleanup | S3, Storage | Storage configured |
| 19 | Security hardening: secrets audit, session config, HTTPS, cookies | Security, Auth | Security checklist done |
| 20 | Error monitoring: logging, health checks, error alerts | DevOps, Monitoring | Monitoring active |
| 21 | Pilot: Run 1 real company interview cycle end-to-end | All modules | Pilot report |

**Week 3 Exit Criteria:** Pilot interview cycle completes on production infrastructure.

### Week 4: QA, UAT & Launch (Days 22–30)

**Objective:** Production launch with confidence.

| Day | Task | Module | Deliverable |
|-----|------|--------|-------------|
| 22 | Regression testing: all flows, all user types | QA | Test report |
| 23 | Browser testing: Chrome, Edge, Firefox, mobile browsers | QA, UI | Compatibility matrix |
| 24 | Load testing: concurrent interviews, bulk invite sending | QA, Performance | Performance baseline |
| 25 | UAT with stakeholders/pilot clients | PM, QA | Feedback list |
| 26 | Critical bug fixes from UAT feedback | Dev | Bugs resolved |
| 27 | Documentation: deployment runbook, support guide, SRS finalization | Docs | Docs complete |
| 28 | Final production deploy: DNS, SSL, env verification | DevOps | Production live |
| 29 | Launch communications: notify pilot clients | PM | Launch announced |
| 30 | Hypercare: monitor, hotfix, support | Dev, DevOps | Stable 24hr window |

**Week 4 Exit Criteria:** Production live at uhired.in, no P0 bugs, pilot clients onboarded.

[PAGE_BREAK]

## 15. Testing & QA Plan

### 15.1 Test Categories

| Category | Command / Method | Coverage |
|----------|-----------------|----------|
| Unit Tests | npm run test:interview:unit | Conversation state, VAD, transcription, confidence |
| E2E Tests | npm run test:interview:e2e | Full interview flow simulation |
| Full Suite | npm run test:interview:all | Combined E2E suite with HTML report |
| Manual QA | docs/QA-Step-by-Step-Test-Guide.md | Step-by-step UAT guide |
| Payment QA | Razorpay test mode scripts | Checkout, verify, webhook |
| Browser QA | Manual cross-browser | Chrome, Edge, Firefox, mobile |

### 15.2 Pre-Launch Testing Checklist

| Area | Test Cases |
|------|-----------|
| Routing | All 20+ routes return correct pages |
| Practice | Domain select → pay → interview → scorecard |
| Company | Login → create requirement → invite → interview → dashboard |
| Candidate | Access code verify → interview → scorecard visible to admin |
| Master | Login → create company → promo code → view sessions |
| Contact | Form submit → email received, honeypot blocked, rate limit |
| Security | No API keys in client bundle, safe error messages |
| Payment | Razorpay test + live mode, webhook, promo bypass |
| Share | Generate link → view scorecard → PDF download → expiry |

[PAGE_BREAK]

## 16. Deployment & DevOps

### 16.1 Supported Platforms

| Platform | Method | Notes |
|----------|--------|-------|
| Docker / Coolify | Dockerfile with auto-migration | Recommended for production |
| Vercel | Serverless + Supabase Postgres | Alternative deployment |
| Manual | npm run build && npm run start | Self-hosted Node.js |

### 16.2 Production Checklist

1. Supabase Postgres setup (DATABASE_URL + DIRECT_URL)
2. AWS S3 bucket for video storage
3. Razorpay live keys + webhook URL configured
4. OpenAI API key with sufficient quota
5. SMTP/SES for invite emails with SPF/DKIM/DMARC
6. Run npm run db:migrate:deploy
7. Set all environment variables per .env.production.example
8. DNS pointing to uhired.in with SSL
9. Seed master admin account
10. Smoke test all 3 user flows on production

### 16.3 Available NPM Scripts

| Command | Purpose |
|---------|---------|
| npm run dev | Development server |
| npm run build | Production build |
| npm run start | Production server |
| npm run db:migrate | Local migration |
| npm run db:migrate:deploy | Production migration |
| npm run db:seed:dev-admin | Seed dev admin |
| npm run scoring:batch:submit | Submit batch scoring jobs |
| npm run scoring:batch:sync | Sync batch scoring results |
| npm run test:interview:all | Full test suite |

[PAGE_BREAK]

## 17. Acceptance Criteria

### 17.1 Practice Interview

- User can select domain, duration, and complete payment in under 2 minutes
- Promo code redemption works for valid, active codes
- AI interview starts within 5 seconds of room entry
- Full transcript is captured and saved with speaker labels
- Scorecard generated immediately upon completion
- Scorecard shows overall + 3 dimension scores + summary

### 17.2 Company Interview

- Admin creates requirement with questions in under 5 minutes
- Bulk invite sends emails with unique access codes
- Candidate joins via access code + email verification
- Video recording uploads successfully (company sessions)
- Completed session appears in admin dashboard with score
- Admin generates shareable scorecard link
- Shared link displays scorecard and allows PDF download
- Shared link expires after configured TTL

### 17.3 Master Admin

- Master admin logs in, views all companies, creates new company
- Master admin activates/deactivates companies
- Master admin creates and manages promo codes
- Platform overview shows accurate metrics

### 17.4 Non-Functional

- No critical security vulnerabilities in auth/payment flows
- Pages load within 3 seconds on standard connections
- System handles 5+ concurrent interview sessions
- All error states show user-friendly messages
- System recovers from page refresh during interview

[PAGE_BREAK]

## 18. Risk Register

| ID | Risk | Probability | Impact | Mitigation |
|----|------|------------|--------|------------|
| R-01 | OpenAI API instability during live interviews | Medium | Critical | Graceful disconnect, save transcript, manual completion |
| R-02 | Email deliverability blocks candidate participation | High | High | SPF/DKIM/DMARC in Week 1, test with real domains |
| R-03 | Razorpay integration issues in live mode | Low | High | Live-mode testing Week 2, promo-code fallback |
| R-04 | Scoring quality below recruiter expectations | Medium | Medium | Re-grading, prompt tuning, evidence transparency |
| R-05 | Video upload failures on poor connections | Medium | Medium | Recording optional, transcript always saved |
| R-06 | Scope creep derails 30-day timeline | High | High | Feature freeze after Week 1, defer to Phase 2 |
| R-07 | Database migration issues in production | Low | Critical | Test migrations on staging first |
| R-08 | Browser compatibility in interview room | Medium | Medium | Test Chrome, Edge, Firefox; document minimum requirements |
| R-09 | Candidate privacy/consent concerns | Medium | High | Terms acceptance at session start, retention policy |
| R-10 | Single developer bandwidth bottleneck | High | High | Ruthless prioritization, cut nice-to-haves |

[PAGE_BREAK]

## 19. Appendix

### 19.1 Environment Variables (Complete List)

```
# Application
NEXT_PUBLIC_APP_URL=https://uhired.in

# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Authentication
ADMIN_PORTAL_KEY=change-me
MASTER_ADMIN_KEY=change-me-master
COMPANY_SESSION_SECRET=change-me-company
CANDIDATE_INTERVIEW_SESSION_SECRET=change-me-candidate

# AI
OPENAI_API_KEY=sk-...
SCORING_MODE=rubric
SCORING_MODEL=gpt-4.1-mini
EMBEDDING_MODEL=text-embedding-3-small

# Payments
RAZORPAY_KEY_ID=rzp_live_xxxxx
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
PRACTICE_BASE_PRICE_RUPEES=25

# Video Storage
VIDEO_STORAGE_PROVIDER=s3
AWS_REGION=ap-south-1
AWS_S3_BUCKET=uhired-videos
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Email
EMAIL_PROVIDER=smtp
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=465
SMTP_USER=no-reply@uhired.in
SMTP_PASS=...
SMTP_FROM_EMAIL=no-reply@uhired.in
SUPPORT_EMAIL=support@uhired.in
INVITE_EMAIL_BASE_URL=https://uhired.in
CONTACT_TO_EMAIL=support@uhired.in
```

### 19.2 Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-20 | Engineering | Initial SRS |
| 2.0 | 2026-08-03 | Engineering | Complete SRS with DB, API, UI, Design, 30-day timeline |

### 19.3 Related Documents

| Document | Path | Description |
|----------|------|-------------|
| README | README.md | Project overview and setup |
| Requirements | REQUIREMENTS.txt | Restructure requirements |
| Deployment Guide | DEPLOYMENT.md | Production deployment |
| QA Test Guide | docs/QA-Step-by-Step-Test-Guide.md | Manual testing steps |
| Ideal Answer Workflow | docs/ideal-answer-workflow.md | AI grading workflow |
| SRS (Word) | docs/Uhired-SRS-Complete.docx | This document in Word format |


**End of Document**

*Uhired — AI Interview Practice & Hiring Platform* 
*https://uhired.in*
