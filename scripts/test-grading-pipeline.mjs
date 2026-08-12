const sessionId = process.argv[2] || "cmpcj3hbt0006v9b8k7cgd1mf";

// Dynamic import of compiled TS won't work easily - call APIs instead
const base = process.env.TEST_BASE_URL || "http://localhost:3000";

const loginRes = await fetch(`${base}/api/admin/session/${sessionId}/regrade`, {
  method: "POST",
  headers: { cookie: process.env.ADMIN_COOKIE || "" },
});
const text = await loginRes.text();
console.log("regrade status", loginRes.status);
console.log(text.slice(0, 2000));
