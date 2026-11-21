import { NextRequest, NextResponse } from "next/server";
import { validLanguage } from "@/lib/catalog";
import { isSuperAdmin } from "@/lib/auth";
import { sendLoginLink } from "@/lib/login-link";
import { getSupabase } from "@/lib/store";

export const runtime = "nodejs";
const generic = { ok: true, message: "If this email is assigned to a Triavi language, a sign-in link will arrive shortly." };

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  let body: { email?: string };
  try { body = await request.json(); } catch { return NextResponse.json(generic); }
  const email = body.email?.trim().toLowerCase() ?? "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json(generic);
  const db = getSupabase();
  let { data: annotator } = await db.from("annotators").select("email,display_name,language,enabled").eq("email", email).maybeSingle();
  if (isSuperAdmin(email) && (!annotator || !annotator.enabled)) {
    const { data: provisioned, error } = await db.from("annotators").upsert({
      email,
      display_name: annotator?.display_name || email.split("@")[0],
      language: annotator?.language && validLanguage(annotator.language) ? annotator.language : "es",
      enabled: true,
    }, { onConflict: "email" }).select("email,display_name,language,enabled").single();
    if (error) return NextResponse.json(generic);
    annotator = provisioned;
  }
  if (!annotator?.enabled || !validLanguage(annotator.language)) return NextResponse.json(generic);
  try {
    await sendLoginLink(email, annotator.display_name);
  } catch { return NextResponse.json(generic); }
  return NextResponse.json(generic);
}
