import { NextRequest, NextResponse } from "next/server";
import { cookieOptions, currentAnnotator, hashToken, isSuperAdmin, sessionCookie } from "@/lib/auth";
import { getSupabase } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const annotator = await currentAnnotator();
    return NextResponse.json({ annotator, isSuperAdmin: annotator ? isSuperAdmin(annotator.email) : false });
  }
  catch { return NextResponse.json({ annotator: null }); }
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const raw = request.cookies.get(sessionCookie)?.value;
  if (raw) await getSupabase().from("annotator_sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", hashToken(raw)).is("revoked_at", null);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie, "", cookieOptions(0));
  return response;
}
