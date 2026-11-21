import { NextRequest, NextResponse } from "next/server";
import { currentAnnotator, isSuperAdmin } from "@/lib/auth";
import { entries, validLanguage } from "@/lib/catalog";
import { readLanguage } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const annotator = await currentAnnotator();
  if (!annotator) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const code = request.nextUrl.searchParams.get("lang") ?? "";
  if (!validLanguage(code) || (code !== annotator.language && !isSuperAdmin(annotator.email))) return NextResponse.json({ error: "This language is not assigned to your account." }, { status: 403 });
  try { return NextResponse.json({ entries, translations: await readLanguage(code) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load translations." }, { status: 503 }); }
}
