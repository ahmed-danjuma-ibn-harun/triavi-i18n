import { NextRequest, NextResponse } from "next/server";
import { newToken, hashToken } from "@/lib/auth";
import { validLanguage } from "@/lib/catalog";
import { signInEmail } from "@/lib/email-template";
import { sendMail } from "@/lib/mailer";
import { getSupabase } from "@/lib/store";

export const runtime = "nodejs";
const generic = { ok: true, message: "If this email is assigned to a Triavi language, a sign-in link will arrive shortly." };

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  let body: { email?: string };
  try { body = await request.json(); } catch { return NextResponse.json(generic); }
  const email = body.email?.trim().toLowerCase() ?? "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json(generic);
  const base = process.env.APP_URL;
  if (!base) return NextResponse.json({ error: "Email sign-in is not configured." }, { status: 503 });
  const { data: annotator } = await getSupabase().from("annotators").select("email,display_name,language,enabled").eq("email", email).maybeSingle();
  if (!annotator?.enabled || !validLanguage(annotator.language)) return NextResponse.json(generic);

  await getSupabase().from("annotator_login_links").update({ used_at: new Date().toISOString() }).eq("email", email).is("used_at", null);
  const raw = newToken();
  const { error } = await getSupabase().from("annotator_login_links").insert({
    token_hash: hashToken(raw), email, expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
  if (error) return NextResponse.json({ error: "Could not prepare the sign-in link. Try again shortly." }, { status: 503 });
  const link = new URL("/", base);
  link.hash = `token=${raw}`;
  const emailContent = signInEmail(annotator.display_name, link.href);
  try {
    await sendMail(email, emailContent.subject, emailContent.text, emailContent.html);
  } catch {
    await getSupabase().from("annotator_login_links").delete().eq("token_hash", hashToken(raw));
    return NextResponse.json({ error: "Email delivery is temporarily unavailable. Try again shortly." }, { status: 503 });
  }
  return NextResponse.json(generic);
}
