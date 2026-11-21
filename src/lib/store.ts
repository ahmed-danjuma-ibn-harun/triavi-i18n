import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type TranslationRecord = {
  en: string;
  translation: string;
  annotator: string;
  updated_at: string;
  source: string;
  reviewed: boolean;
};

let supabase: SupabaseClient | null = null;
export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Add SUPABASE_URL and SUPABASE_SECRET_KEY to the project environment.");
  return supabase ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function readLanguage(code: string): Promise<Record<string, TranslationRecord>> {
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    if (process.env.NODE_ENV === "production") throw new Error("Supabase is not configured.");
    const file = path.join(process.cwd(), "data", `${code}.json`);
    try { return JSON.parse(await readFile(file, "utf8")); } catch { return {}; }
  }
  const { data, error } = await getSupabase().from("translations").select("key,entry").eq("language", code);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row) => [row.key, row.entry as TranslationRecord]));
}

export async function saveLanguage(code: string, entries: Record<string, TranslationRecord>) {
  const rows = Object.entries(entries).map(([key, entry]) => ({ language: code, key, entry }));
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    if (process.env.NODE_ENV === "production") throw new Error("Supabase is not configured.");
    const { mkdir, readFile, writeFile } = await import("node:fs/promises");
    const dir = path.join(process.cwd(), "data");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${code}.json`);
    let current = {};
    try { current = JSON.parse(await readFile(file, "utf8")); } catch { /* new language file */ }
    await writeFile(file, JSON.stringify({ ...current, ...entries }, null, 2) + "\n", "utf8");
    return;
  }
  const { error } = await getSupabase().from("translations").upsert(rows, { onConflict: "language,key" });
  if (error) throw error;
}
