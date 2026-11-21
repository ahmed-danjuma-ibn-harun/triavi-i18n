import { NextResponse } from "next/server";
import { currentAnnotator, isSuperAdmin } from "@/lib/auth";
import { entries, languageList } from "@/lib/catalog";
import { readLanguage } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const annotator = await currentAnnotator();
  if (!annotator) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    if (isSuperAdmin(annotator.email)) {
      return NextResponse.json({ languages: languageList.map((language) => ({ ...language, reviewed: 0, drafts: 0, total: entries.length })) });
    }
    const assigned = languageList.filter((language) => language.code === annotator.language);
    const result = await Promise.all(assigned.map(async (language) => {
      const data = await readLanguage(language.code);
      const reviewed = Object.values(data).filter((entry) => entry.reviewed && entry.translation?.trim()).length;
      const drafts = Object.values(data).filter((entry) => entry.source === "mt" && !entry.reviewed && entry.translation?.trim()).length;
      return { ...language, reviewed, drafts, total: entries.length };
    }));
    return NextResponse.json({ languages: result });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load progress." }, { status: 503 }); }
}
