# Uhired (Shortlist) — AI Interview Platform

**Uhired** is an AI-powered interview practice and hiring workflow platform. Candidates can take paid mock interviews here, and companies can manage their hiring process — including role requirements, candidate invites, live AI interviews, scoring, and shareable scorecards.

**Live URL:** [uhired.in](https://uhired.in)

---

## For Users — Login, Register & Roles (Start Here)

**New to Uhired?** Read the simple user guide first:

**[docs/USER-GUIDE.md](docs/USER-GUIDE.md)** — Hindi/English guide: kaun kya kar sakta hai, login kaise karein, register kaise karein.

### Quick reference

| I am a… | Login / Entry | Register? |
|---------|---------------|-----------|
| **Company / Recruiter** | [/company-login](https://uhired.in/company-login) → `/admin` | Yes → [/company-register](https://uhired.in/company-register) |
| **Job Candidate** (invited) | Email invite link → [/candidate](https://uhired.in/candidate) | No — use invite code + email |
| **Practice user** (mock interview) | [/practice](https://uhired.in/practice) | No account — pay & start |
| **Master Admin** (Uhired team) | [/master-login](https://uhired.in/master-login) → `/master` | No public signup |
| **Visitor** | [/](https://uhired.in) homepage | Not required |

### Company login (recruiter)

1. Go to **https://uhired.in/company-login**
2. Enter: **Company name**, **Domain**, **Admin email**, **Passcode**
3. Click **Continue to Admin Portal** → you land on `/admin`

### Company register (new hiring company)

1. Go to **https://uhired.in/company-register**
2. Fill: company name, domain, admin email, passcode (twice)
3. Submit → auto-login to admin dashboard

### Candidate (invited for interview)

1. Open the link from your invite email (`/candidate?code=...`)
2. Enter: **interview code**, **full name**, **same email** that received the invite
3. Click **Start My Interview** — no password needed

### Master admin (platform operator only)

1. Go to **https://uhired.in/master-login**
2. Enter master admin email + passcode (provided by Uhired team)

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Key Features](#key-features)
- [User Roles](#user-roles)
- [Project Structure](#project-structure)
- [Routes & Pages](#routes--pages)
- [API Endpoints](#api-endpoints)
- [Database Models](#database-models)
- [External Integrations](#external-integrations)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Deployment](#deployment)
- [Testing](#testing)

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router) |
| **Language** | TypeScript |
| **UI** | React 19, Tailwind CSS 4 |
| **UI Components** | Radix UI, Lucide Icons, Framer Motion |
| **Database** | PostgreSQL (Supabase) |
| **ORM** | Prisma 6 |
| **AI / LLM** | OpenAI (Realtime API, GPT-4.1-mini scoring, embeddings) |
| **Payments** | Razorpay |
| **Email** | Nodemailer (SMTP) / AWS SES |
| **File Storage** | AWS S3 / Supabase Storage (local dev) |
| **PDF Generation** | pdf-lib |
| **Validation** | Zod |
| **Face Detection** | MediaPipe (client-side) |
| **Deployment** | Docker / Coolify / Vercel |

---

## Key Features

### Marketing Website
- Professional **Home** page with hero, features, demo preview, and CTA
- **About Us**, **Contact Us**, **Privacy Policy**, **Terms** pages
- Shared marketing header/footer across public pages
- SEO metadata on public routes
- Interactive booking / session preview components

### Practice Interviews (B2C)
- Self-service AI mock interview sessions
- Domain and topic selection (PM, Engineering, Sales, etc.)
- **Razorpay** payment integration (INR)
- Promo code support
- Real-time AI interviewer via **OpenAI Realtime API**
- Post-interview **scorecard** with communication, domain depth, confidence scores

### Company Hiring Workflow (B2B)
- Company registration and admin login (passcode-based auth)
- **Requirements** creation — job role, domain, questions, duration, job description
- AI-powered **question generation** from job description
- **Candidate invites** via email (SMTP/SES) with unique access codes
- Bulk email invite with verification
- Admin dashboard — manage sessions, candidates, and requirements
- **Scorecard sharing** via expiring public links (PDF download)
- Session regrade capability
- Company interviewer profile (name, voice gender)

### Live AI Interview Room
- Real-time voice conversation with AI interviewer
- **Voice Activity Detection (VAD)** — smart silence detection
- Speech-to-text transcription with confidence validation
- Video recording with S3/local storage
- Face detection during interview (MediaPipe)
- Transcript timeline with timestamps
- Interview timer and duration management
- Conversation state management

### Scoring & Evaluation
- Rubric-based AI scoring (`gpt-4.1-mini`)
- Per-question grading with expected answers and rubrics
- Semantic evaluation via embeddings
- Response relevancy checking
- Batch scoring jobs for async processing
- Scorecard PDF generation with company logo

### Master Admin Portal
- Platform-wide overview dashboard
- Company management (create, activate/deactivate, passcode reset)
- Promo code management
- Practice session monitoring

### Public Scorecard Sharing
- Token-based shareable scorecard links
- PDF download
- Expiry and revocation support
- Optional candidate name inclusion

---

## User Roles

| Role | Who | Login / Entry | Register? |
|------|-----|---------------|-----------|
| **Visitor** | Anyone | `/` homepage | No |
| **Practice Candidate** | Self-serve mock interview | `/practice` | No account |
| **Company Admin (Recruiter)** | HR / hiring team | `/company-login` → `/admin` | Yes: `/company-register` |
| **Invited Candidate** | Job applicant | `/candidate?code=...` | No — invite only |
| **Master Admin** | Platform operator | `/master-login` → `/master` | Internal only |

**Full user guide:** [docs/USER-GUIDE.md](docs/USER-GUIDE.md)

---

## Project Structure

```
Shortlist/
├── prisma/
│   ├── schema.prisma          # Database schema (14 models)
│   └── migrations/            # Prisma migration history
├── public/
│   └── marketing/             # Marketing images & assets
├── scripts/                   # DB seeds, E2E tests, backfill, scoring batch
├── src/
│   ├── app/
│   │   ├── page.tsx           # Marketing home
│   │   ├── about/             # About page
│   │   ├── contact/           # Contact page
│   │   ├── practice/          # Practice interview flow
│   │   ├── admin/             # Company admin dashboard
│   │   ├── candidate/         # Candidate invite verification
│   │   ├── interview/         # Live interview room
│   │   ├── master/            # Master admin portal
│   │   ├── share/             # Public scorecard sharing
│   │   └── api/               # 48+ API route handlers
│   ├── components/
│   │   ├── marketing/         # Site header, footer, contact form, animations
│   │   ├── ui/                # Button, input, card, textarea
│   │   ├── admin-dashboard.tsx
│   │   ├── company-interview-room.tsx
│   │   └── scorecard-share-public.tsx
│   └── lib/                   # 85+ server/client utility modules
│       ├── openai.ts          # OpenAI client
│       ├── scoring.ts         # Interview scoring logic
│       ├── realtime-session.ts # Realtime API session management
│       ├── razorpay.ts        # Payment integration
│       ├── email.ts           # Email delivery
│       ├── interview-video-storage.ts
│       ├── voice-activity-detection.ts
│       ├── company-admin-auth.ts
│       ├── master-auth.ts
│       └── ...
├── middleware.ts              # Company admin route protection
├── Dockerfile                 # Production Docker build
├── DEPLOYMENT.md              # Deployment guide
└── REQUIREMENTS.txt           # Project requirements document
```

---

## Routes & Pages

### Public / Marketing
| Route | Description |
|-------|-------------|
| `/` | Marketing home page |
| `/about` | About Us |
| `/contact` | Contact form |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
| `/practice` | Practice interview + Razorpay payment |
| `/share/scorecard/[token]` | Public scorecard view |

### Authentication
| Route | Description |
|-------|-------------|
| `/company-login` | Company admin login |
| `/company-register` | Company registration |
| `/company-login/forgot-passcode` | Passcode recovery |
| `/master-login` | Master admin login |
| `/candidate` | Candidate invite verification |

### Protected (Company Admin)
| Route | Description |
|-------|-------------|
| `/admin` | Company admin dashboard |
| `/sessions` | Session management |
| `/profile` | Company profile settings |

### Protected (Master Admin)
| Route | Description |
|-------|-------------|
| `/master` | Master admin home |
| `/master/overview` | Platform overview |
| `/master/companies` | Company management |
| `/master/promo-codes` | Promo code management |
| `/master/practice-sessions` | Practice session monitoring |

### Interview
| Route | Description |
|-------|-------------|
| `/interview/[sessionId]` | Live AI interview room |

---

## API Endpoints

### AI
- `POST /api/ai/generate-questions` — Generate questions from job description
- `POST /api/ai/relevancy` — Response relevancy check

### Practice & Payments
- `POST /api/practice/start` — Practice session start
- `POST /api/practice/payment/order` — Razorpay order create
- `POST /api/practice/payment/verify` — Payment verification
- `POST /api/practice/payment/webhook` — Razorpay webhook

### Interview
- `GET/POST /api/interview/[sessionId]` — Session management
- `POST /api/interview/[sessionId]/turn` — Conversation turn
- `POST /api/interview/[sessionId]/realtime` — Realtime API session
- `POST /api/interview/[sessionId]/complete` — Interview complete
- `GET/POST /api/interview/[sessionId]/video` — Video recording
- `GET /api/interview/[sessionId]/details` — Session details

### Company Admin (`/api/admin/*`)
- Requirements CRUD, candidate invites, session management
- Dashboard data, company settings, scorecard sharing
- Email verification, session regrade

### Company Auth
- `POST /api/company-auth/login`, `logout`, `register`
- `GET /api/company-auth/session`

### Candidate
- `POST /api/candidate/verify` — Invite code verification

### Master Admin (`/api/master/*`)
- Companies, promo codes, practice sessions, overview

### Share
- `GET /api/share/scorecard/[token]/pdf` — Scorecard PDF download

### Contact
- `POST /api/contact` — Contact form submission

---

## Database Models

| Model | Purpose |
|-------|---------|
| `Company` | Hiring company accounts |
| `Requirement` | Job role configurations |
| `RequirementQuestion` | Per-requirement interview questions |
| `RequirementInvite` | Email invites with access codes |
| `Candidate` | Company candidate records |
| `InterviewSession` | Practice & company interview sessions |
| `InterviewQuestion` | Session-specific questions |
| `InterviewTurn` | Conversation transcript turns |
| `Scorecard` | Post-interview evaluation scores |
| `ScorecardShareLink` | Public shareable scorecard links |
| `PracticePayment` | Razorpay payment records |
| `PromoCode` | Discount/promo codes |
| `ScoringBatchJob` | Async AI scoring jobs |

---

## External Integrations

| Service | Usage |
|---------|-------|
| **OpenAI** | Realtime voice interviews, question generation, rubric scoring, embeddings |
| **Razorpay** | Practice interview payments (INR) |
| **PostgreSQL (Supabase)** | Primary database |
| **AWS S3** | Interview video storage (production) |
| **Supabase Storage** | Legacy video storage / backfill |
| **SMTP (GoDaddy/Mailtrap)** | Candidate invite emails |
| **AWS SES** | Production email delivery |
| **MediaPipe** | Client-side face detection during interviews |

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database (Supabase Postgres)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Auth
ADMIN_PORTAL_KEY=change-me
MASTER_ADMIN_KEY=change-me-master

# OpenAI
OPENAI_API_KEY=sk-...
SCORING_MODE=rubric
SCORING_MODEL=gpt-4.1-mini
EMBEDDING_MODEL=text-embedding-3-small

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxx
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
PRACTICE_BASE_PRICE_RUPEES=25

# Video Storage
VIDEO_STORAGE_PROVIDER=local   # local | s3
AWS_REGION=ap-south-1
AWS_S3_BUCKET=uhired-videos
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Email
EMAIL_PROVIDER=smtp            # smtp | ses
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=465
SMTP_USER=no-reply@uhired.in
SMTP_PASS=...
SMTP_FROM_EMAIL=no-reply@uhired.in
SUPPORT_EMAIL=support@uhired.in
INVITE_EMAIL_BASE_URL=https://uhired.in
```

Full list: see [`.env.example`](.env.example)

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database (local ya Supabase)
- OpenAI API key
- Razorpay test keys (practice payments ke liye)

### Setup

```bash
# 1. Dependencies install
npm install

# 2. Environment configure
cp .env.example .env
# Set your values in the .env file

# 3. Database setup
npm run db:generate
npm run db:migrate

# 4. (Optional) Dev admin seed
npm run db:seed:dev-admin

# 5. Development server start
npm run dev
```

Open the app at [http://localhost:3000](http://localhost:3000)

---

## Available Scripts

### Development
| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server start |
| `npm run lint` | ESLint check |

### Database
| Command | Description |
|---------|-------------|
| `npm run db:generate` | Prisma client generate |
| `npm run db:migrate` | Local migration create/apply |
| `npm run db:migrate:deploy` | Production migrations apply |
| `npm run db:migrate:status` | Migration status check |
| `npm run db:push` | Schema sync (local prototyping only) |
| `npm run db:studio` | Prisma Studio GUI |
| `npm run db:seed:dev-admin` | Dev admin account seed |

### Operations
| Command | Description |
|---------|-------------|
| `npm run storage:backfill:supabase-to-s3` | Migrate videos from Supabase to S3 |
| `npm run scoring:batch:submit` | Batch scoring jobs submit |
| `npm run scoring:batch:sync` | Batch scoring results sync |

### Testing
| Command | Description |
|---------|-------------|
| `npm run test:qa` | **Full QA suite** (all automated platform tests) |
| `npm run test:interview:unit` | Interview unit tests |
| `npm run test:interview:e2e` | Interview E2E tests |
| `npm run test:interview:all` | Full interview test suite |

---

## Deployment

Production deployment guide: [`DEPLOYMENT.md`](DEPLOYMENT.md)

**Supported platforms:**
- **Docker / Coolify** — `Dockerfile` with auto-migration on startup
- **Vercel** — Serverless deployment with Supabase Postgres
- **Manual** — `npm run build && npm run start`

**Production checklist:**
1. Supabase Postgres setup (`DATABASE_URL` + `DIRECT_URL`)
2. AWS S3 bucket for video storage
3. Razorpay live keys + webhook
4. OpenAI API key with sufficient quota
5. SMTP/SES for invite emails
6. `npm run db:migrate:deploy`

---

## Testing

The project includes a comprehensive interview testing suite:

- **Unit tests** — conversation state, speech transcription, VAD, transcript confidence
- **E2E tests** — full interview flow simulation
- **QA scripts** — Razorpay checkout, admin dashboard, camera-off scoring

Test artifacts: `docs/qa-artifacts/`

---

## Documentation

| File | Description |
|------|-------------|
| [**docs/USER-GUIDE.md**](docs/USER-GUIDE.md) | **User guide** — roles, login, register (easy language) |
| [docs/QA-TESTER-HANDBOOK.md](docs/QA-TESTER-HANDBOOK.md) | QA tester handbook (all use cases) |
| [docs/USER-JOURNEY-DD.md](docs/USER-JOURNEY-DD.md) | User journey design document |
| [`REQUIREMENTS.txt`](REQUIREMENTS.txt) | Project requirements & timeline |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Deployment & database operations |
| [docs/QA-Step-by-Step-Test-Guide.md](docs/QA-Step-by-Step-Test-Guide.md) | Step-by-step manual QA |
| [`docs/Uhired-SRS.md`](docs/Uhired-SRS.md) | Software Requirements Specification |
| [`docs/ideal-answer-workflow.md`](docs/ideal-answer-workflow.md) | Ideal answer generation workflow |

---

## License

Private — All rights reserved.
