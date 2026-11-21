import { NextRequest, NextResponse } from "next/server";
import { currentAnnotator, isSuperAdmin } from "@/lib/auth";
import { entries, validLanguage } from "@/lib/catalog";
import { getSupabase, readLanguage } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const annotator = await currentAnnotator();
  if (!annotator) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const code = request.nextUrl.searchParams.get("lang") ?? "";
  if (!validLanguage(code) || (code !== annotator.language && !isSuperAdmin(annotator.email))) return NextResponse.json({ error: "This language is not assigned to your account." }, { status: 403 });
  try {
    const translations = await readLanguage(code);
    if (!isSuperAdmin(annotator.email)) {
      const db = getSupabase();
      const reviewedByKey = new Map<string, boolean>();
      const batchSize = 500;
      for (let offset = 0; ; offset += batchSize) {
        const { data, error } = await db.from("translation_submissions")
          .select("id,changes")
          .eq("email", annotator.email)
          .eq("language", code)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        for (const submission of data ?? []) {
          const changes = Array.isArray(submission.changes) ? submission.changes as Array<{ key?: unknown; reviewed?: unknown }> : [];
          for (const change of changes) {
            if (typeof change.key === "string" && typeof change.reviewed === "boolean") reviewedByKey.set(change.key, change.reviewed);
          }
        }
        if (!data || data.length < batchSize) break;
      }
      for (const [key, translation] of Object.entries(translations)) {
        translations[key] = { ...translation, reviewed: reviewedByKey.get(key) ?? false };
      }
    }
    return NextResponse.json({ entries, translations });
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load translations." }, { status: 503 }); }
}
