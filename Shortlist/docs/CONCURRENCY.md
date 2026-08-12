# Concurrency & scaling (Uhired)

## Where the app can slow down or fail

| Risk | Cause | Fix |
|------|--------|-----|
| **DB pool timeout (P2024)** | Too many parallel API calls vs `connection_limit` | `DATABASE_CONNECTION_LIMIT=20` on Docker/VPS |
| **OpenAI Realtime limit** | 20–35 simultaneous voice sessions | OpenAI tier / billing limits |
| **Interview complete slow** | Large transcript + scoring at end | Normal; runs in background (`after`) |
| **Admin dashboard + interviews** | Shared DB pool | Raise pool; avoid heavy reports during peak |

## What we optimized in code

- Default DB pool **15** (was 5) on long-running Node
- **Prisma retry** on pool timeouts (interview start / complete / status)
- **Slimmer queries** on realtime start (no transcript load)
- **Larger prompt cache** (256 sessions)
- **Complete route** no longer loads all turns before merge

## Recommended production `.env`

```env
DATABASE_CONNECTION_LIMIT=20
DATABASE_POOL_TIMEOUT=30
VIDEO_STORAGE_PROVIDER=s3
```

## Load test

```bash
npm run test:load
# optional: LOAD_TEST_CONCURRENT=35 npm run test:load
```

## Capacity guide

| Hosting | Safe concurrent interviews |
|---------|---------------------------|
| Local dev | 2–5 |
| VPS 2GB, pool 15 | 15–25 |
| VPS 4GB+, pool 20 | 25–40 |
| + OpenAI limits | check OpenAI dashboard |

Voice streams go **direct to OpenAI** — Uhired server handles tokens, status, video upload URLs, and complete/scoring.
