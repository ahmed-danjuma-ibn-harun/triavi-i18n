import { NextRequest, NextResponse } from "next/server";
import { currentAnnotator } from "@/lib/auth";
import { entries as sourceEntries, validLanguage } from "@/lib/catalog";
import { getSupabase, readLanguage, saveLanguage, type TranslationRecord } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const annotator = await currentAnnotator();
  if (!annotator) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  let body: { lang?: string; rows?: Array<{ key: string; translation: string; reviewed: boolean }> };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const code = body.lang ?? "";
  if (!validLanguage(code) || code !== annotator.language) return NextResponse.json({ error: "This language is not assigned to your account." }, { status: 403 });
  if (!Array.isArray(body.rows) || body.rows.length > sourceEntries.length) return NextResponse.json({ error: "Invalid save data." }, { status: 400 });
  const sourceByKey = new Map(sourceEntries.map((entry) => [entry.key, entry]));
  const existing = await readLanguage(code);
  const updates: Record<string, TranslationRecord> = {};
  const now = new Date().toISOString();
  const warnings: string[] = [];
  for (const row of body.rows) {
    const source = sourceByKey.get(row.key);
    if (!source || typeof row.translation !== "string" || typeof row.reviewed !== "boolean") continue;
    const translation = row.translation.trim();
    if (!translation) continue;
    const missing = source.placeholders.filter((item) => !translation.includes(`{${item}}`));
    if (missing.length) warnings.push(row.key);
    const prior = existing[row.key];
    updates[row.key] = {
      en: source.value,
      translation,
      annotator: row.reviewed ? annotator.display_name : (prior?.annotator ?? annotator.display_name),
      updated_at: now,
      source: row.reviewed ? "human" : (prior?.source ?? "mt"),
      reviewed: row.reviewed,
    } satisfies TranslationRecord;
  }
  try {
    await saveLanguage(code, updates);
    const activityRows = Object.entries(updates).map(([key, entry]) => ({
      email: annotator.email,
      display_name: annotator.display_name,
      language: code,
      key,
      translation: entry.translation,
      reviewed: entry.reviewed,
      created_at: now,
    }));
    if (activityRows.length) {
      const { error: activityError } = await getSupabase().from("translation_activity").insert(activityRows);
      if (activityError) console.error("Translation activity insert failed:", activityError.message);
    }
    return NextResponse.json({ ok: true, warnings });
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save translations." }, { status: 503 }); }
}
