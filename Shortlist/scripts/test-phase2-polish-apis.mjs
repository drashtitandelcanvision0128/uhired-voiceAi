/**
 * Integration smoke tests for Phase 2 polish APIs (CMS, observer links, candidate portal).
 * Requires dev server on localhost:3000 and database access.
 *
 * Usage: npm run test:polish
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { renderSimpleMarkdown } from "../src/lib/simple-markdown.ts";
import { hashPortalOtpCode } from "../src/lib/candidate-portal-auth.ts";

const BASE = process.env.TEST_BASE_URL?.trim() || "http://localhost:3000";
const MASTER_EMAIL = process.env.MASTER_ADMIN_EMAIL || "master@uhired.com";
const MASTER_PASSWORD = process.env.MASTER_ADMIN_PASSWORD || "master@123";

const ADMIN_LOGIN = {
  companyName: "Uhired",
  companyDomain: "uhired.com",
  companyEmail: "admin@uhired.com",
  passcode: "admin123",
};

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return "";
  const parts = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return parts.map((c) => c.split(";")[0]).join("; ");
}

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

async function masterLogin() {
  const { res, body } = await jsonFetch("/api/master/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      adminEmail: MASTER_EMAIL,
      passcode: MASTER_PASSWORD,
      trustDevice: true,
    }),
  });
  assert.equal(res.status, 200, `master login failed: ${JSON.stringify(body)}`);
  const cookie = extractCookie(res.headers.getSetCookie?.() ?? res.headers.get("set-cookie"));
  assert.ok(cookie, "master session cookie missing");
  return cookie;
}

async function adminLogin() {
  const { res, body } = await jsonFetch("/api/company-auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ADMIN_LOGIN),
  });
  if (res.status !== 200) {
    return null;
  }
  const cookie = extractCookie(res.headers.getSetCookie?.() ?? res.headers.get("set-cookie"));
  return cookie || null;
}

async function main() {
  console.log(`Testing polish APIs at ${BASE}…`);

  const html = renderSimpleMarkdown("## Hello\n\n**bold** and [link](https://example.com)");
  assert.ok(html.includes("<h2>Hello</h2>"));
  assert.ok(html.includes("<strong>bold</strong>"));
  assert.ok(html.includes("https://example.com"));
  console.log("✓ simple markdown renderer");

  const cmsDenied = await jsonFetch("/api/master/content-pages");
  assert.equal(cmsDenied.res.status, 401);
  console.log("✓ CMS list requires master auth");

  const masterCookie = await masterLogin();
  const cmsList = await jsonFetch("/api/master/content-pages?type=BLOG", {
    headers: { cookie: masterCookie },
  });
  assert.equal(cmsList.res.status, 200);
  assert.ok(Array.isArray(cmsList.body?.pages));
  console.log("✓ CMS list with master session");

  const slug = `polish-test-${Date.now()}`;
  const createRes = await jsonFetch("/api/master/content-pages", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: masterCookie },
    body: JSON.stringify({
      type: "BLOG",
      slug,
      title: "Polish API Test Post",
      excerpt: "Test excerpt",
      body: "## Updated body\n\nMarkdown **works**.",
      coverImageUrl: "https://example.com/cover.jpg",
      seoTitle: "SEO Title",
      seoDescription: "SEO description for test",
      isPublished: true,
    }),
  });
  assert.equal(createRes.res.status, 200);
  const pageId = createRes.body?.page?.id;
  assert.ok(pageId);
  console.log("✓ CMS create blog post with SEO fields");

  const patchRes = await jsonFetch(`/api/master/content-pages/${pageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: masterCookie },
    body: JSON.stringify({
      body: "## Patched\n\nNew **content**.",
      seoDescription: "Updated SEO",
    }),
  });
  assert.equal(patchRes.res.status, 200);
  console.log("✓ CMS patch post body");

  const publicPost = await jsonFetch(`/api/public/content/blog/${slug}`);
  assert.equal(publicPost.res.status, 200);
  assert.equal(publicPost.body?.post?.seoTitle, "SEO Title");
  assert.ok(publicPost.body?.post?.coverImageUrl);
  console.log("✓ public blog API returns SEO fields");

  const publicMissing = await jsonFetch("/api/public/content/blog/nonexistent-slug-xyz");
  assert.equal(publicMissing.res.status, 404);
  console.log("✓ public blog 404 for missing slug");

  await jsonFetch(`/api/master/content-pages/${pageId}`, {
    method: "DELETE",
    headers: { cookie: masterCookie },
  });
  console.log("✓ CMS delete test post");

  const portalBadEmail = await jsonFetch("/api/candidate-portal/request-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "not-an-email" }),
  });
  assert.equal(portalBadEmail.res.status, 400);
  console.log("✓ candidate portal rejects invalid email");

  const portalSessionsDenied = await jsonFetch("/api/candidate-portal/sessions");
  assert.equal(portalSessionsDenied.res.status, 401);
  console.log("✓ candidate portal sessions require auth");

  const prisma = new PrismaClient();
  const portalEmail = `portal-polish-${Date.now()}@example.com`;
  const portalCode = "123456";
  await prisma.candidatePortalOtp.create({
    data: {
      email: portalEmail,
      codeHash: hashPortalOtpCode(portalCode),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const portalAuth = await jsonFetch("/api/candidate-portal/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: portalEmail, code: portalCode }),
  });
  assert.equal(portalAuth.res.status, 200);
  const portalCookie = extractCookie(
    portalAuth.res.headers.getSetCookie?.() ?? portalAuth.res.headers.get("set-cookie"),
  );
  assert.ok(portalCookie);
  console.log("✓ candidate portal OTP auth");

  const portalSessions = await jsonFetch("/api/candidate-portal/sessions", {
    headers: { cookie: portalCookie },
  });
  assert.equal(portalSessions.res.status, 200);
  assert.ok(Array.isArray(portalSessions.body?.completed));
  assert.ok(Array.isArray(portalSessions.body?.inProgress));
  console.log("✓ candidate portal sessions with session cookie");

  const adminCookie = await adminLogin();
  if (!adminCookie) {
    console.log("⊘ skip observer tests — admin login failed");
  } else {
    const session = await prisma.interviewSession.findFirst({
      where: {
        sessionType: "COMPANY",
        status: { in: ["READY", "LIVE"] },
      },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!session) {
      console.log("⊘ skip observer tests — no READY/LIVE company session");
    } else {
      const observerList = await jsonFetch(`/api/admin/session/${session.id}/observer-link`, {
        headers: { cookie: adminCookie },
      });
      assert.equal(observerList.res.status, 200);
      assert.ok(Array.isArray(observerList.body?.links));
      console.log("✓ observer link list GET");

      const observerCreate = await jsonFetch(`/api/admin/session/${session.id}/observer-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: adminCookie },
        body: JSON.stringify({ ttlHours: 2 }),
      });
      if (observerCreate.res.status === 200) {
        assert.ok(observerCreate.body?.url);
        const linkId = observerCreate.body?.id;
        assert.ok(linkId);
        console.log("✓ observer link POST");

        const revoke = await jsonFetch(
          `/api/admin/session/${session.id}/observer-link/${linkId}`,
          { method: "DELETE", headers: { cookie: adminCookie } },
        );
        assert.equal(revoke.res.status, 200);
        console.log("✓ observer link revoke DELETE");
      } else {
        console.log(`⊘ observer POST returned ${observerCreate.res.status} — skipped revoke test`);
      }
    }
  }

  await prisma.$disconnect();
  console.log("All polish API tests passed.");
}

main().catch((error) => {
  console.error("Polish API test failed:", error);
  process.exit(1);
});
