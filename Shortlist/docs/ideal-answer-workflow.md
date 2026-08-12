# Ideal answers & grading — workflow

This document describes how spoken questions align with stored **ideal answers** after an interview completes, and how to maximize quality.

## End-to-end flow

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. ADMIN SETUP                                                  │
│    Target role · Key skills · Job description · Topic questions    │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. LIVE INTERVIEW (Realtime OpenAI voice)                         │
│    AI asks naturally · Candidate answers · Transcript persisted     │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. INTERVIEW COMPLETE (POST /api/interview/.../complete)         │
│    a) transcript → substantive Q&A pairs (model + heuristic)      │
│    b) for each QUESTION lacking ideal:                             │
│        OpenAI generates ONE ideal · optional local transcript snip │
│        (no “bank” match copying from admin wording)               │
│    c) compare candidate vs ideal · scores → scorecard               │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. ADMIN SESSION DETAILS                                        │
│    Question · Ideal answer · Candidate answer · Feedback            │
└─────────────────────────────────────────────────────────────────┘
```

## What is *not* happening

| Myth | Reality |
|------|---------|
| Ideal is copied from a public question bank | No — ideal is produced for **this transcript question** (+ role/JD/skills). |
| 100 % literal match to wording | Models + speech/STT variance mean **intent alignment**, not byte-perfect text. |

## Configuration checklist (quality)

| Item | Why |
|------|-----|
| `OPENAI_API_KEY` set | Required for ideals + grading. |
| Good **role + JD + skills** | Grounds ideals in hiring context (less generic answers). |
| Clear mic / low noise | Better transcript ⇒ better extracted questions. |
| `SCORING_MODEL` optional | Stronger models often improve ideals and grades (cost ↑). |

## Testing (local)

| Command | Purpose |
|--------|---------|
| `npm run lint` | ESLint across the repo. |
| `node scripts/test-grading-pipeline.mjs <sessionId>` | HTTP POST to `.../regrade` (needs running app + `ADMIN_COOKIE`, optional `TEST_BASE_URL`). |
| `node scripts/run-session-regrade-test.mjs <sessionId>` | Loads session from DB and runs ideal + grading libs (needs `.env` DB + `OPENAI_API_KEY`). |

Hindi / Hinglish step-by-step + pros/cons: [`ideal-answer-workflow-hi.md`](./ideal-answer-workflow-hi.md).

## Re-grade old sessions

After logic changes deploy, open **Company admin → Session → Generate answer review / Re-run answer grading** to rebuild ideals and grades from saved transcript.

## Pros & cons — per-question ideal + transcript excerpt

### Pros

- **Higher alignment**: one OpenAI response per question removes batch prompt–answer mix-ups.
- **More context**: a short excerpt around where the interviewer asked improves follow-up / ambiguous questions.

### Cons

- **Latency & cost**: N questions ⇒ up to N extra API calls per completion (calls run in parallel with a concurrency cap).
- **Still bounded by transcript quality**: garbled speech or missing turns still hurts extraction.
