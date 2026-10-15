import "server-only";
import { isAllowedDashboardEmail, resolveDashboardConfiguration } from "./config";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendDashboardMagicLink(input: { email: string; url: string }) {
  if (!isAllowedDashboardEmail(input.email)) return;

  const configuration = resolveDashboardConfiguration();
  if (!configuration.ready) {
    throw new Error("Dashboard email delivery is not configured.");
  }

  const safeUrl = escapeHtml(input.url);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configuration.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: configuration.sender,
      to: [input.email],
      subject: "Sign in to the Tailored Agents dashboard",
      text: `Use this secure link to sign in to the Tailored Agents dashboard:\n\n${input.url}\n\nThis link expires in 10 minutes and can be used once. If you did not request it, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#111827"><p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#4f6fdc">Tailored Agents</p><h1 style="font-size:26px;line-height:1.2">Sign in to your dashboard</h1><p style="line-height:1.65;color:#526071">Use the secure button below to continue. The link expires in 10 minutes and can be used once.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#111827;color:#fff;text-decoration:none;font-weight:700">Open dashboard</a></p><p style="font-size:13px;line-height:1.6;color:#7a8798">If you did not request this email, no action is needed.</p></div>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Dashboard email delivery failed with status ${response.status}.`);
  }
}
