import { Resend } from "resend";

const FROM = () =>
  `${process.env.MAIL_FROM_NAME ?? "GamePlan"} <${process.env.MAIL_FROM_EMAIL ?? "gameplan@stephens.page"}>`;

// Password reset link. Unlike the admin notice this is user-facing and must
// actually reach the recipient — the caller deliberately lets a throw here
// propagate so the request is reported as failed rather than silently lost.
// (Still no-ops when Resend is unconfigured, e.g. local dev.)
export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: FROM(),
    to: email,
    subject: "Reset your GamePlan password",
    text: [
      "We received a request to reset the password for your GamePlan account.",
      `Reset your password here (the link expires in 1 hour):\n${resetUrl}`,
      "If you didn't request this, you can safely ignore this email — your password won't change.",
    ].join("\n\n"),
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

// Admin notification on new sign-up. Mirrors the legacy notify_admin_new_user()
// in sign-up.php (now Resend). No-ops if env is unconfigured, exactly
// like the PHP guard `if (!$apiKey || !$adminEmail) return;`.
export async function notifyAdminNewUser(email: string, userAgent: string) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  if (!adminEmail || !apiKey) return;

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from: `${process.env.MAIL_FROM_NAME ?? "GamePlan"} <${process.env.MAIL_FROM_EMAIL ?? "gameplan@stephens.page"}>`,
    to: adminEmail,
    subject: "GamePlan — New Account Created",
    text: [
      "A new account was created on GamePlan.",
      `Email: ${email}`,
      `Date: ${new Date().toISOString()}`,
      `Device: ${userAgent.slice(0, 1024)}`,
    ].join("\n\n"),
  });
}
