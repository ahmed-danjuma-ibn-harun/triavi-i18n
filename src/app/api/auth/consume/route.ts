import { NextRequest, NextResponse } from "next/server";
import { cookieOptions, hashToken, newToken, sessionCookie, SESSION_TTL } from "@/lib/auth";
import { getSupabase } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  let body: { token?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "This sign-in link is invalid or expired." }, { status: 400 }); }
  const raw = body.token ?? "";
  if (!/^[\w-]{43}$/.test(raw)) return NextResponse.json({ error: "This sign-in link is invalid or expired." }, { status: 400 });
  const db = getSupabase();
  const { data: link } = await db.from("annotator_login_links").select("email,expires_at,used_at").eq("token_hash", hashToken(raw)).maybeSingle();
  if (!link || link.used_at || Date.parse(link.expires_at) <= Date.now()) return NextResponse.json({ error: "This sign-in link is invalid or expired. Request a new link." }, { status: 400 });
  const { data: annotator } = await db.from("annotators").select("enabled").eq("email", link.email).maybeSingle();
  if (!annotator?.enabled) return NextResponse.json({ error: "This account is no longer enabled." }, { status: 403 });
  const { data: consumed } = await db.from("annotator_login_links").update({ used_at: new Date().toISOString() }).eq("token_hash", hashToken(raw)).is("used_at", null).gt("expires_at", new Date().toISOString()).select("email").maybeSingle();
  if (!consumed) return NextResponse.json({ error: "This sign-in link was already used. Request a new link." }, { status: 409 });
  const session = newToken();
  const { error } = await db.from("annotator_sessions").insert({ token_hash: hashToken(session), email: consumed.email, expires_at: new Date(Date.now() + SESSION_TTL).toISOString() });
  if (error) return NextResponse.json({ error: "Could not start your session. Request a new sign-in link." }, { status: 503 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie, session, cookieOptions(SESSION_TTL / 1000));
  return response;
}
