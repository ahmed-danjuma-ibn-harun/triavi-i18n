"""Refresh the annotation app's English source from Triavi's patient catalog."""

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent
DEFAULT_SOURCE = APP_DIR.parent / "triavi-frontend" / "lib" / "i18n" / "en.ts"
OUTPUT = APP_DIR / "en_strings.json"
KEY_START = re.compile(r'^\s*(?:([A-Za-z0-9_]+)|"([A-Za-z0-9_]+)"):\s*(.*)$')
SECTION_DECOR = "─-?><=*/. \t"


def decode_string(literal: str) -> str:
    try:
        return json.loads(literal)
    except json.JSONDecodeError:
        # TypeScript permits escaping a single quote inside double-quoted text.
        return json.loads(literal.replace("\\'", "'"))


def parse(source: Path) -> dict:
    text = source.read_text(encoding="utf-8-sig").replace("\r\n", "\n")
    entries = []
    section = "General"
    current_key = None
    current_lines = []

    def flush():
        if current_key is None:
            return
        joined = " ".join(part.strip() for part in current_lines)
        literals = re.findall(r'"(?:[^"\\]|\\.)*"', joined)
        value = "".join(decode_string(item) for item in literals)
        entries.append({
            "key": current_key,
            "value": value,
            "section": section,
            "placeholders": sorted(set(re.findall(r"\{([A-Za-z0-9_]+)\}", value))),
        })

    for line in text.split("\n"):
        stripped = line.strip()
        if stripped.startswith("//"):
            label = stripped.lstrip("/").strip(SECTION_DECOR)
            label = re.sub(r"[─]+", " ", label).strip()
            if 2 < len(label) <= 90 and re.search(r"[A-Za-z]", label):
                flush()
                current_key, current_lines = None, []
                section = label
            continue
        match = KEY_START.match(line)
        if match:
            flush()
            current_key = match.group(1) or match.group(2)
            current_lines = [match.group(3)]
        elif current_key and stripped:
            current_lines.append(stripped)
    flush()

    sections = list(dict.fromkeys(entry["section"] for entry in entries))
    return {"sections": sections, "entries": entries}


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--sync-locales":
        frontend_i18n = DEFAULT_SOURCE.parent
        locale_files = {
            "es": "es", "zh-Hans": "zh", "vi": "vi", "ar": "ar",
            "ur": "ur", "ig": "ig", "yo": "yo", "ha": "ha",
            "ff": "ff", "pcm": "pcm",
        }
        timestamp = datetime.now(timezone.utc).isoformat()
        english_entries = {entry["key"]: entry for entry in parse(DEFAULT_SOURCE)["entries"]}
        for data_code, catalog_code in locale_files.items():
            catalog = parse(frontend_i18n / f"{catalog_code}.ts")
            translations = {}
            for entry in catalog["entries"]:
                english = english_entries.get(entry["key"])
                if not english:
                    continue
                translations[entry["key"]] = {
                    "en": english["value"],
                    "translation": entry["value"],
                    "annotator": "Triavi patient UI catalog",
                    "updated_at": timestamp,
                    "source": "frontend",
                    "reviewed": True,
                }
            target = APP_DIR / "data" / f"{data_code}.json"
            target.write_text(json.dumps(translations, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"Synced {len(translations)} strings to data/{data_code}.json")
        raise SystemExit(0)

    source = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_SOURCE
    catalog = parse(source)
    OUTPUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Parsed {len(catalog['entries'])} strings from {source}")
    print(f"Sections: {len(catalog['sections'])}")
