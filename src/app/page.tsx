"use client";

import { useEffect, useMemo, useState } from "react";
import AdminPanel from "./admin-panel";

type Annotator = { email: string; display_name: string; language: string };
type Language = { code: string; name: string; native: string; region: string; reviewed: number; drafts: number; total: number };
type SourceEntry = { key: string; value: string; section: string; placeholders: string[] };
type Translation = { en: string; translation: string; annotator: string; updated_at: string; source: string; reviewed: boolean };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}

export default function Home() {
  const [annotator, setAnnotator] = useState<Annotator | null>(null);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [language, setLanguage] = useState<Language | null>(null);
  const [workspaceLanguages, setWorkspaceLanguages] = useState<Language[]>([]);
  const [entries, setEntries] = useState<SourceEntry[]>([]);
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [section, setSection] = useState("All sections");
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const dark = window.localStorage.getItem("triavi-theme") === "dark";
    setDarkMode(dark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, []);

  function toggleTheme() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("triavi-theme", next ? "dark" : "light");
  }

  async function loadAssignedWorkspace(person: Annotator) {
    const info = await api<{ languages: Language[] }>("/api/languages");
    setWorkspaceLanguages(info.languages);
    const assigned = info.languages.find((item) => item.code === person.language) ?? info.languages[0];
    if (!assigned || assigned.code !== person.language) throw new Error("Your assigned language is not configured. Contact the project administrator.");
    const result = await api<{ entries: SourceEntry[]; translations: Record<string, Translation> }>(`/api/entries?lang=${encodeURIComponent(assigned.code)}`);
    setLanguage(assigned);
    setEntries(result.entries);
    setTranslations(result.translations);
  }

  async function switchWorkspaceLanguage(code: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{ entries: SourceEntry[]; translations: Record<string, Translation> }>(`/api/entries?lang=${encodeURIComponent(code)}`);
      setLanguage(workspaceLanguages.find((item) => item.code === code) ?? null);
      setEntries(result.entries); setTranslations(result.translations); setSection("All sections"); setSearch("");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const token = params.get("token");
        if (token) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
          setPendingToken(token);
        }
        const result = await api<{ annotator: Annotator | null; isSuperAdmin: boolean }>("/api/auth");
        if (!cancelled && result.annotator) {
          setAnnotator(result.annotator);
          setSuperAdmin(result.isSuperAdmin);
          await loadAssignedWorkspace(result.annotator);
        }
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setInitialized(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  const sections = useMemo(() => [...new Set(entries.map((entry) => entry.section))], [entries]);
  const visible = useMemo(() => entries.filter((entry) => {
    const sectionMatch = section === "All sections" || entry.section === section;
    const query = search.trim().toLowerCase();
    return sectionMatch && (!query || entry.key.toLowerCase().includes(query) || entry.value.toLowerCase().includes(query));
  }), [entries, section, search]);
  const reviewedCount = Object.values(translations).filter((item) => item.reviewed && item.translation?.trim()).length;

  async function requestLink(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{ message: string }>("/api/auth/request", { method: "POST", body: JSON.stringify({ email }) });
      setLinkSent(true); setNotice(result.message);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function continueSignIn() {
    if (!pendingToken) return;
    setBusy(true); setError("");
    try {
      await api("/api/auth/consume", { method: "POST", body: JSON.stringify({ token: pendingToken }) });
      setPendingToken(null);
      const result = await api<{ annotator: Annotator | null; isSuperAdmin: boolean }>("/api/auth");
      if (!result.annotator) throw new Error("Could not verify your sign-in. Request a new link.");
      setAnnotator(result.annotator); setSuperAdmin(result.isSuperAdmin);
      await loadAssignedWorkspace(result.annotator);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function logout() {
    await api("/api/auth", { method: "POST", body: JSON.stringify({}) });
    setAnnotator(null); setSuperAdmin(false); setAdminMode(false); setLanguage(null);
    setEntries([]); setTranslations({}); setLinkSent(false); setNotice("");
  }

  function updateTranslation(key: string, translation: string) {
    setTranslations((current) => ({ ...current, [key]: { ...(current[key] ?? { en: entries.find((entry) => entry.key === key)?.value ?? "", annotator: "", updated_at: "", source: "", reviewed: false }), translation } }));
  }
  function updateReviewed(key: string, reviewed: boolean) {
    setTranslations((current) => ({ ...current, [key]: { ...(current[key] ?? { en: entries.find((entry) => entry.key === key)?.value ?? "", translation: "", annotator: "", updated_at: "", source: "", reviewed: false }), reviewed } }));
  }
  async function save() {
    if (!language) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const rows = visible.map((entry) => ({ key: entry.key, translation: translations[entry.key]?.translation ?? "", reviewed: translations[entry.key]?.reviewed ?? false }));
      const result = await api<{ warnings: string[] }>("/api/save", { method: "POST", body: JSON.stringify({ lang: language.code, rows }) });
      setSavedAt(new Date().toLocaleTimeString());
      setNotice(result.warnings.length ? `Saved. Check placeholders in: ${result.warnings.join(", ")}` : `Saved ${rows.filter((row) => row.translation.trim()).length} visible entries.`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function download(format: "json" | "ts") {
    if (!language) return;
    const payload = format === "json"
      ? JSON.stringify(translations, null, 2)
      : `export const ${language.code.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())} = {\n` + entries.map((entry) => `  ${entry.key}: ${JSON.stringify(translations[entry.key]?.reviewed && translations[entry.key].translation ? translations[entry.key].translation : entry.value)},`).join("\n") + "\n};\n";
    const blob = new Blob([payload], { type: format === "json" ? "application/json;charset=utf-8" : "text/typescript;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `${language.code}_translations.${format}`; link.click(); URL.revokeObjectURL(url);
  }

  if (!initialized) return <main className="loading">Verifying your access…</main>;
  if (!annotator) return <main className="login-shell"><section className="login-card"><div className="login-card-head"><div className="brand-mark">T</div><button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`} title={`Switch to ${darkMode ? "light" : "dark"} mode`}>{darkMode ? "☀" : "☾"}</button></div><p className="eyebrow">TRIAVI · LOCALIZATION</p><h1>Your language, made clearer.</h1>{pendingToken ? <><p className="muted">Your one-time sign-in link is ready. Continue to verify your email and open your assigned workspace.</p><div className="login-form">{error && <p className="error">{error}</p>}<button className="primary full" disabled={busy} onClick={continueSignIn}>{busy ? "Verifying…" : "Continue to my workspace"}</button></div></> : <><p className="muted">Sign in with the email assigned to your translation work. We’ll send a private, one-time link.</p>{!linkSent ? <form onSubmit={requestLink} className="login-form"><label>Work email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>{error && <p className="error">{error}</p>}<button className="primary full" disabled={busy}>{busy ? "Sending link…" : "Email me a sign-in link"}</button></form> : <div className="email-sent"><div className="email-icon">✉</div><h2>Check your inbox</h2><p className="muted">{notice}</p><button className="quiet" onClick={() => { setLinkSent(false); setNotice(""); }}>Use a different email</button></div>}{error && linkSent && <p className="error">{error}</p>}</>}<p className="tiny muted">Access is available only to invited email addresses and is limited to the language assigned to that account.</p></section></main>;
  if (!language) return <main className="loading">{error || "Loading your assigned language…"}</main>;

  return <main className="workspace"><header className="topbar"><div className="brand"><span className="brand-mark small">T</span><span>Triavi <b>Localization</b></span></div><div className="workspace-actions">{superAdmin ? <select className="workspace-language-select" aria-label="Workspace language" value={language.code} onChange={(e) => switchWorkspaceLanguage(e.target.value)}>{workspaceLanguages.map((item) => <option key={item.code} value={item.code}>{item.name} · {item.code}</option>)}</select> : <span className="current-language">Assigned language <b>{language.name}</b></span>}<span className="current-user">{annotator.email}</span>{superAdmin && <button className="quiet" onClick={() => setAdminMode(!adminMode)}>{adminMode ? "Workspace" : "Super-admin"}</button>}<button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`} title={`Switch to ${darkMode ? "light" : "dark"} mode`}>{darkMode ? "☀" : "☾"}</button><button className="quiet" onClick={logout}>Log out</button></div></header>{adminMode && superAdmin ? <AdminPanel onBack={() => setAdminMode(false)} /> : <div className="workspace-layout"><aside className="side-panel"><p className="eyebrow">{superAdmin ? "WORKSPACE LANGUAGE" : "YOUR ASSIGNED LANGUAGE"}</p><h2>{language.name}</h2><p className="muted native-line">{language.native} · {language.region}</p><div className="side-progress"><span>{reviewedCount} / {entries.length} reviewed</span><div className="progress-track"><i style={{ width: `${reviewedCount / Math.max(1, entries.length) * 100}%` }} /></div></div><label className="side-label">Screen section<select value={section} onChange={(e) => setSection(e.target.value)}><option>All sections</option>{sections.map((name) => <option key={name}>{name}</option>)}</select></label><label className="side-label">Find source text<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search key or English…" /></label><div className="side-bottom">{superAdmin && <><div className="autosave"><span className="online-dot" /> Supabase connected</div><button className="secondary full" onClick={() => download("json")}>Download JSON</button><button className="secondary full" onClick={() => download("ts")}>Download TypeScript</button></>}<span className="tiny muted">{savedAt ? `Last saved ${savedAt}` : "Save your edits when ready"}</span></div></aside><section className="editor"><div className="editor-heading"><div><p className="eyebrow">{section === "All sections" ? "FULL CATALOG" : "SCREEN SECTION"}</p><h1>{section === "All sections" ? "Patient screens" : section}</h1><p className="muted">{search ? `${visible.length} matches across your assigned catalog` : `${visible.length} strings · Review translations before shipping`}</p></div><button className="primary save-button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save visible strings"}</button></div>{error && <p className="error inline-message">{error}</p>}{notice && <p className="notice inline-message">{notice}</p>}<div className="entry-list">{visible.map((entry) => { const current = translations[entry.key]; const reviewed = Boolean(current?.reviewed); return <article className="entry-card" key={entry.key}><div className="entry-source"><div className="entry-key">{entry.key}<span>{entry.section}</span></div><p>{entry.value || <em className="muted">Empty source string</em>}</p>{entry.placeholders.length > 0 && <div className="tokens">Keep placeholders: {entry.placeholders.map((token) => <code key={token}>{`{${token}}`}</code>)}</div>}</div><div className="entry-translation"><textarea aria-label={`Translation for ${entry.key}`} value={current?.translation ?? ""} onChange={(e) => updateTranslation(entry.key, e.target.value)} placeholder="Enter translation…" rows={3} /><label className="review-check"><input type="checkbox" checked={reviewed} onChange={(e) => updateReviewed(entry.key, e.target.checked)} /> Reviewed</label></div></article>; })}{visible.length === 0 && <div className="empty-state">No strings match this search.</div>}</div></section></div>}</main>;
}
