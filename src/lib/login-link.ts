import "server-only";
import { hashToken, newToken } from "@/lib/auth";
import { signInEmail } from "@/lib/email-template";
import { sendMail } from "@/lib/mailer";
import { getSupabase } from "@/lib/store";

export async function sendLoginLink(email: string, displayName: string) {
  const base = process.env.APP_URL;
  if (!base) throw new Error("APP_URL is not configured.");
  const db = getSupabase();
  await db.from("annotator_login_links").update({ used_at: new Date().toISOString() }).eq("email", email).is("used_at", null);
  const raw = newToken();
  const tokenHash = hashToken(raw);
  const { error } = await db.from("annotator_login_links").insert({
    token_hash: tokenHash,
    email,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
  if (error) throw new Error("Could not prepare the sign-in link.");
  const link = new URL("/", base);
  link.hash = `token=${raw}`;
  const message = signInEmail(displayName, link.href);
  try {
    await sendMail(email, message.subject, message.text, message.html);
  } catch {
    await db.from("annotator_login_links").delete().eq("token_hash", tokenHash);
    throw new Error("Email delivery is temporarily unavailable.");
  }
}
