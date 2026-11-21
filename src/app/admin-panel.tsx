"use client";

import { useEffect, useState } from "react";

type Language = { code: string; name: string; native: string; region: string };
type Annotator = { email: string; display_name: string; language: string; enabled: boolean; created_at: string };
type Activity = { id: number; email: string; display_name: string; language: string; key: string; translation: string; reviewed: boolean; created_at: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}

export default function AdminPanel({ onBack }: { onBack: () => void }) {
  const [annotators, setAnnotators] = useState<Annotator[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("es");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const result = await api<{ annotators: Annotator[]; activity: Activity[]; languages: Language[] }>("/api/admin");
    setAnnotators(result.annotators); setActivity(result.activity); setLanguages(result.languages);
    if (result.languages.length && !result.languages.some((item) => item.code === language)) setLanguage(result.languages[0].code);
  }
  useEffect(() => { refresh().catch((e) => setError(e.message)); }, []);

  async function invite(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{ inviteSent: boolean; inviteError: string | null }>("/api/admin", { method: "POST", body: JSON.stringify({ email, display_name: name, language, enabled: true, send_invite: true }) });
      setNotice(result.inviteSent ? `Access assigned and sign-in link sent to ${email}.` : `Access assigned, but the email was not sent: ${result.inviteError ?? "unknown email error"}`);
      setEmail(""); setName(""); await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function update(person: Annotator) {
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/admin", { method: "POST", body: JSON.stringify({ email: person.email, display_name: person.display_name, language: person.language, enabled: person.enabled, send_invite: false }) });
      setNotice(`Updated access for ${person.email}.`); await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return <section className="admin-view"><div className="admin-header"><div><p className="eyebrow">SUPER-ADMIN CONSOLE</p><h1>People & progress</h1><p className="muted">Invite translators, assign a language, and review the latest edits.</p></div><button className="secondary" onClick={onBack}>Back to my workspace</button></div>
    {error && <p className="error">{error}</p>}{notice && <p className="notice">{notice}</p>}
    <div className="admin-grid"><section className="admin-card"><p className="eyebrow">NEW TRANSLATOR</p><h2>Invite and assign</h2><form className="admin-form" onSubmit={invite}><label>Name<input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Translator name" /></label><label>Email<input required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="translator@example.com" /></label><label>Assigned language<select value={language} onChange={(e) => setLanguage(e.target.value)}>{languages.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}</select></label><button className="primary" disabled={busy}>{busy ? "Sending invite…" : "Invite translator"}</button></form></section><section className="admin-card"><div className="admin-card-title"><div><p className="eyebrow">ALLOWLIST</p><h2>Annotators</h2></div><span className="count-pill">{annotators.length}</span></div>{annotators.length === 0 ? <p className="muted">No annotators have been added yet.</p> : <div className="table-scroll"><table className="admin-table"><thead><tr><th>Person</th><th>Language</th><th>Access</th><th /></tr></thead><tbody>{annotators.map((person) => <tr key={person.email}><td><strong>{person.display_name}</strong><small>{person.email}</small></td><td><select aria-label={`Language for ${person.email}`} value={person.language} onChange={(e) => setAnnotators((all) => all.map((item) => item.email === person.email ? { ...item, language: e.target.value } : item))}>{languages.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></td><td><label className="enabled-control"><input type="checkbox" checked={person.enabled} onChange={(e) => setAnnotators((all) => all.map((item) => item.email === person.email ? { ...item, enabled: e.target.checked } : item))} /> {person.enabled ? "Enabled" : "Disabled"}</label></td><td><button className="quiet" disabled={busy} onClick={() => update(person)}>Save</button></td></tr>)}</tbody></table></div>}</section></div>
    <section className="admin-card activity-card"><div className="admin-card-title"><div><p className="eyebrow">TRANSLATION ACTIVITY</p><h2>Recent updates</h2></div><button className="quiet" onClick={() => refresh().catch((e) => setError(e.message))}>Refresh</button></div>{activity.length === 0 ? <p className="muted">No translation updates have been recorded yet.</p> : <div className="activity-list">{activity.map((item) => <article className="activity-item" key={item.id}><div className="activity-meta"><strong>{item.display_name}</strong><span>{item.email}</span><span>{languages.find((l) => l.code === item.language)?.name ?? item.language}</span><time>{new Date(item.created_at).toLocaleString()}</time></div><div className="activity-copy"><code>{item.key}</code><p>{item.translation}</p><span className={item.reviewed ? "activity-reviewed" : "activity-draft"}>{item.reviewed ? "Reviewed" : "Draft"}</span></div></article>)}</div>}</section>
  </section>;
}
