import { NextRequest, NextResponse } from "next/server";
import { currentAnnotator, isSuperAdmin } from "@/lib/auth";
import { entries, languageList, validLanguage } from "@/lib/catalog";
import { sendLoginLink } from "@/lib/login-link";
import { getSupabase } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await currentAnnotator();
  return user && isSuperAdmin(user.email) ? user : null;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  const db = getSupabase();
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1") || 1);
  const pageSize = 15;
  const [{ data: allAnnotators, error: annotatorError }, { data: activity, error: activityError, count }] = await Promise.all([
    db.from("annotators").select("email,display_name,language,enabled,created_at").order("created_at", { ascending: false }),
    db.from("translation_submissions").select("id,email,display_name,language,entry_count,reviewed_count,changes,created_at", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
  ]);
  if (annotatorError || activityError) return NextResponse.json({ error: annotatorError?.message ?? activityError?.message ?? "Could not load admin data." }, { status: 503 });
  const annotators = (allAnnotators ?? []).filter((person) => !isSuperAdmin(person.email));
  const progressByAnnotator = await Promise.all(annotators.map(async (person) => {
    const latestByKey = new Map<string, { translation: string; reviewed: boolean }>();
    const batchSize = 500;
    for (let offset = 0; ; offset += batchSize) {
      const { data, error } = await db.from("translation_submissions")
        .select("id,changes")
        .eq("email", person.email)
        .eq("language", person.language)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + batchSize - 1);
      if (error) return { email: person.email, error: error.message };
      for (const submission of data ?? []) {
        const changes = Array.isArray(submission.changes) ? submission.changes as Array<{ key?: unknown; translation?: unknown; reviewed?: unknown }> : [];
        for (const change of changes) {
          if (typeof change.key !== "string" || typeof change.translation !== "string" || typeof change.reviewed !== "boolean") continue;
          latestByKey.set(change.key, { translation: change.translation, reviewed: change.reviewed });
        }
      }
      if (!data || data.length < batchSize) break;
    }
    const latestEntries = [...latestByKey.values()];
    return {
      email: person.email,
      translated: latestEntries.filter((entry) => Boolean(entry.translation.trim())).length,
      reviewed: latestEntries.filter((entry) => entry.reviewed && Boolean(entry.translation.trim())).length,
    };
  }));
  const progressError = progressByAnnotator.find((progress) => "error" in progress);
  if (progressError && "error" in progressError) return NextResponse.json({ error: progressError.error }, { status: 503 });
  const progressByEmail = new Map(progressByAnnotator.map((progress) => [progress.email, progress]));
  const people = annotators.map((person) => ({
    ...person,
    translated: progressByEmail.get(person.email)?.translated ?? 0,
    reviewed: progressByEmail.get(person.email)?.reviewed ?? 0,
    total: entries.length,
  }));
  return NextResponse.json({ annotators: people, activity, languages: languageList, page, pageSize, totalActivity: count ?? 0, totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)) });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  let body: { email?: string; display_name?: string; language?: string; enabled?: boolean; send_invite?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const email = body.email?.trim().toLowerCase() ?? "";
  const displayName = body.display_name?.trim() ?? "";
  const language = body.language ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !displayName || displayName.length > 100 || !validLanguage(language)) {
    return NextResponse.json({ error: "Provide a valid email, name, and assigned language." }, { status: 400 });
  }
  if (isSuperAdmin(email)) return NextResponse.json({ error: "Super-admin access is managed through SUPER_ADMIN_EMAILS." }, { status: 400 });
  const enabled = body.enabled !== false;
  const { error } = await getSupabase().from("annotators").upsert({ email, display_name: displayName, language, enabled }, { onConflict: "email" });
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  let inviteSent = false;
  let inviteError: string | null = null;
  if (enabled && body.send_invite !== false) {
    try { await sendLoginLink(email, displayName); inviteSent = true; }
    catch (e) { inviteError = e instanceof Error ? e.message : "Could not send the sign-in link."; }
  }
  return NextResponse.json({ ok: true, inviteSent, inviteError });
}
