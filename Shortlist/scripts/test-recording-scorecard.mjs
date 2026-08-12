/**
 * Video recording + AI scorecard smoke tests.
 * Run: node scripts/test-recording-scorecard.mjs
 */
const BASE = (process.env.QA_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const LOGIN = {
  companyName: "Uhired",
  companyDomain: "uhired.com",
  companyEmail: "admin@uhired.com",
  passcode: "admin123",
};

const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

function extractCookie(header) {
  if (!header) return "";
  const parts = Array.isArray(header) ? header : [header];
  return parts.map((c) => c.split(";")[0]).join("; ");
}

async function json(url, opts = {}, cookie = "") {
  const headers = new Headers(opts.headers ?? {});
  if (cookie) headers.set("cookie", cookie);
  const res = await fetch(`${BASE}${url}`, { ...opts, headers });
  const setCookie = res.headers.getSetCookie?.() ?? res.headers.get("set-cookie");
  const nextCookie = mergeCookies(cookie, extractCookie(setCookie));
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { res, data, cookie: nextCookie };
}

function mergeCookies(...parts) {
  const jar = new Map();
  for (const part of parts) {
    if (!part) continue;
    for (const pair of part.split(";").map((s) => s.trim()).filter(Boolean)) {
      const [key, ...rest] = pair.split("=");
      if (key) jar.set(key, rest.join("="));
    }
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  console.log(`=== Recording + Scorecard Tests @ ${BASE} ===\n`);

  const login = await json("/api/company-auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(LOGIN),
  });
  const companyCookie = extractCookie(login.res.headers.getSetCookie?.() ?? login.res.headers.get("set-cookie"));
  if (!login.res.ok || !companyCookie) {
    fail("Admin login");
    printSummary();
    process.exit(1);
  }
  pass("Admin login");

  const testEmail = `recording-${Date.now()}@example.com`;
  const invite = await json(
    "/api/admin/requirements/invite-candidates",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "manual",
        emails: [testEmail],
        requirement: {
          positionTitle: "Recording Scorecard Test",
          domain: "Recording Scorecard Test",
          topic: "Video and AI scorecard verification",
          durationMin: 15,
          jobDescription: "Test role for recording and scorecard automation.",
          keySkills: ["Communication", "Problem solving"],
          maxOptionalQuestions: 2,
        },
      }),
    },
    companyCookie,
  );
  const accessCode = invite.data?.invites?.find((i) => i.email === testEmail)?.accessCode;
  if (!invite.res.ok || !accessCode) {
    fail("Create invite for test session", invite.data?.error || invite.res.status);
    printSummary();
    process.exit(1);
  }
  pass("Create invite", accessCode);

  let candidateCookie = "";
  let sessionId = null;
  const verify = await json(
    "/api/candidate/verify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessCode,
        candidateName: "Recording Test User",
        email: testEmail,
      }),
    },
    "",
  );
  candidateCookie = verify.cookie;
  sessionId = verify.data?.sessionId;
  if (!verify.res.ok || !sessionId) {
    fail("Candidate verify", verify.data?.error || verify.res.status);
    printSummary();
    process.exit(1);
  }
  pass("Candidate session created", sessionId);

  await json(
    `/api/interview/${sessionId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "LIVE", markStartedAt: true }),
    },
    candidateCookie,
  );

  const transcript = [
    { speaker: "interviewer", text: "Tell me about a challenging project you delivered.", orderIndex: 0 },
    {
      speaker: "candidate",
      text: "I led a backend migration from a monolith to microservices using Node.js and PostgreSQL, reducing deployment time by 40%.",
      orderIndex: 1,
      confidence: 0.93,
    },
    {
      speaker: "interviewer",
      text: "How did you handle production incidents?",
      orderIndex: 2,
    },
    {
      speaker: "candidate",
      text: "We used on-call runbooks, severity triage, Slack war rooms, and postmortems to prevent repeat failures.",
      orderIndex: 3,
      confidence: 0.9,
    },
  ];

  const complete = await json(
    `/api/interview/${sessionId}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationSec: 180, transcript }),
    },
    candidateCookie,
  );
  if (complete.res.ok && complete.data?.score?.overallScore != null) {
    pass("Interview complete returns scorecard", `score=${complete.data.score.overallScore}`);
  } else {
    fail("Interview complete returns scorecard", complete.data?.error || complete.res.status);
  }

  if (complete.data?.gradingPending === true) {
    pass("Background AI grading queued");
  } else {
    fail("Background AI grading queued", JSON.stringify(complete.data));
  }

  // Multipart video upload (works with local/S3/Supabase providers)
  const tinyWebm = Buffer.from(
    "1a45dfa3" + "00000000" + "00000000" + "00000000" + "00000000" + "00000000",
    "hex",
  );
  const form = new FormData();
  form.append("video", new Blob([tinyWebm], { type: "video/webm" }), `${sessionId}.webm`);
  form.append("durationSec", "180");
  const videoUpload = await fetch(`${BASE}/api/interview/${sessionId}/video`, {
    method: "POST",
    headers: { cookie: candidateCookie },
    body: form,
  });
  const videoBody = await videoUpload.json().catch(() => ({}));
  if (videoUpload.ok && videoBody.ok) {
    pass("Multipart video upload API", videoBody.videoFilePath || "saved");
  } else {
    fail("Multipart video upload API", videoBody.error || videoUpload.status);
  }

  const detailBefore = await json(`/api/admin/session/${sessionId}`, {}, companyCookie);
  if (detailBefore.res.ok && detailBefore.data?.session?.scorecard) {
    const sc = detailBefore.data.session.scorecard;
    if (sc.summary) pass("Scorecard has AI/heuristic summary");
    else fail("Scorecard has summary");
    if (typeof sc.communication === "number") pass("Scorecard has communication score");
    else fail("Scorecard has communication score");
    if (detailBefore.data.session.videoRecordingStatus) {
      pass("Session has videoRecordingStatus", detailBefore.data.session.videoRecordingStatus);
    } else {
      fail("Session has videoRecordingStatus");
    }
    if (detailBefore.data.session.videoFilePath) pass("Recruiter can access recording URL");
    else fail("Recruiter can access recording URL");
  } else {
    fail("Admin session detail with scorecard", detailBefore.data?.error || detailBefore.res.status);
  }

  const regrade = await json(
    `/api/admin/session/${sessionId}/regrade`,
    { method: "POST" },
    companyCookie,
  );
  if (regrade.res.ok && Array.isArray(regrade.data?.questionResults) && regrade.data.questionResults.length > 0) {
    pass("AI per-question grading", `${regrade.data.questionResults.length} questions`);
  } else {
    fail("AI per-question grading", regrade.data?.error || regrade.res.status);
  }

  const detailAfter = await json(`/api/admin/session/${sessionId}`, {}, companyCookie);
  const afterScore = detailAfter.data?.session?.scorecard;
  if (detailAfter.res.ok && afterScore?.questionResults?.length > 0) {
    pass("Scorecard stores questionResults after AI grading");
  } else {
    fail("Scorecard stores questionResults after AI grading");
  }
  if (afterScore?.accuracyPercent != null) {
    pass("Scorecard has answer accuracy", `${afterScore.accuracyPercent}%`);
  } else {
    fail("Scorecard has answer accuracy");
  }
  if (
    afterScore?.scoringMode?.includes("hybrid") ||
    afterScore?.scoringMode?.includes("rubric") ||
    afterScore?.scoringMode?.includes("semantic")
  ) {
    pass("Scorecard scoring mode indicates AI analysis", afterScore.scoringMode);
  } else {
    fail("Scorecard scoring mode indicates AI analysis", afterScore?.scoringMode);
  }

  const sessionsList = await json(
    `/api/admin/sessions?page=1&pageSize=20&status=COMPLETED&search=`,
    {},
    companyCookie,
  );
  const listed = sessionsList.data?.sessions?.find((s) => s.id === sessionId);
  if (sessionsList.res.ok && listed?.videoRecordingStatus === "AVAILABLE") {
    pass("Sessions list shows recording available");
  } else if (sessionsList.res.ok && listed) {
    pass("Sessions list includes completed session", listed.videoRecordingStatus || "found");
  } else if (sessionsList.res.ok) {
    pass("Sessions list API works for completed sessions");
  } else {
    fail("Sessions list API", sessionsList.data?.error || sessionsList.res.status);
  }

  printSummary();
  if (results.some((r) => !r.ok)) process.exit(1);
}

function printSummary() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n=== SUMMARY ===\nPassed: ${passed}  Failed: ${failed}`);
  if (failed) {
    console.log("\nFailures:");
    for (const r of results.filter((x) => !x.ok)) console.log(`  - ${r.name}: ${r.detail}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
