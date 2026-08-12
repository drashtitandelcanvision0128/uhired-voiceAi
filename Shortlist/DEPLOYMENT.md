# Deployment and Database Operations (Vercel + Supabase + Razorpay)

## Environment Matrix
- **Local development:** Postgres database (local Postgres or Supabase project) with `prisma migrate dev`.
- **Preview/staging:** Postgres database with `prisma migrate deploy` during deploy pipeline.
- **Production:** Supabase Postgres with `prisma migrate deploy` only.

Use `db:push` for temporary local prototyping only. Do not use `db:push` in preview or production environments.

## 1) Create the database (Supabase)
- Create a Supabase project in your preferred region.
- Copy both Supabase Postgres connection strings:
  - `DATABASE_URL`: pooled/session mode URL for runtime traffic.
  - `DIRECT_URL`: direct connection URL for Prisma migrations and tooling.
- Ensure the connection string includes `?schema=public`.

## 2) Create the Vercel project
- Import this repository into Vercel.
- Keep the project root at the repository root (`AIShortlist`).
- Configure your preferred functions region (for India, use `bom1`).

## 3) Set environment variables
Set these in Vercel (`Project -> Settings -> Environment Variables`) for Preview and Production:

Required:
- `DATABASE_URL` = Supabase pooled/session Postgres URL
- `DIRECT_URL` = Supabase direct Postgres URL
- `SUPABASE_URL` = `https://<project-ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase service role key (server-only)
- `SUPABASE_STORAGE_BUCKET` = `interview-videos`
- `VIDEO_STORAGE_PROVIDER` = `s3` (recommended) or `supabase`
- `AWS_REGION` = AWS region where S3 bucket is created
- `AWS_S3_BUCKET` = S3 bucket name for recordings
- `AWS_ACCESS_KEY_ID` = AWS IAM access key (server-only)
- `AWS_SECRET_ACCESS_KEY` = AWS IAM secret key (server-only)
- `AWS_S3_ENDPOINT` = optional (leave blank for AWS S3, set for S3-compatible storage)
- `OPENAI_API_KEY` = your OpenAI API key
- `SCORING_MODE` = `rubric` (recommended) or `heuristic` fallback-only mode
- `SCORING_MODEL` = `gpt-4.1-mini` (mid-tier scoring model)

Payments (Razorpay):
- `PAYMENTS_ENABLED` = `true`
- `NEXT_PUBLIC_PAYMENTS_ENABLED` = `true`
- `INTERVIEW_PRICE_PAISE` = `2500`
- `INTERVIEW_CURRENCY` = `INR`
- `RAZORPAY_KEY_ID` = Razorpay key id
- `RAZORPAY_KEY_SECRET` = Razorpay key secret
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` = Razorpay key id (public)
- `RAZORPAY_WEBHOOK_SECRET` = Razorpay webhook secret

Optional:
- `NEXT_PUBLIC_APP_URL` = deployed app URL
- `NEXT_PUBLIC_INTERVIEW_DURATION_SEC` = `600`
- `NEXT_PUBLIC_INTERVIEW_PRICE_PAISE` = `2500`
- `NEXT_PUBLIC_INTERVIEW_CURRENCY` = `INR`
- `EMAIL_PROVIDER` = `ses` (recommended on staging/production; see section 9)
- `SMTP_FROM_EMAIL` / `SMTP_FROM_NAME` = verified sender identity in SES

## 4) Migration Workflow

### Local development
```powershell
npm run db:generate
npm run db:migrate
```

For Supabase-based development, set both `DATABASE_URL` and `DIRECT_URL` in `.env`.

### Coolify (Docker) — automatic migrations
When you deploy with the repo `Dockerfile`, the container runs `prisma migrate deploy` on startup before `node server.js`. You do **not** need to open the Coolify terminal for migrations after each deploy.

Requirements in Coolify environment variables:
- `DATABASE_URL` — pooled Postgres URL (runtime)
- `DIRECT_URL` — direct Postgres URL (migrations; required for Supabase)

After you push new files under `prisma/migrations/`, redeploy once; pending migrations apply automatically. If a migration fails, the container exits and the deploy fails (so the app does not start on a mismatched schema).

### CI/CD or manual server deploy
```powershell
npm run db:migrate:deploy
```

Use both URLs in deploy environments:
- Runtime app uses `DATABASE_URL`.
- Prisma migrate uses `DIRECT_URL` when available.

### Inspect migration status
```powershell
npm run db:migrate:status
```

## 5) SQLite to Postgres Cutover Checklist

1. Backup existing SQLite data:
   - Keep a copy of `prisma/dev.db` and any recent filesystem exports.
2. Create target Postgres database:
   - Provision Supabase or local Postgres and set `DATABASE_URL`.
3. Apply schema through migrations:
   - Run `npm run db:migrate:deploy` against target Postgres.
4. Export and import operational data:
   - Export SQLite tables, transform if required, then import into Postgres in FK-safe order.
5. Run verification checks:
   - Compare row counts across `Company`, `Requirement`, `Candidate`, `InterviewSession`, `InterviewTurn`, `Scorecard`, and `PracticePayment`.
6. Smoke test critical APIs:
   - Candidate verify flow, company requirement/session creation, interview completion, and payment verify/start flow.
7. Rollback path:
   - If validation fails, point `DATABASE_URL` back to the previous database, redeploy, and restore from backup before retrying.

## 6) Post-Deploy Verification
- Visit the deployed site.
- Complete a payment and ensure interview creation succeeds.
- Run admin dashboard and company workflow checks to confirm reads/writes.
- Run one company interview and verify the recording opens in the admin detail modal.

## 7) Interview Recording Storage (S3 with Supabase Fallback)
- Recording uploads use S3 when `VIDEO_STORAGE_PROVIDER=s3` and AWS vars are configured.
- Read path is migration-safe: S3 -> Supabase Storage -> local filesystem.
- This keeps old Supabase recordings playable during migration while new uploads go to S3.
- If S3 is unavailable, set `VIDEO_STORAGE_PROVIDER=supabase` to rollback quickly.

## 8) S3 Setup (AWS)
1. Create an S3 bucket (recommended private).
2. Create an IAM user with bucket-scoped permissions: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket`.
3. Add AWS env vars in deployment platform.
4. Redeploy and run one interview to validate upload/playback.
5. Optionally run backfill script to copy historical recordings from Supabase to S3.

### Backfill existing recordings
Run this once after S3 is configured to migrate old Supabase recordings:

```powershell
npm run storage:backfill:supabase-to-s3
```

Phased cutover:
1. Deploy with `VIDEO_STORAGE_PROVIDER=s3` and keep Supabase vars present.
2. Run backfill command.
3. Verify random old and new recordings playback in admin UI.
4. Keep Supabase fallback temporarily for safety, then remove later if desired.

## 9) Interview Invite Email (AWS SES)

Staging and production must **not** use Mailpit/Mailtrap capture SMTP — those accept messages but never deliver to real candidate inboxes.

### Recommended: AWS SES API
If `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` are already set (for S3), add:

- `EMAIL_PROVIDER=ses`
- `SMTP_FROM_EMAIL=no-reply@uhired.in` (must be verified in SES)
- `SMTP_FROM_NAME=Uhired`

When `SMTP_HOST` points at Mailpit/Mailtrap (or port `1025`/`8025`) and `NODE_ENV=production`, the app automatically uses SES if AWS credentials are present.

### SES setup checklist
1. Verify `uhired.in` (or `no-reply@uhired.in`) in AWS SES (ap-south-1).
2. Request SES production access (sandbox only delivers to verified addresses).
3. Ensure IAM user has `ses:SendEmail` permission.
4. Add SPF/DKIM/DMARC DNS records for `uhired.in`.

### Alternative: AWS SES SMTP
Set `EMAIL_PROVIDER=smtp`, `SMTP_DELIVERY_MODE=live`, and SES SMTP credentials:

- `SMTP_HOST=email-smtp.ap-south-1.amazonaws.com`
- `SMTP_PORT=587`
- `SMTP_USER` / `SMTP_PASS` from SES SMTP credentials

### Local development
Mailpit/Mailtrap is fine locally. The admin UI shows **Dev inbox only — not delivered** instead of a false success.

## 10) Supabase Quickstart

1. Create a Supabase project and open `Project Settings -> Database`.
2. Copy:
   - Connection pooling string into `DATABASE_URL`
   - Direct connection string into `DIRECT_URL`
3. Run migrations:
   ```powershell
   npm run db:migrate:deploy
   ```
4. Start app:
   ```powershell
   npm run dev
   ```

## 11) Provider Compatibility Notes (SQLite -> Postgres)
- No raw SQL usage was found in API code, so Prisma portability is strong.
- Main migration risk is concurrency races in "check then create" paths (access code generation and payment/session linking).
- If you observe intermittent unique constraint failures (`P2002`) after cutover, add retry-on-conflict handling around those writes.

## 12) Scoring Modes
- Interview completion now saves transcript + heuristic score immediately (`scoringMode=heuristic-immediate`).
- LLM rubric scoring runs asynchronously via batch jobs and replaces score when successful (`scoringMode=rubric-batch`).
- Batch worker commands:
  - `npm run scoring:batch:submit` (enqueue pending jobs to OpenAI Batch)
  - `npm run scoring:batch:sync` (poll completed batches and apply results)
- Retry behavior:
  - Failed batch jobs are retried up to 3 times.
  - If all retries fail, heuristic score remains as permanent fallback.

