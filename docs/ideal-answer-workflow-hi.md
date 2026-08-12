# Ideal answer + grading — पूरा workflow (हिंदी / Hinglish)

यह दस्तावेज़ बताता है कि इंटरव्यू खत्म होने के बाद **सवाल → उम्मीदवार का जवाब → ideal (मॉडल) जवाब → स्कोर** कैसे बनते हैं, और quality कैसे बढ़ाएँ।

> **«100% perfect» के बारे में सच:** speech-to-text, voice वариशन, और LLM की स्वभाविक variation की वजह से **शब्द-दर-शब्द 100% match** हमेशा नहीं होगा। सिस्टम **intent alignment** (मुद्दा सही पकड़ना) पर काम करता है। अच्छा माइक, साफ transcript, मज़बूत role/JD/skills से practical में **बहुत ऊँची accuracy** मिलती है।

---

## Step-by-step — app में क्या होता है

### चरण 0 — पहले से (Admin)

1. Company admin requirement बनाता है: **target role**, **job description**, **key skills**, topic / mandatory questions।  
2. यह context बाद में ideal answers को generic नहीं, **आपकी hiring situation** से जोड़ता है।

### चरण 1 — Live interview

1. Candidate realtime voice interview देता है।  
2. Interviewer AI natural तरीके से पूछता है; बातचीत **transcript** के रूप में save होती है।

### चरण 2 — Interview complete (`POST /api/interview/[sessionId]/complete`)

1. Client से आया transcript (अगर है) DB में merge होता है।  
2. **Q&A निकालना:**  
   - Transcript से substantive **question–answer pairs** निकाले जाते हैं (model + heuristics — देखें `extract-transcript-qa` / `transcript-grading-questions`।)  
   - अगर transcript से कोई Q&A न मिले तो **admin की topic list** fallback के तौर पर use होती है (ideal answers फिर भी fresh generate होते हैं)।  
3. **Ideal answer (expected answer):**  
   - हर ऐसे question के लिए जिसमें अभी ideal नहीं है, OpenAI से **उसी transcript वाले सवाल** (+ role, JD, skills, ज़रूरत हो तो transcript snippet) के आधार पर **एक ideal** generate होता है।  
   - यह admin bank से copy-paste **नहीं** है — context के साथ नया लिखा जाता है।  
4. **Grading:**  
   - Candidate answer को ideal और rubric categories से compare करके scores, feedback, **accuracyPercent** आदि scorecard में merge होते हैं (`question-grading`।

5. Session **COMPLETED** mark, scorecard DB में persist।

### चरण 3 — Admin देखता है

Session details / scorecard share पर: **question, ideal, candidate answer, feedback** दिख सकता है।

### चरण 4 — पुरानी sessions को दोबारा grade (`POST /api/admin/session/[sessionId]/regrade`)

deploy के बाद logic बदला हो तो completed session पर **re-grade**: transcript से फिर से ideals + grades बनते हैं।

---

## Pros (फायदे) और Cons (नुकसान) — और कैसे कम करें

| Pros | क्यों अच्छा है |
|------|----------------|
| Transcript-first | जो **वास्तव में पूछा गया** उसी पर grade — scripted list से ज़्यादा honest। |
| Per-question ideal | हर सवाल का अलग ideal — batch में prompt/answer मिलान कम होता है। |
| Snippet context | Follow-up / ambiguous सवालों के लिए आसपास की बात से scope clear। |

| Cons | Mitigation (कम कैसे करें) |
|------|---------------------------|
| API latency + cost (N सवाल ⇒ कई calls) | Parallel cap (`concurrency: 3` जैसा); ज़रूरत हो तो question count समझदारी से। |
| Transcript गड़बड़ ⇒ extraction गड़बड़ |_clear mic, कम शोर; complete पर पूरा transcript भेजना। |
| Fallback agenda जब transcript खाली/weak | Requirement में साफ़ mandatory questions रखें। |

---

## Quality checklist (ज़्यादा «सही» ideal + score के लिए)

| चीज़ | क्यों |
|------|-------|
| `OPENAI_API_KEY` set | Ideal + grading दोनों के लिए ज़रूरी। |
| अच्छा **role + JD + skills** | Generic ideals कम, role-specific ज़्यादा। |
| Optional: `SCORING_MODEL` / मज़बूत model | अक्सर quality ↑, cost ↑। |
| Interview खत्म करते समय **transcript** भेजना | DB में सही turns ⇒ extraction अच्छा। |

---

## Testing — मैं (developer) क्या चला सकता हूँ

1. **Lint:** `npm run lint` — code quality / syntax।  
2. **Regrade API smoke test** (dev server + admin cookie चाहिए):  
   `node scripts/test-grading-pipeline.mjs <sessionId>`  
   Env: `TEST_BASE_URL` (default `http://localhost:3000`), `ADMIN_COOKIE`।  
3. **DB से direct pipeline** (Prisma + dynamic TS import):  
   `node scripts/run-session-regrade-test.mjs <sessionId>` — `.env` में DB URL।  
4. अन्य scripts: `test-transcript-extract.mjs`, `test-openai-ideal.mjs`, `check-question-grading.mjs`, `debug-session-grading.mjs` — ज़रूरत के हिसाब से।

English संक्षिप्त संस्करण: [`ideal-answer-workflow.md`](./ideal-answer-workflow.md)
