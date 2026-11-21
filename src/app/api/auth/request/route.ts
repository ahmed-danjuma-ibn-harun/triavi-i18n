import { NextRequest, NextResponse } from "next/server";
import { validLanguage } from "@/lib/catalog";
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
  const { data: annotator } = await getSupabase().from("annotators").select("email,display_name,language,enabled").eq("email", email).maybeSingle();
  if (!annotator?.enabled || !validLanguage(annotator.language)) return NextResponse.json(generic);
  try {
    await sendLoginLink(email, annotator.display_name);
  } catch { return NextResponse.json(generic); }
  return NextResponse.json(generic);
}
