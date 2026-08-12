import nodemailer from "nodemailer";

const pass = process.env.SMTP_PASS?.trim() || process.env.SMTP_PASSWORD?.trim() || "";
const user = process.env.SMTP_USER?.trim() || "no-reply@uhired.in";

async function tryUser(email) {
  const transport = nodemailer.createTransport({
    host: "smtpout.secureserver.net",
    port: 465,
    secure: true,
    auth: { user: email, pass },
    tls: { minVersion: "TLSv1.2" },
  });
  try {
    await transport.verify();
    console.log(`OK: ${email}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL: ${email} — ${message}`);
    return false;
  }
}

console.log(`Testing no-reply@uhired.in with SMTP_USER=${user}`);
await tryUser(user);
