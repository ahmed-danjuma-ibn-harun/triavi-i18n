"""
One-shot deployment script for the Triavi Localization Annotation Tool.

What it does, in order:
  1. Creates a private Hugging Face dataset repo (for persisting translations
     across Space restarts).
  2. Creates a private Hugging Face Space (Streamlit SDK).
  3. Uploads every project file to the Space.
  4. Sets the Space secrets: ANNOTATOR_PASSWORD, HF_TOKEN, DATA_REPO_ID.

Usage:
  1. Get a token with WRITE access: https://huggingface.co/settings/tokens
  2. Fill in the four CONFIG values below.
  3. Run:  python3 deploy_to_hf.py

Safe to re-run: repos are created with exist_ok=True and file uploads
overwrite in place, so running it again just re-syncs everything.
"""

import os
from huggingface_hub import HfApi

# ────────────────────────────────────────────────────────────────────
# CONFIG — fill these in before running
# ────────────────────────────────────────────────────────────────────
HF_TOKEN = "..."   # your write-access token
HF_USERNAME = "...."                       # your HF username or org
SPACE_NAME = "..."                     # Space slug (letters/numbers/hyphens)
DATASET_NAME = "..."                      # dataset slug for storage
ANNOTATOR_PASSWORD = "..."                      # shared password annotators will use
# ────────────────────────────────────────────────────────────────────

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
SPACE_REPO_ID = f"{HF_USERNAME}/{SPACE_NAME}"
DATASET_REPO_ID = f"{HF_USERNAME}/{DATASET_NAME}"


def main():
    if HF_TOKEN.startswith("hf_xxxx"):
        raise SystemExit(
            "Edit deploy_to_hf.py first: set HF_TOKEN, HF_USERNAME, SPACE_NAME, "
            "DATASET_NAME, and ANNOTATOR_PASSWORD at the top of the file."
        )

    api = HfApi(token=HF_TOKEN)

    print(f"1/4  Creating private dataset repo: {DATASET_REPO_ID}")
    api.create_repo(
        repo_id=DATASET_REPO_ID,
        repo_type="dataset",
        private=True,
        exist_ok=True,
    )

    print(f"2/4  Creating private Space: {SPACE_REPO_ID}")
    # NOTE: Hugging Face deprecated space_sdk="streamlit" for new Spaces
    # created via the API/CLI. We create the repo as a Docker Space; the
    # actual runtime (Streamlit on port 8501) is defined by Dockerfile
    # and the "sdk: docker" / "app_port: 8501" front matter in README.md,
    # both of which get uploaded in the next step.
    api.create_repo(
        repo_id=SPACE_REPO_ID,
        repo_type="space",
        private=True,
        exist_ok=True,
        space_sdk="docker",
    )

    print("3/4  Uploading project files to the Space")
    api.upload_folder(
        folder_path=PROJECT_DIR,
        repo_id=SPACE_REPO_ID,
        repo_type="space",
        ignore_patterns=[
            "deploy_to_hf.py",
            "__pycache__/*",
            "*.pyc",
            ".git/*",
            "streamlit*.log",
        ],
        commit_message="Deploy Triavi localization tool",
    )

    print("4/4  Setting Space secrets")
    for key, value in [
        ("ANNOTATOR_PASSWORD", ANNOTATOR_PASSWORD),
        ("HF_TOKEN", HF_TOKEN),
        ("DATA_REPO_ID", DATASET_REPO_ID),
    ]:
        api.add_space_secret(repo_id=SPACE_REPO_ID, key=key, value=value)

    print()
    print("Done. Your Space is building at:")
    print(f"  https://huggingface.co/spaces/{SPACE_REPO_ID}")
    print("It usually takes 1-3 minutes to build the first time.")
    print()
    print("IMPORTANT: delete or rotate the token in this file once you're done —")
    print("don't commit deploy_to_hf.py with a real token in it anywhere public.")


if __name__ == "__main__":
    main()
