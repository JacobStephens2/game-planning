import { Resend } from "resend";

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
