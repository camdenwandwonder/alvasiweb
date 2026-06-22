/**
 * Sends a transactional email via Resend. No-op (returns silently) when
 * RESEND_API_KEY is not configured, so the app works without email set up.
 * Configure in Vercel: RESEND_API_KEY, EMAIL_FROM, ALVASI_NOTIFY_EMAIL.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !opts.to) return;
  const from = process.env.EMAIL_FROM ?? "Alvasi <onboarding@resend.dev>";
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    });
  } catch {
    // best-effort; never block the request on email failure
  }
}
