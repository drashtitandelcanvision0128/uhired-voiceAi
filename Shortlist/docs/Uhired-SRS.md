# Uhired — Software Requirements Specification (SRS)

**Version:** 1.0  
**Date:** July 20, 2026  
**Prepared by:** Product Engineering  
**Timeline:** 4 Weeks (30 Calendar Days)  
**Status:** Draft for Internal Review

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Product Overview](#2-product-overview)
3. [Stakeholders and User Roles](#3-stakeholders-and-user-roles)
4. [System Architecture](#4-system-architecture)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [External Dependencies](#7-external-dependencies)
8. [Database Schema Summary](#8-database-schema-summary)
9. [API Inventory](#9-api-inventory)
10. [Scope and Exclusions](#10-scope-and-exclusions)
11. [Risk Register](#11-risk-register)
12. [4-Week Delivery Timeline](#12-4-week-delivery-timeline)
13. [Acceptance Criteria](#13-acceptance-criteria)
14. [Appendix](#14-appendix)

---

## 1. Introduction

### 1.1 Purpose

This document defines the complete software requirements for the **Uhired** platform — an AI-powered interview practice and hiring workflow system. It serves as the authoritative reference for development, testing, deployment, and stakeholder communication over a 4-week delivery sprint.

### 1.2 Intended Audience

- Product Owner / Founder
- Development Team
- QA / Testing
- DevOps / Infrastructure
- Investors / Clients (executive summary sections)

### 1.3 Definitions

| Term | Definition |
|------|-----------|
| Practice Interview | Self-service paid AI interview session purchased by an individual candidate |
| Company Interview | Structured interview session created by a recruiter for a specific role/candidate |
| Requirement | A job role configuration (domain, questions, duration) created by a company admin |
| Scorecard | AI-generated evaluation report after interview completion |
| Master Admin | Platform super-admin who manages all companies and system settings |
| Access Code | Unique code used by candidates to join their assigned interview session |

---

## 2. Product Overview

### 2.1 Vision Statement

Uhired enables candidates to practice realistic AI-led interviews and enables companies to conduct structured, AI-powered interview workflows with automated scoring, recruiter dashboards, and shareable evaluation reports.

### 2.2 Business Objectives

1. Reduce manual screening effort for hiring companies by 60%+
2. Provide measurable, consistent interview feedback at scale
3. Generate revenue through practice session purchases and company subscriptions
4. Deliver a production-ready MVP within 30 days

### 2.3 Key Differentiators

- Real-time AI interviewer with natural voice conversation
- Automated scorecard generation with dimension-level scoring
- Company-branded interview workflows with custom question banks
- Shareable, expiring scorecard links with PDF export
- Built-in payment flow for self-service practice sessions

---

## 3. Stakeholders and User Roles

### 3.1 Primary Actors

| Actor | Description | Access Method |
|-------|-------------|---------------|
| Practice Candidate | Individual user who purchases/redeems a practice session | Public practice page, Razorpay payment or promo code |
| Company Admin / Recruiter | Creates requirements, invites candidates, reviews results | Company login with email + passcode |
| Invited Candidate | Receives email invite, joins assigned company interview | Unique access code from invite email |
| Master Admin | Manages all companies, promo codes, platform metrics | Master login with admin key |

### 3.2 System Actors

| System | Role |
|--------|------|
| OpenAI API | Powers real-time interview conversation and scoring |
| Razorpay | Processes practice session payments |
| SMTP Provider | Delivers candidate invitation emails |
| Object Storage (S3) | Stores interview video recordings |
| PostgreSQL (via Prisma) | Primary data store |

---

## 4. System Architecture

### 4.1 Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Framer Motion |
| Backend | Next.js API Routes (App Router) |
| Database | PostgreSQL via Prisma ORM |
| AI Engine | OpenAI Realtime API + GPT-4.1-mini for scoring |
| Payments | Razorpay (orders, checkout, webhook verification) |
| Email | SMTP (Mailtrap dev / AWS SES production) |
| Video Storage | AWS S3 (with Supabase legacy support) |
| PDF Generation | pdf-lib |
| Validation | Zod |
| Deployment | Vercel (recommended) |

### 4.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                       │
│  Landing │ Practice │ Candidate │ Interview │ Admin      │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────┐
│              NEXT.JS APPLICATION SERVER                   │
│  API Routes │ Server Components │ Auth Middleware         │
├──────────────────────────────────────────────────────────┤
│  OpenAI     │  Razorpay  │  SMTP    │  S3/Storage        │
│  (Realtime) │  (Payment) │  (Email) │  (Video)           │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              POSTGRESQL DATABASE (Prisma)                 │
│  Companies │ Sessions │ Scorecards │ Candidates │ Turns  │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Functional Requirements

### 5.1 Module: Public Website

| ID | Requirement | Priority |
|----|-------------|----------|
| PW-01 | System shall display a marketing landing page with product positioning, features, and CTAs | High |
| PW-02 | System shall provide About, Contact, Privacy Policy, and Terms of Service pages | High |
| PW-03 | System shall include a contact form that sends inquiries to the configured email | Medium |
| PW-04 | System shall provide navigation to Practice, Company Login, and Candidate entry points | High |

### 5.2 Module: Practice Interview Flow

| ID | Requirement | Priority |
|----|-------------|----------|
| PR-01 | User shall select a focus area (domain/topic) from predefined options or enter a custom one | High |
| PR-02 | User shall configure interview duration (10–120 minutes) | High |
| PR-03 | System shall calculate pricing at ₹50 per 10-minute block (configurable via env) | High |
| PR-04 | User shall provide name and email before proceeding | High |
| PR-05 | User may enter a promo code to bypass payment | High |
| PR-06 | System shall validate promo codes against the PromoCode table (active, correct duration) | High |
| PR-07 | System shall create a Razorpay order and launch checkout for paid sessions | High |
| PR-08 | System shall verify Razorpay payment signature before creating the session | High |
| PR-09 | Upon successful payment/promo, system shall create an InterviewSession and redirect to the interview room | High |
| PR-10 | System shall handle Razorpay webhooks for async payment status updates | Medium |

### 5.3 Module: Company Interview Workflow

| ID | Requirement | Priority |
|----|-------------|----------|
| CW-01 | Company admin shall log in using email + passcode credentials | High |
| CW-02 | Admin shall create Requirements with: title, domain, topic, duration, job description, key skills | High |
| CW-03 | Admin shall define mandatory questions (up to 5) and optional question pools | High |
| CW-04 | System shall auto-generate interview questions from job description using AI | High |
| CW-05 | System shall generate ideal/expected answers for questions using AI | Medium |
| CW-06 | Each Requirement shall receive a unique access code | High |
| CW-07 | Admin shall invite candidates by email (single or bulk via Excel import) | High |
| CW-08 | System shall verify candidate email deliverability before sending | Medium |
| CW-09 | System shall generate unique, expiring access codes per candidate-requirement pair | High |
| CW-10 | System shall send invitation emails with access code and interview link | High |
| CW-11 | System shall track invite delivery status (sent, failed, used, expired) | High |
| CW-12 | Admin shall view all requirements with linked sessions and invite statuses | High |

### 5.4 Module: Candidate Access and Verification

| ID | Requirement | Priority |
|----|-------------|----------|
| CA-01 | Candidate shall enter access code + name + email to join an interview | High |
| CA-02 | System shall verify code validity, expiry, and email match | High |
| CA-03 | System shall mark the invite as "used" upon successful verification | High |
| CA-04 | System shall create/link a Candidate record in the company's tenant | High |
| CA-05 | System shall redirect verified candidate to the interview room | High |
| CA-06 | System shall reject expired, already-used, or mismatched access codes with clear error messages | High |

### 5.5 Module: Live Interview Engine

| ID | Requirement | Priority |
|----|-------------|----------|
| LI-01 | System shall perform camera and microphone preflight check before interview start | High |
| LI-02 | System shall establish a real-time audio session with OpenAI Realtime API | High |
| LI-03 | AI interviewer shall conduct the interview following configured domain/topic/questions | High |
| LI-04 | System shall display a countdown timer based on configured duration | High |
| LI-05 | System shall capture full transcript with speaker labels and timestamps | High |
| LI-06 | System shall detect candidate camera obstruction and pause interview with warning | Medium |
| LI-07 | System shall handle inactivity with configurable nudge prompts | Medium |
| LI-08 | System shall support interview pause/resume on page refresh with state recovery | High |
| LI-09 | System shall record video (company sessions) and upload to object storage | High |
| LI-10 | AI shall deliver a closing remark when time expires or questions are complete | High |
| LI-11 | System shall support configurable AI interviewer name and voice gender per company | Medium |
| LI-12 | System shall prevent re-entry to completed interviews | High |
| LI-13 | System shall allow early completion if minimum progress thresholds are met | Medium |

### 5.6 Module: Scoring and Evaluation

| ID | Requirement | Priority |
|----|-------------|----------|
| SC-01 | Upon interview completion, system shall immediately generate a scorecard | High |
| SC-02 | Scorecard shall include: overall score, communication, domain depth, confidence (0–100 each) | High |
| SC-03 | Scorecard shall include: summary, strengths list, improvements list, evidence | High |
| SC-04 | System shall run background question-level grading with accuracy percentage | High |
| SC-05 | System shall support re-grading of sessions via admin action | Medium |
| SC-06 | Scoring shall use configurable model (default: gpt-4.1-mini) | Medium |
| SC-07 | System shall store scoring mode (heuristic vs rubric) and model version | Medium |
| SC-08 | System shall create a ScoringBatchJob for async deep grading | High |

### 5.7 Module: Admin Dashboard and Session Management

| ID | Requirement | Priority |
|----|-------------|----------|
| AD-01 | Dashboard shall display KPIs: total sessions, open, completed, avg score, completion rate | High |
| AD-02 | Dashboard shall show session trend charts (created vs completed over time) | High |
| AD-03 | Dashboard shall show score distribution buckets | Medium |
| AD-04 | Dashboard shall show top roles by interview volume | Medium |
| AD-05 | Dashboard shall display recent sessions with candidate name, score, status, duration | High |
| AD-06 | Dashboard shall support period filtering: 7d, 30d, this month, this year | High |
| AD-07 | Dashboard shall show period-over-period comparison deltas | Medium |
| AD-08 | Session list shall support filtering by status, date range, score range, and search | High |
| AD-09 | Session detail shall show full transcript, scorecard, video recording status | High |
| AD-10 | Admin shall generate expiring shareable scorecard links | High |
| AD-11 | Shared links shall support optional candidate name masking | Medium |
| AD-12 | System shall export scorecard as PDF via shared link | High |
| AD-13 | Admin shall revoke active share links | Medium |
| AD-14 | Admin shall view and manage candidate records | Medium |
| AD-15 | Dashboard shall show invite pipeline metrics (sent, used, pending, conversion rate) | Medium |

### 5.8 Module: Master Admin Portal

| ID | Requirement | Priority |
|----|-------------|----------|
| MA-01 | Master admin shall authenticate using master admin key | High |
| MA-02 | Master admin shall create new companies with: name, domain, email, passcode, interviewer config | High |
| MA-03 | Master admin shall activate/deactivate companies | High |
| MA-04 | Master admin shall regenerate company admin passcodes | High |
| MA-05 | Master admin shall configure AI interviewer name and voice gender per company | Medium |
| MA-06 | Master admin shall create and manage promo codes (code, duration, active status) | High |
| MA-07 | Master admin shall view promo code usage counts | Medium |
| MA-08 | Master admin shall view all practice sessions with payment status and scores | High |
| MA-09 | Master admin shall view platform overview: total companies, sessions, revenue, health | High |
| MA-10 | Master admin shall view weekly session growth and recent company activity | Medium |

---

## 6. Non-Functional Requirements

### 6.1 Security

| ID | Requirement |
|----|-------------|
| NF-S01 | All admin areas shall require authentication (cookie-based sessions with secrets) |
| NF-S02 | Candidate interview access shall be guarded by session cookies after verification |
| NF-S03 | Scorecard share links shall use cryptographic tokens with hash-based verification |
| NF-S04 | Payment verification shall validate Razorpay signature using HMAC-SHA256 |
| NF-S05 | All secrets shall be stored in environment variables, never in source code |
| NF-S06 | Production cookies shall be marked Secure and HttpOnly |
| NF-S07 | Shared scorecard URLs shall expire after configurable TTL (default: 14 days) |

### 6.2 Performance

| ID | Requirement |
|----|-------------|
| NF-P01 | API responses shall return within 2 seconds for dashboard and list endpoints |
| NF-P02 | Interview room shall establish AI connection within 5 seconds of user action |
| NF-P03 | Database queries shall use pagination (default: 10, max: 50) for list endpoints |
| NF-P04 | Dashboard shall support 30-second auto-refresh without degrading UX |

### 6.3 Reliability

| ID | Requirement |
|----|-------------|
| NF-R01 | Interview state shall persist across page refresh using sessionStorage recovery |
| NF-R02 | Transcript shall be stored server-side on interview completion |
| NF-R03 | Payment state machine shall follow CREATED → VERIFIED / FAILED transitions |
| NF-R04 | Background grading failures shall not block scorecard delivery |
| NF-R05 | Email delivery failures shall be logged and reported but not block the invite flow |

### 6.4 Scalability

| ID | Requirement |
|----|-------------|
| NF-SC01 | System shall support multi-tenant company architecture |
| NF-SC02 | Database connection pooling shall be configurable (default: 5 connections) |
| NF-SC03 | Video storage shall use cloud object storage with pre-signed upload URLs |
| NF-SC04 | Scoring batch jobs shall support async processing for high-volume periods |

### 6.5 Usability

| ID | Requirement |
|----|-------------|
| NF-U01 | Candidate join flow shall require no more than 3 inputs (code, name, email) |
| NF-U02 | Practice purchase shall complete in under 2 minutes from page load to interview start |
| NF-U03 | All error states shall display human-readable messages |
| NF-U04 | Interview room shall display clear status indicators (connecting, live, ending) |

### 6.6 Compliance

| ID | Requirement |
|----|-------------|
| NF-C01 | Privacy policy shall disclose AI recording, transcript analysis, and data retention |
| NF-C02 | Terms of service shall cover interview content ownership and platform liability |
| NF-C03 | Candidate data retention and deletion policies shall be documented before launch |
| NF-C04 | Video recording consent shall be implicit via terms acceptance at session start |

---

## 7. External Dependencies

| Dependency | Purpose | Criticality | Fallback |
|-----------|---------|-------------|----------|
| OpenAI Realtime API | Live AI interview conversation | Critical | No fallback — interview cannot proceed |
| OpenAI GPT-4.1-mini | Scoring, question generation, grading | Critical | Heuristic scoring as degraded mode |
| Razorpay | Practice session payments | Critical (for revenue) | Promo code bypass for testing |
| SMTP Provider | Candidate invite emails | Critical (for company flow) | Manual access code delivery |
| AWS S3 | Video recording storage | High (company sessions) | Skip recording, text-only session |
| PostgreSQL | All persistent data | Critical | No fallback |
| Vercel (hosting) | Application deployment | High | Any Node.js hosting platform |

---

## 8. Database Schema Summary

### 8.1 Core Models

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| Company | Tenant/organization | name, domain, adminEmail, adminPasscode, interviewerName, voiceGender, isActive |
| Requirement | Job role configuration | companyId, title, domain, topic, durationMin, jobDescription, keySkills, questions |
| RequirementQuestion | Question bank items | prompt, expectedAnswer, gradingRubric, difficulty, isMandatory, orderIndex |
| RequirementInvite | Candidate invite records | email, accessCode, emailSentAt, expiresAt, usedAt |
| Candidate | Candidate identity record | companyId, name, email, isArchived |
| InterviewSession | Core interview record | sessionType, status, candidateName, domain, topic, durationMin, companyId, requirementId |
| InterviewTurn | Transcript entries | sessionId, speaker, message, orderIndex, timestampMs |
| InterviewQuestion | Session-level question copies | sessionId, prompt, expectedAnswer, isMandatory |
| Scorecard | Evaluation results | overallScore, communication, domainDepth, confidence, summary, strengths, improvements |
| ScorecardShareLink | Public sharing tokens | tokenHash, sessionId, expiresAt, includeCandidateName |
| ScoringBatchJob | Async grading queue | sessionId, status, inputPayload, resultPayload |
| PracticePayment | Payment records | orderId, paymentId, signature, amountPaise, status |
| PromoCode | Promotional codes | code, durationMin, isActive |

### 8.2 Enumerations

| Enum | Values |
|------|--------|
| SessionType | PRACTICE, COMPANY |
| SessionStatus | READY, LIVE, COMPLETED |
| TurnSpeaker | CANDIDATE, INTERVIEWER |
| PaymentStatus | CREATED, VERIFIED, FAILED |
| ScoringJobStatus | PENDING, SUBMITTED, COMPLETED, FAILED |
| InterviewerVoiceGender | MALE, FEMALE |

---

## 9. API Inventory

### 9.1 Public APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/practice/start | Create practice session (after payment/promo) |
| POST | /api/practice/payment/order | Create Razorpay order |
| POST | /api/practice/payment/verify | Verify payment signature |
| POST | /api/practice/payment/webhook | Razorpay webhook handler |
| POST | /api/candidate/verify | Verify candidate access code and create session |
| POST | /api/contact | Submit contact form |

### 9.2 Interview APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/interview/[sessionId]/details | Fetch session configuration |
| POST | /api/interview/[sessionId]/realtime | Establish realtime AI session |
| POST | /api/interview/[sessionId]/turn | Submit transcript turn |
| POST | /api/interview/[sessionId]/complete | Complete interview and generate scorecard |
| POST | /api/interview/[sessionId]/video/upload-url | Get pre-signed video upload URL |
| POST | /api/interview/[sessionId]/video/metadata | Save video metadata |
| GET | /api/interview/[sessionId]/video | Get video playback info |

### 9.3 Company Admin APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/company-auth/login | Company admin login |
| POST | /api/company-auth/logout | Company admin logout |
| GET | /api/company-auth/session | Validate current session |
| GET | /api/admin/dashboard | Dashboard KPIs and analytics |
| GET | /api/admin/sessions | Paginated session list with filters |
| GET/POST | /api/admin/requirements | List/create requirements |
| GET | /api/admin/requirements/[sessionId] | Requirement detail |
| POST | /api/admin/requirements/invite-candidates | Bulk invite candidates |
| POST | /api/admin/requirements/verify-emails | Verify candidate emails |
| GET/PATCH | /api/admin/session/[sessionId] | Session detail and updates |
| POST | /api/admin/session/[sessionId]/regrade | Trigger scorecard re-grading |
| GET/POST | /api/admin/session/[sessionId]/scorecard-share | Manage share links |
| GET/DELETE | /api/admin/scorecard-share-link/[linkId] | Manage individual link |
| GET | /api/admin/candidates | List candidates |
| GET/PATCH | /api/admin/candidates/[candidateId] | Candidate detail |
| GET/PUT | /api/admin/company-settings | Company configuration |

### 9.4 Master Admin APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/master/auth/login | Master admin login |
| POST | /api/master/auth/logout | Master admin logout |
| GET | /api/master/overview | Platform metrics dashboard |
| GET/POST | /api/master/companies | List/create companies |
| PATCH | /api/master/companies/[companyId]/passcode | Regenerate passcode |
| GET/POST | /api/master/promo-codes | List/create promo codes |
| PATCH | /api/master/promo-codes/[promoCodeId] | Update promo code |
| GET | /api/master/practice-sessions | List practice sessions |
| GET | /api/master/practice-sessions/[sessionId] | Practice session detail |

### 9.5 Public Share APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/share/scorecard/[token]/pdf | Download scorecard PDF |
| POST | /api/ai/generate-questions | AI question generation |
| POST | /api/ai/relevancy | Response relevancy check |

---

## 10. Scope and Exclusions

### 10.1 In Scope (4-Week Delivery)

| Area | Details |
|------|---------|
| Practice interview flow | Domain selection, payment, promo, AI interview, scorecard |
| Company hiring workflow | Requirement creation, candidate invite, interview, scoring, dashboard |
| Admin analytics | Session metrics, trends, filters, candidate management |
| Master platform control | Company management, promo codes, practice monitoring |
| Scorecard sharing | Public links, PDF export, expiry, revocation |
| Production deployment | Hosting, database, email, payment, storage configuration |
| Basic QA | End-to-end flow testing, browser compatibility, error handling |

### 10.2 Out of Scope (Phase 2+)

| Area | Reason |
|------|--------|
| ATS/HRIS integrations (Greenhouse, Lever, Workday) | Requires partnership and integration development |
| Native mobile applications | Current platform is web-only |
| Multi-language interview support | English-first for MVP |
| Advanced RBAC (multiple recruiter roles per company) | Current model is single admin per company |
| SOC2/ISO compliance certification | Requires formal audit process |
| Candidate self-service portal (history, progress) | Not in current architecture |
| White-label/custom branding per company | Not in current architecture |
| Real-time collaboration (multiple interviewers) | Single AI interviewer model only |

---

## 11. Risk Register

| ID | Risk | Probability | Impact | Mitigation |
|----|------|------------|--------|------------|
| R-01 | OpenAI API instability during live interviews | Medium | Critical | Implement graceful disconnect, save transcript, allow manual completion |
| R-02 | Email deliverability issues block candidate participation | High | High | Configure SPF/DKIM/DMARC in Week 1, test with real domains |
| R-03 | Razorpay integration issues in live mode | Low | High | Complete live-mode testing in Week 2, maintain promo-code fallback |
| R-04 | Scoring quality does not meet recruiter expectations | Medium | Medium | Allow re-grading, tune prompts, provide evidence transparency |
| R-05 | Video upload failures on poor connections | Medium | Medium | Make recording optional, save transcript regardless |
| R-06 | Scope creep derails 4-week timeline | High | High | Feature freeze after Week 1, defer all new requests to Phase 2 |
| R-07 | Database migration issues in production | Low | Critical | Test migrations on staging before production deploy |
| R-08 | Browser compatibility issues in interview room | Medium | Medium | Test Chrome, Edge, Firefox; document minimum requirements |
| R-09 | Candidate privacy/consent concerns | Medium | High | Add explicit consent step, document retention policy |
| R-10 | Single developer bandwidth bottleneck | High | High | Prioritize ruthlessly, cut nice-to-haves |

---

## 12. 4-Week Delivery Timeline

### Week 1: Foundation and Audit (Days 1–7)

**Objective:** All flows functional on staging with production-grade configuration.

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| 1 | Full practice flow audit: purchase → interview → scorecard | Dev | Bug list |
| 2 | Full company flow audit: requirement → invite → interview → dashboard | Dev | Bug list |
| 3 | Production environment setup: DB, OpenAI, Razorpay live, SMTP, S3 | Dev/DevOps | .env.production |
| 4 | Database migration to production, seed master admin + test company | Dev | Production DB running |
| 5 | Fix critical authentication and session bugs | Dev | Auth stable |
| 6 | Fix payment verification and webhook handling | Dev | Payments working |
| 7 | Deploy to staging, smoke test all 3 user types | Dev | Staging URL live |

**Exit Criteria:** End-to-end demo on staging without critical failures.

---

### Week 2: Core Flow Polish (Days 8–14)

**Objective:** All user-facing flows stable and reliable.

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| 8 | Practice flow: pricing edge cases, promo validation, error messages | Dev | Practice stable |
| 9 | Invite flow: email template, delivery tracking, expiry handling | Dev | Invites working |
| 10 | Interview room: preflight checks, reconnect logic, transcript saving | Dev | Interview stable |
| 11 | Interview room: timer accuracy, pause/resume, video upload (company) | Dev | Room complete |
| 12 | Scoring: scorecard quality review, regrade flow, question-level grading | Dev | Scoring reliable |
| 13 | Admin dashboard: session list, filters, scorecard view | Dev | Dashboard functional |
| 14 | Scorecard sharing: link generation, PDF export, expiry | Dev | Sharing working |

**Exit Criteria:** 10+ test interviews (practice + company) complete without major failure.

---

### Week 3: Operations, Security & Integration (Days 15–21)

**Objective:** Production-grade infrastructure and security.

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| 15 | Master admin portal: company CRUD, promo codes, monitoring | Dev | Master portal complete |
| 16 | Production email: SES/SendGrid config, SPF/DKIM/DMARC, domain verify | DevOps | Emails delivering |
| 17 | Production payments: Razorpay live mode, webhook, edge cases | Dev | Payments live-ready |
| 18 | Video storage: S3 production bucket, upload/retrieval, cleanup policy | DevOps | Storage configured |
| 19 | Security hardening: secrets audit, session config, HTTPS, cookie flags | Dev | Security checklist done |
| 20 | Error monitoring: logging, basic health checks, error alerts | Dev/DevOps | Monitoring active |
| 21 | Pilot: Run 1 real company interview cycle end-to-end | QA/PM | Pilot report |

**Exit Criteria:** Pilot interview cycle completes on production infrastructure.

---

### Week 4: QA, UAT & Launch (Days 22–30)

**Objective:** Production launch with confidence.

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| 22 | Regression testing: all flows, all user types | QA | Test report |
| 23 | Browser testing: Chrome, Edge, Firefox, mobile browsers | QA | Compatibility matrix |
| 24 | Load testing: concurrent interviews, bulk invite sending | QA/Dev | Performance baseline |
| 25 | UAT with stakeholders/pilot clients | PM | Feedback list |
| 26 | Critical bug fixes from UAT feedback | Dev | Bugs resolved |
| 27 | Documentation: deployment runbook, support guide | Dev | Docs complete |
| 28 | Final production deploy: DNS, SSL, env verification | DevOps | Production live |
| 29 | Launch communications: notify pilot clients | PM | Launch announced |
| 30 | Hypercare: monitor, hotfix, support | Dev | Stable 24hr window |

**Exit Criteria:** Production live, no P0 bugs, pilot clients onboarded.

---

## 13. Acceptance Criteria

### 13.1 Practice Interview

- [ ] User can select domain, duration, and complete payment in under 2 minutes
- [ ] Promo code redemption works for valid, active codes
- [ ] AI interview starts within 5 seconds of room entry
- [ ] Full transcript is captured and saved
- [ ] Scorecard is generated immediately upon completion
- [ ] Scorecard displays overall score + 3 dimension scores + summary

### 13.2 Company Interview

- [ ] Admin can create a requirement with questions in under 5 minutes
- [ ] Bulk invite sends emails to all valid addresses with unique codes
- [ ] Candidate can join interview using access code + email verification
- [ ] Video recording uploads successfully (company sessions)
- [ ] Completed session appears in admin dashboard with score
- [ ] Admin can generate a shareable scorecard link
- [ ] Shared link displays scorecard and allows PDF download
- [ ] Shared link expires after configured TTL

### 13.3 Master Admin

- [ ] Master admin can log in, view all companies, create new company
- [ ] Master admin can activate/deactivate companies
- [ ] Master admin can create and manage promo codes
- [ ] Platform overview shows accurate metrics

### 13.4 Non-Functional

- [ ] No critical security vulnerabilities in auth/payment flows
- [ ] Pages load within 3 seconds on standard connections
- [ ] System handles 5+ concurrent interview sessions
- [ ] All error states show user-friendly messages
- [ ] System recovers from page refresh during interview

---

## 14. Appendix

### 14.1 Environment Variables Required

```
# Application
NEXT_PUBLIC_APP_URL

# Database
DATABASE_URL
DIRECT_URL

# Authentication
ADMIN_PORTAL_KEY
MASTER_ADMIN_KEY
COMPANY_SESSION_SECRET
MASTER_SESSION_SECRET
CANDIDATE_INTERVIEW_SESSION_SECRET

# AI
OPENAI_API_KEY
SCORING_MODE
SCORING_MODEL

# Payments
RAZORPAY_KEY_ID
NEXT_PUBLIC_RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
PRACTICE_BASE_PRICE_RUPEES

# Storage
VIDEO_STORAGE_PROVIDER
AWS_REGION
AWS_S3_BUCKET
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY

# Email
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
SMTP_SEND_DELAY_MS
```

### 14.2 Page Routes

| Route | Purpose |
|-------|---------|
| / | Marketing landing page |
| /about | About page |
| /contact | Contact form |
| /privacy | Privacy policy |
| /terms | Terms of service |
| /practice | Practice interview purchase |
| /candidate | Candidate access code entry |
| /interview/[sessionId] | Live interview room |
| /company-login | Company admin login |
| /admin | Company admin dashboard |
| /master-login | Master admin login |
| /master | Master admin dashboard |
| /master/overview | Platform overview |
| /master/companies | Company management |
| /master/promo-codes | Promo code management |
| /master/practice-sessions | Practice session list |
| /share/scorecard/[token] | Public scorecard view |

### 14.3 Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-20 | Engineering | Initial SRS based on current codebase review |

---

*End of Document*
