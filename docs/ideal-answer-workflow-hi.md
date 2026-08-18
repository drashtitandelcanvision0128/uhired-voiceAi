# Ideal Answer + Grading — Full Workflow

This document explains what happens after an interview ends: **question -> candidate answer -> ideal/model answer -> score**, and how to improve output quality.

> **The truth about "100% perfect":** because of speech-to-text noise, voice variation, and normal LLM variation, a **word-for-word 100% match** is not always realistic. The system is designed around **intent alignment** rather than literal matching. A good microphone, a clean transcript, and strong role/JD/skills context usually produce **very high practical accuracy**.

---

## Step by Step — What Happens in the App

### Stage 0 — Before the Interview (Admin setup)

1. The company admin creates the requirement: **target role**, **job description**, **key skills**, and topic/mandatory questions.
2. This context helps keep ideal answers tied to the **actual hiring situation** instead of becoming generic.

### Stage 1 — Live Interview

1. The candidate takes a real-time voice interview.
2. The AI interviewer asks questions naturally, and the conversation is saved as a **transcript**.

### Stage 2 — Interview Complete (`POST /api/interview/[sessionId]/complete`)

1. The transcript received from the client, if present, is merged into the database.
2. **Q&A extraction:**
   - Substantive **question-answer pairs** are extracted from the transcript using models plus heuristics. See `extract-transcript-qa` and `transcript-grading-questions`.
   - If no usable Q&A pairs are found, the **admin topic list** is used as a fallback. Ideal answers are still generated fresh.
3. **Ideal answer generation:**
   - For each question that does not already have an ideal answer, OpenAI generates **one ideal answer** based on the actual transcript question, plus role, JD, skills, and transcript snippet if needed.
   - This is **not** copy-pasted from an admin answer bank. It is generated again with context.
4. **Grading:**
   - The candidate answer is compared against the ideal answer and rubric categories. Scores, feedback, and **accuracyPercent** are merged into the scorecard through `question-grading`.
5. The session is marked **COMPLETED**, and the scorecard is persisted in the database.

### Stage 3 — Admin Review

In session details or shared scorecards, the admin can see: **question, ideal answer, candidate answer, and feedback**.

### Stage 4 — Regrading Old Sessions (`POST /api/admin/session/[sessionId]/regrade`)

If the grading logic changes after deployment, a completed session can be **re-graded**. The system regenerates ideals and grades again from the transcript.

---

## Pros and Cons — and How to Reduce Risk

| Pros | Why it helps |
|------|--------------|
| Transcript-first | Grading is based on what was **actually asked**, which is more honest than relying on a scripted list. |
| Per-question ideal | Each question gets its own ideal answer, reducing prompt/answer mix-ups in batch grading. |
| Snippet context | Follow-up or ambiguous questions can be understood using nearby transcript context. |

| Cons | Mitigation |
|------|------------|
| API latency + cost (N questions = multiple calls) | Use a parallel cap such as `concurrency: 3`; reduce question count when appropriate. |
| Poor transcript quality leads to poor extraction | Use a clear microphone, reduce background noise, and send the full transcript on completion. |
| Fallback agenda when transcript is empty or weak | Keep requirement-level mandatory questions clear and specific. |

---

## Quality Checklist

| Item | Why it matters |
|------|----------------|
| `OPENAI_API_KEY` is set | Required for both ideal generation and grading. |
| Strong **role + JD + skills** | Reduces generic ideals and improves role-specific output. |
| Optional: better `SCORING_MODEL` | Usually improves quality, but may increase cost. |
| Send the **transcript** when the interview ends | Better transcript turns in the database improve extraction quality. |

---

## Testing — What a Developer Can Run

1. **Lint:** `npm run lint` — checks code quality and syntax.
2. **Regrade API smoke test** (requires a dev server + admin cookie):
   `node scripts/test-grading-pipeline.mjs <sessionId>`
   Env: `TEST_BASE_URL` (default `http://localhost:3000`) and `ADMIN_COOKIE`.
3. **Direct pipeline from DB** (Prisma + dynamic TS import):
   `node scripts/run-session-regrade-test.mjs <sessionId>` — requires DB URL in `.env`.
4. Other useful scripts: `test-transcript-extract.mjs`, `test-openai-ideal.mjs`, `check-question-grading.mjs`, `debug-session-grading.mjs`.

English short version: [`ideal-answer-workflow.md`](./ideal-answer-workflow.md)
