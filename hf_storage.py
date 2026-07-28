"""
Persistence layer that works regardless of where the app is hosted
(Streamlit Community Cloud, a Hugging Face Space, or your own machine).

Free/standard hosting containers are often ephemeral: a restart, rebuild,
or sleep/wake cycle can wipe anything written to local disk. To survive
that, this module mirrors every `data/<lang_code>.json` file to a
private Hugging Face *dataset* repo, which is durable storage.

It is entirely optional and fails silently:
- Without HF_TOKEN / DATA_REPO_ID configured, the app just uses local
  disk, exactly as before.
- With those two set, translations are pulled from the dataset once at
  startup (hydrating local disk) and pushed back to the dataset every
  time an annotator hits "Save".

Where to set HF_TOKEN / DATA_REPO_ID:
- Streamlit Community Cloud: App settings → Secrets (TOML format)
- Hugging Face Space: Settings → Variables and secrets
- Local dev: .streamlit/secrets.toml, or plain environment variables

Required values:
  HF_TOKEN      a token with WRITE access to the dataset repo
  DATA_REPO_ID  e.g. "your-username/triavi-i18n-data" (a private dataset)
"""

import os

try:
    import streamlit as st
except ImportError:
    st = None

try:
    from huggingface_hub import HfApi, hf_hub_download
    from huggingface_hub.utils import EntryNotFoundError, RepositoryNotFoundError
    _HUB_AVAILABLE = True
except ImportError:
    _HUB_AVAILABLE = False


def _get_setting(key):
    """Check st.secrets first (Streamlit Community Cloud / .streamlit/secrets.toml),
    then fall back to a plain environment variable (Docker / other hosts)."""
    if st is not None:
        try:
            if key in st.secrets:
                return st.secrets[key]
        except Exception:
            pass
    return os.environ.get(key)


def enabled():
    return _HUB_AVAILABLE and bool(_get_setting("HF_TOKEN")) and bool(_get_setting("DATA_REPO_ID"))


def _api():
    return HfApi(token=_get_setting("HF_TOKEN"))


def pull_language(lang_code, local_path):
    """Overwrite local_path with the remote copy, if one exists. No-op if disabled."""
    if not enabled():
        return
    repo_id = _get_setting("DATA_REPO_ID")
    try:
        remote_path = hf_hub_download(
            repo_id=repo_id,
            repo_type="dataset",
            filename=f"data/{lang_code}.json",
            token=_get_setting("HF_TOKEN"),
        )
        with open(remote_path, "r", encoding="utf-8") as f:
            content = f.read()
        with open(local_path, "w", encoding="utf-8") as f:
            f.write(content)
    except EntryNotFoundError:
        pass  # nothing saved for this language yet — that's fine
    except RepositoryNotFoundError:
        pass  # repo not created yet, or token can't see it
    except Exception:
        pass  # never let a sync hiccup crash the app


def pull_all(lang_codes, data_dir):
    """Hydrate local data/ from the dataset repo. Call once at app startup."""
    if not enabled():
        return
    for code in lang_codes:
        pull_language(code, os.path.join(data_dir, f"{code}.json"))


def push_language(lang_code, local_path):
    """Upload local_path to the dataset repo. Returns an error string, or None on success."""
    if not enabled():
        return None
    repo_id = _get_setting("DATA_REPO_ID")
    try:
        _api().upload_file(
            path_or_fileobj=local_path,
            path_in_repo=f"data/{lang_code}.json",
            repo_id=repo_id,
            repo_type="dataset",
            commit_message=f"Update {lang_code} translations",
        )
        return None
    except Exception as e:
        return str(e)
