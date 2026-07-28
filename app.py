"""
Triavi Localization Annotation Tool
------------------------------------
A Streamlit dashboard for annotators to translate Triavi's English UI
strings into other languages, including Nigerian languages.

Flow:
  1. Login (name + shared annotator password)
  2. Pick a target language
  3. Translate strings section-by-section, with autosave to disk
  4. Track progress, validate placeholders, export results
"""

import json
import os
import re
from datetime import datetime, timezone

import pandas as pd
import streamlit as st

from languages import language_options, label_for
import hf_storage

# ────────────────────────────────────────────────────────────────────
# Config
# ────────────────────────────────────────────────────────────────────
APP_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(APP_DIR, "data")
STRINGS_PATH = os.path.join(APP_DIR, "en_strings.json")
LOGO_PATH = os.path.join(APP_DIR, "assets", "brand-logo-trimmed.png")
LOGO_FULL_PATH = os.path.join(APP_DIR, "assets", "brand-logo.png")
os.makedirs(DATA_DIR, exist_ok=True)

DEFAULT_PASSWORD = "triavi2026"  # change via st.secrets["ANNOTATOR_PASSWORD"]

st.set_page_config(
    page_title="Triavi Localization",
    page_icon=LOGO_PATH if os.path.exists(LOGO_PATH) else "🌍",
    layout="wide",
)

if os.path.exists(LOGO_PATH):
    st.logo(LOGO_PATH, icon_image=LOGO_PATH)


@st.cache_resource
def hydrate_from_remote_dataset():
    """One-time-per-container pull of all saved translations from the
    private HF dataset repo, so a Space restart doesn't lose progress."""
    lang_codes = [o["code"] for o in language_options()]
    hf_storage.pull_all(lang_codes, DATA_DIR)
    return True


hydrate_from_remote_dataset()


def get_annotator_password():
    try:
        return st.secrets["ANNOTATOR_PASSWORD"]
    except Exception:
        return DEFAULT_PASSWORD


# ────────────────────────────────────────────────────────────────────
# Data loading helpers
# ────────────────────────────────────────────────────────────────────
@st.cache_data
def load_source_strings():
    with open(STRINGS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def translation_path(lang_code):
    return os.path.join(DATA_DIR, f"{lang_code}.json")


def load_translations(lang_code):
    path = translation_path(lang_code)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_translations(lang_code, data):
    path = translation_path(lang_code)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def check_placeholders(en_text, translated_text, placeholders):
    if not placeholders or not translated_text:
        return True
    return all(f"{{{p}}}" in translated_text for p in placeholders)


# ────────────────────────────────────────────────────────────────────
# Session state init
# ────────────────────────────────────────────────────────────────────
defaults = {
    "authed": False,
    "annotator_name": "",
    "lang_code": None,
    "lang_label": None,
}
for k, v in defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v


# ────────────────────────────────────────────────────────────────────
# Page: Login
# ────────────────────────────────────────────────────────────────────
def render_login():
    if os.path.exists(LOGO_FULL_PATH):
        c1, c2, c3 = st.columns([1, 2, 1])
        with c2:
            st.image(LOGO_FULL_PATH, use_container_width=True)

    st.title("🌍 Triavi Localization Annotation Tool")
    st.caption("Sign in to start translating Triavi's patient-facing strings.")

    with st.form("login_form"):
        name = st.text_input("Your name", placeholder="e.g. John A.")
        password = st.text_input("Annotator password", type="password")
        submitted = st.form_submit_button("Sign in", use_container_width=True)

    if submitted:
        if not name.strip():
            st.error("Please enter your name.")
        elif password != get_annotator_password():
            st.error("Incorrect password. Contact the project admin if you don't have one.")
        else:
            st.session_state.authed = True
            st.session_state.annotator_name = name.strip()
            st.rerun()

    st.info(
        "This is a shared-password gate for the annotation team, not a full "
        "account system. Each annotator's name is recorded against every "
        "string they translate."
    )


# ────────────────────────────────────────────────────────────────────
# Page: Language picker
# ────────────────────────────────────────────────────────────────────
def render_language_picker():
    st.title("🌍 Choose a language to annotate")
    st.caption(f"Signed in as **{st.session_state.annotator_name}**")

    options = language_options()
    labels = [label_for(o) for o in options]

    # Show existing progress next to each language
    src = load_source_strings()
    total = len(src["entries"])

    search = st.text_input("Search languages", placeholder="e.g. Yoruba, Hausa, Spanish…")
    filtered = [
        (o, l) for o, l in zip(options, labels) if search.lower() in l.lower()
    ] if search else list(zip(options, labels))

    cols = st.columns(3)
    for i, (opt, label) in enumerate(filtered):
        existing = load_translations(opt["code"])
        done = sum(1 for v in existing.values() if v.get("translation", "").strip())
        pct = int(100 * done / total) if total else 0
        with cols[i % 3]:
            with st.container(border=True):
                st.markdown(f"**{opt['name']}**")
                st.caption(opt["region"] + (f" · {opt['native']}" if opt["native"] != opt["name"] else ""))
                st.progress(pct / 100, text=f"{done}/{total} strings ({pct}%)")
                if st.button("Select", key=f"sel_{opt['code']}", use_container_width=True):
                    st.session_state.lang_code = opt["code"]
                    st.session_state.lang_label = opt["name"]
                    st.rerun()

    if not filtered:
        st.warning("No languages match your search.")

    st.divider()
    if st.button("Log out"):
        st.session_state.authed = False
        st.session_state.annotator_name = ""
        st.rerun()


# ────────────────────────────────────────────────────────────────────
# Page: Annotation workspace
# ────────────────────────────────────────────────────────────────────
def render_annotation():
    src = load_source_strings()
    entries = src["entries"]
    sections = src["sections"]
    lang_code = st.session_state.lang_code
    lang_label = st.session_state.lang_label

    existing = load_translations(lang_code)

    # Sidebar: navigation + progress
    with st.sidebar:
        st.markdown(f"### 🌍 {lang_label}")
        st.caption(f"Annotator: {st.session_state.annotator_name}")
        if hf_storage.enabled():
            st.caption("☁️ Cloud sync: on — saves persist across restarts")
        else:
            st.caption("💾 Cloud sync: off — saving to local disk only")

        total = len(entries)
        done = sum(1 for v in existing.values() if v.get("translation", "").strip())
        st.progress(done / total if total else 0, text=f"{done}/{total} translated overall")

        st.markdown("---")
        section_counts = {}
        for e in entries:
            section_counts.setdefault(e["section"], {"total": 0, "done": 0})
            section_counts[e["section"]]["total"] += 1
            if existing.get(e["key"], {}).get("translation", "").strip():
                section_counts[e["section"]]["done"] += 1

        section_labels = [
            f'{s}  ({section_counts[s]["done"]}/{section_counts[s]["total"]})' for s in sections
        ]
        chosen_idx = st.radio(
            "Section",
            options=range(len(sections)),
            format_func=lambda i: section_labels[i],
            label_visibility="collapsed",
        )
        current_section = sections[chosen_idx]

        st.markdown("---")
        search = st.text_input("🔎 Search key or English text")

        st.markdown("---")
        if st.button("Change language"):
            st.session_state.lang_code = None
            st.session_state.lang_label = None
            st.rerun()
        if st.button("Log out"):
            st.session_state.authed = False
            st.session_state.annotator_name = ""
            st.session_state.lang_code = None
            st.rerun()

    st.title(f"Translating into {lang_label}")
    st.caption(f"Section: **{current_section}**")

    # Build the working dataframe for this section (or search results across all sections)
    if search:
        rows = [e for e in entries if search.lower() in e["key"].lower() or search.lower() in e["value"].lower()]
        st.caption(f"Showing {len(rows)} result(s) for '{search}' across all sections")
    else:
        rows = [e for e in entries if e["section"] == current_section]

    if not rows:
        st.info("No strings found.")
        return

    df = pd.DataFrame([
        {
            "Key": r["key"],
            "English": r["value"],
            "Placeholders": ", ".join(r["placeholders"]) if r["placeholders"] else "",
            "Translation": existing.get(r["key"], {}).get("translation", ""),
        }
        for r in rows
    ])

    edited = st.data_editor(
        df,
        column_config={
            "Key": st.column_config.TextColumn("Key", disabled=True, width="small"),
            "English": st.column_config.TextColumn("English", disabled=True, width="large"),
            "Placeholders": st.column_config.TextColumn("Placeholders", disabled=True, width="small"),
            "Translation": st.column_config.TextColumn("Translation", width="large"),
        },
        hide_index=True,
        use_container_width=True,
        height=min(600, 60 + 38 * len(df)),
        key=f"editor_{current_section if not search else 'search'}",
    )

    col1, col2, col3 = st.columns([1, 1, 3])
    with col1:
        save_clicked = st.button("💾 Save this view", type="primary", use_container_width=True)
    with col2:
        clear_clicked = st.button("Reload without saving", use_container_width=True)

    if clear_clicked:
        st.rerun()

    if save_clicked:
        now = datetime.now(timezone.utc).isoformat()
        warnings = []
        key_to_placeholders = {r["key"]: r["placeholders"] for r in rows}
        key_to_en = {r["key"]: r["value"] for r in rows}

        for _, row in edited.iterrows():
            k = row["Key"]
            t = str(row["Translation"] or "").strip()
            if not t:
                continue
            if not check_placeholders(key_to_en[k], t, key_to_placeholders[k]):
                warnings.append((k, key_to_placeholders[k]))
            existing[k] = {
                "en": key_to_en[k],
                "translation": t,
                "annotator": st.session_state.annotator_name,
                "updated_at": now,
            }

        save_translations(lang_code, existing)

        sync_error = hf_storage.push_language(lang_code, translation_path(lang_code))
        if hf_storage.enabled() and sync_error is None:
            st.success(f"Saved {len(edited)} rows to {lang_code}.json and synced to cloud storage")
        elif hf_storage.enabled() and sync_error:
            st.warning(f"Saved locally, but cloud sync failed: {sync_error}")
        else:
            st.success(f"Saved {len(edited)} rows to {lang_code}.json")

        if warnings:
            with st.expander(f"⚠️ {len(warnings)} translation(s) may be missing placeholders", expanded=True):
                for k, ph in warnings:
                    st.write(f"**{k}** — expected: {', '.join('{'+p+'}' for p in ph)}")

        st.rerun()

    st.divider()
    render_export(lang_code, lang_label, entries)


def render_export(lang_code, lang_label, entries):
    existing = load_translations(lang_code)
    with st.expander("📤 Export translations"):
        c1, c2 = st.columns(2)

        export_json = json.dumps(existing, ensure_ascii=False, indent=2)
        c1.download_button(
            "Download as JSON",
            data=export_json,
            file_name=f"{lang_code}_translations.json",
            mime="application/json",
            use_container_width=True,
        )

        ts_lines = [f'import type {{ LocaleStrings }} from "./types";', "", f"export const {lang_code} = {{"]
        last_section = None
        for e in entries:
            if e["section"] != last_section:
                ts_lines.append(f"  // ── {e['section']} " + "─" * 10)
                last_section = e["section"]
            val = existing.get(e["key"], {}).get("translation", "") or e["value"]
            escaped = val.replace("\\", "\\\\").replace('"', '\\"')
            ts_lines.append(f'  {e["key"]}: "{escaped}",')
        ts_lines.append("};")
        ts_content = "\n".join(ts_lines)

        c2.download_button(
            f"Download as {lang_code}.ts",
            data=ts_content,
            file_name=f"{lang_code}.ts",
            mime="text/plain",
            use_container_width=True,
        )
        st.caption(
            "Untranslated keys fall back to the English source string in both exports "
            "so the file stays drop-in compatible with the app's i18n loader."
        )


# ────────────────────────────────────────────────────────────────────
# Router
# ────────────────────────────────────────────────────────────────────
if not st.session_state.authed:
    render_login()
elif not st.session_state.lang_code:
    render_language_picker()
else:
    render_annotation()