import "server-only";
import { env } from "@/lib/env";

/*
 * Sending email through Resend's HTTP API (no SDK needed). Used for the
 * 6-digit sign-in codes. Errors never include the API key or the message.
 */

export class EmailError extends Error {}

export type Mail = { to: string; subject: string; text: string; html: string };

export function emailReady(): boolean {
  const e = env();
  return Boolean(e.RESEND_API_KEY && e.EMAIL_FROM);
}

export async function sendEmail(mail: Mail): Promise<void> {
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  if (!RESEND_API_KEY || !EMAIL_FROM) throw new EmailError("Email isn't set up: add RESEND_API_KEY and EMAIL_FROM.");
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    throw new EmailError("Couldn't reach Resend.");
  }
  if (!res.ok) throw new EmailError(`Resend refused the email (HTTP ${res.status}).`);
}

/** The sign-in code email: the code big and plain, and what to do if it wasn't you. */
export function loginCodeMail(to: string, code: string, minutes: number): Mail {
  const text = [
    "Your JodyOS sign-in code is:",
    "",
    code,
    "",
    `It works once and expires in ${minutes} minutes.`,
    "If you didn't ask for it, ignore this email: nobody can sign in without the code.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:32px;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#0a0a0a">
<div style="max-width:420px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#545454">JodyOS</p>
<p style="margin:0 0 20px;font-size:18px;font-weight:bold">Your sign-in code</p>
<p style="margin:0 0 20px;font-size:36px;font-weight:bold;letter-spacing:.3em">${code}</p>
<p style="margin:0 0 8px;font-size:14px;color:#545454">It works once and expires in ${minutes} minutes.</p>
<p style="margin:0;font-size:14px;color:#545454">If you didn't ask for it, ignore this email: nobody can sign in without the code.</p>
</div></body></html>`;
  return { to, subject: "Your JodyOS sign-in code", text, html };
}
