import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY before importing.");

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const files = (await readdir(path.join(root, "data"))).filter((name) => name.endsWith(".json"));
let total = 0;
for (const file of files) {
  const language = file.slice(0, -5);
  const content = JSON.parse(await readFile(path.join(root, "data", file), "utf8"));
  const rows = Object.entries(content).map(([key, entry]) => ({ language, key, entry }));
  for (let offset = 0; offset < rows.length; offset += 500) {
    const { error } = await supabase.from("translations").upsert(rows.slice(offset, offset + 500), { onConflict: "language,key" });
    if (error) throw new Error(`${language}: ${error.message}`);
  }
  total += rows.length;
  console.log(`${language}: imported ${rows.length} entries`);
}
console.log(`Imported ${total} entries across ${files.length} languages.`);
