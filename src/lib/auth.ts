import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getSupabase } from "@/lib/store";

export const sessionCookie = "triavi_annotator_session";
const sessionLifetime = 12 * 60 * 60 * 1000;
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export type Annotator = { email: string; display_name: string; language: string };

export async function currentAnnotator(): Promise<Annotator | null> {
  const jar = await cookies();
  const raw = jar.get(sessionCookie)?.value;
  if (!raw) return null;
  const { data: session } = await getSupabase().from("annotator_sessions").select("email,expires_at,revoked_at").eq("token_hash", hashToken(raw)).maybeSingle();
  if (!session || session.revoked_at || Date.parse(session.expires_at) <= Date.now()) return null;
  const { data: annotator } = await getSupabase().from("annotators").select("email,display_name,language,enabled").eq("email", session.email).maybeSingle();
  if (!annotator?.enabled) return null;
  return { email: annotator.email, display_name: annotator.display_name, language: annotator.language };
}

export function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge };
}

export const SESSION_TTL = sessionLifetime;
