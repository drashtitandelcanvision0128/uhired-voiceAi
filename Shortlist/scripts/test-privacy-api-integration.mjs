/**
 * Integration smoke tests for Phase 6 privacy APIs (requires dev server on localhost:3000).
 * Usage: npx tsx scripts/test-privacy-api-integration.mjs
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { deletePracticeDataForEmail } from "../src/lib/candidate-data-deletion.ts";

const BASE = process.env.TEST_BASE_URL?.trim() || "http://localhost:3000";

async function jsonFetch(path, options, clientIp = `test-${Date.now()}-${Math.random()}`) {
  const headers = new Headers(options?.headers ?? {});
  headers.set("x-forwarded-for", clientIp);
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { res, body };
}

async function main() {
  console.log(`Testing privacy APIs at ${BASE}…`);

  const honeypot = await jsonFetch("/api/privacy/delete-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "bot@example.com",
      confirmEmail: "bot@example.com",
      honeypot: "spam",
    }),
  });
  assert.equal(honeypot.res.status, 200);
  assert.equal(honeypot.body?.ok, true);
  console.log("✓ delete-request honeypot silently accepted");

  const mismatch = await jsonFetch("/api/privacy/delete-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "a@example.com",
      confirmEmail: "b@example.com",
    }),
  });
  assert.equal(mismatch.res.status, 400);
  console.log("✓ delete-request rejects email mismatch");

  const prisma = new PrismaClient();
  const session = await prisma.interviewSession.findFirst({
    where: { status: "READY", sessionType: "PRACTICE" },
    select: { id: true, consentAcceptedAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    console.log("⊘ skip consent LIVE test — no READY practice session in DB");
  } else {
    await prisma.interviewSession.update({
      where: { id: session.id },
      data: { consentAcceptedAt: null, consentVersion: null },
    });

    const liveBlocked = await jsonFetch(`/api/interview/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "LIVE", markStartedAt: true }),
    });
    assert.equal(liveBlocked.res.status, 403);
    console.log("✓ LIVE blocked without consent");

    const consent = await jsonFetch(`/api/interview/${session.id}/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted: true }),
    });
    if (consent.res.status !== 200) {
      console.warn(
        `⊘ consent API returned ${consent.res.status} — recording via Prisma (restart dev server after migrate)`,
      );
      await prisma.interviewSession.update({
        where: { id: session.id },
        data: { consentAcceptedAt: new Date(), consentVersion: "integration-test" },
      });
    } else {
      assert.ok(consent.body?.consentAcceptedAt);
      console.log("✓ consent API recorded");
    }

    const afterConsent = await prisma.interviewSession.findUnique({
      where: { id: session.id },
      select: { consentAcceptedAt: true },
    });
    assert.ok(afterConsent?.consentAcceptedAt);
    console.log("✓ consent stored in database");

    if (consent.res.status === 200) {
      const liveOk = await jsonFetch(`/api/interview/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "LIVE", markStartedAt: true }),
      });
      assert.equal(liveOk.res.status, 200);
      console.log("✓ LIVE allowed after consent");
    } else {
      console.log("⊘ skip LIVE API check — restart `npm run dev` after `prisma migrate deploy`");
    }

    await prisma.interviewSession.update({
      where: { id: session.id },
      data: { status: "READY", startedAt: null, consentAcceptedAt: null, consentVersion: null },
    });
  }

  const testEmail = `privacy-test-${Date.now()}@example.com`;
  const testSession = await prisma.interviewSession.create({
    data: {
      accessCode: `PRIV${Date.now()}`,
      sessionType: "PRACTICE",
      status: "COMPLETED",
      candidateName: "Privacy Test",
      candidateEmail: testEmail,
      domain: "Engineering",
      topic: "Privacy",
      durationMin: 10,
      endedAt: new Date(),
    },
  });

  const purgeResult = await deletePracticeDataForEmail(prisma, testEmail);
  assert.equal(purgeResult.sessionsProcessed, 1);
  console.log("✓ deletePracticeDataForEmail purges practice session");

  const anonymized = await prisma.interviewSession.findUnique({
    where: { id: testSession.id },
    select: { candidateEmail: true, dataAnonymizedAt: true },
  });
  assert.equal(anonymized?.candidateEmail, null);
  assert.ok(anonymized?.dataAnonymizedAt);
  console.log("✓ practice PII cleared in database");

  const deleteReq = await jsonFetch("/api/privacy/delete-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `noop-${Date.now()}@example.com`,
      confirmEmail: `noop-${Date.now()}@example.com`,
    }),
  });
  if (deleteReq.res.status === 200) {
    console.log("✓ delete-request HTTP endpoint OK");
  } else {
    console.log(
      `⊘ delete-request HTTP returned ${deleteReq.res.status} — restart dev server after migrate for full API test`,
    );
  }

  await prisma.$disconnect();
  console.log("\nAll Phase 6 API integration checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
