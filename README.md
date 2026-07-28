---
title: Triavi Localization Annotation Tool
emoji: 🌍
colorFrom: blue
colorTo: green
sdk: docker
app_port: 8501
pinned: false
---

# Triavi Localization Annotation Tool

A Streamlit dashboard for translating Triavi's patient-facing UI strings
(`en.ts`) into other languages, with priority coverage for Nigerian
languages (Yoruba, Igbo, Hausa, Nigerian Pidgin, and 13 more).

> The block above is Hugging Face Space metadata — only relevant if you
> use the optional paid HF Space path below. It's harmless everywhere
> else, including on Streamlit Community Cloud (the free option this
> project defaults to), since it's just YAML front-matter in a
> markdown file.

## What it does

1. **Login** — annotator enters their name + a shared password. Every
   translation they save is stamped with their name and a timestamp.
2. **Language picker** — grid of 94 languages (Nigerian languages listed
   first), each showing live progress (e.g. "112/429 strings").
3. **Annotation workspace** — sidebar lists all 32 source sections
   (Welcome screen, Interview step, Dashboard, Auth flows, etc.) with a
   done/total count per section. The main table is editable inline;
   `{placeholder}` tokens (like `{name}`, `{hospital}`) are shown in
   their own column, and saving flags any translation that's missing a
   placeholder the English source has.
4. **Search** — find a string across all sections by key or English text.
5. **Export** — download the language's translations as JSON, or as a
   drop-in `<lang>.ts` file (untranslated keys fall back to English so
   the file is always safe to ship).

The Triavi logo (`assets/brand-logo.png`, plus a tightly-cropped
`assets/brand-logo-trimmed.png` used as the sidebar/tab icon) appears on
the login screen and persistently in the sidebar via `st.logo(...)`. The
built-in dark theme (`.streamlit/config.toml`) matches the logo's black
background so it blends in rather than showing a black box on white.

## Run locally

```bash
pip install -r requirements.txt
streamlit run app.py
```

Open http://localhost:8501.

## Set the annotator password

By default the password is `triavi2026`. To change it, create
`.streamlit/secrets.toml` next to `app.py`:

```toml
ANNOTATOR_PASSWORD = "your-team-password"
```

On a Hugging Face Space, set this as a **secret** instead (see below).

## Where translations are stored (and how they survive restarts)

Each language's work is saved to `data/<lang_code>.json`, e.g.
`data/yo.json` for Yoruba, `data/pcm.json` for Nigerian Pidgin. Each
entry stores the English source, the translation, the annotator's name,
and a UTC timestamp — so multiple annotators can safely pick up where
someone left off.

**The catch on Hugging Face Spaces:** the free/standard container's disk
is ephemeral — a restart, rebuild, or sleep/wake cycle wipes anything
written to local disk, including `data/`. To solve this, `hf_storage.py`
mirrors every `data/<lang_code>.json` file to a **private Hugging Face
dataset repo**, which is durable storage:

- At startup, the app pulls all existing translation files from the
  dataset into local `data/` (so a restarted Space picks up right where
  it left off).
- Every time an annotator clicks **Save**, the updated file is pushed
  back to the dataset.
- The sidebar shows "☁️ Cloud sync: on" when this is configured, or
  "💾 Cloud sync: off — saving to local disk only" if it isn't (the app
  still works fine locally without it — it just won't survive a Space
  restart).

This is optional and off by default. To turn it on:

1. Create a **private dataset** repo on Hugging Face, e.g.
   `your-username/triavi-i18n-data` (Hugging Face → New Dataset → Private).
2. Create an **access token** with write permissions
   (Settings → Access Tokens).
3. In your Space's **Settings → Variables and secrets**, add:
   - `HF_TOKEN` = the token from step 2
   - `DATA_REPO_ID` = `your-username/triavi-i18n-data`

No code changes needed — `hf_storage.py` picks these up automatically.

## Deploying (free): Streamlit Community Cloud

Hugging Face changed their pricing after this project started — Docker
Spaces (which Streamlit now requires there) are no longer free, even
private ones. Streamlit Community Cloud is free, supports one private
app per account, and needs no Dockerfile — the pieces built for HF
(the logo, dark theme, and especially `hf_storage.py`'s persistence
sync) all still work unchanged; the only thing that moves is where
secrets are configured.

1. **Push this project to a GitHub repo** (private is fine — Community
   Cloud connects directly to private repos).
   ```bash
   git init
   git add .
   git commit -m "Triavi localization tool"
   git remote add origin https://github.com/<you>/triavi-i18n.git
   git push -u origin main
   ```
   Make sure `.gitignore` (included) keeps `.streamlit/secrets.toml` and
   the real token in `deploy_to_hf.py` out of the repo.

2. **Deploy**: go to https://share.streamlit.io, sign in with GitHub,
   click **New app**, pick the repo/branch, and set the main file path
   to `app.py`.

3. **Set secrets**: in the app's **Settings → Secrets**, paste:
   ```toml
   ANNOTATOR_PASSWORD = "your-team-password"
   HF_TOKEN = "hf_xxx..."            # write-access token
   DATA_REPO_ID = "Ahmed-ibn-Harun/triavi-i18n-data"
   ```
   (The dataset repo already exists from the earlier `deploy_to_hf.py`
   run — no need to recreate it.)

4. **Make it private**: in **Settings → Sharing**, switch the app to
   private and add each annotator's email as a viewer. The free tier
   allows one private app, which is exactly what this is.

5. Once it's live, confirm the sidebar shows "☁️ Cloud sync: on" after
   logging in — that means `hf_storage.py` found both secrets and
   translations are being mirrored to the dataset repo.

The `Dockerfile` and `.dockerignore` in this folder are unused on
Streamlit Community Cloud (it builds straight from `requirements.txt`)
— they're harmless to leave in the repo in case you switch hosts later.

## Alternative (paid): private Hugging Face Space

If you'd rather keep everything on Hugging Face, `deploy_to_hf.py` still
works end-to-end — but Docker Spaces now require an HF **PRO**
subscription ($9/mo), even for private Spaces on CPU Basic hardware.
If you go this route: subscribe at https://huggingface.co/pro, fill in
`deploy_to_hf.py`'s config block, and run it. It creates the private
dataset, creates the private Docker Space, uploads every file, and sets
all three secrets in one pass.

## Regenerating strings from a new en.ts

If `en.ts` changes upstream, re-run:

```bash
python3 parse_en.py
```

This regenerates `en_strings.json` (429 keys currently), which the app
reads at startup. Existing translations in `data/*.json` are unaffected
and will simply be matched up against the new key set.

## Files

- `app.py` — the Streamlit app (login → language picker → annotation UI)
- `languages.py` — the 94-language catalog (17 Nigerian languages + major
  world languages), edit this list to add/remove languages
- `parse_en.py` — one-time parser that turns `en.ts` into `en_strings.json`
- `en_strings.json` — parsed source strings (429 keys, 32 sections)
- `data/` — per-language translation progress (created at runtime)
