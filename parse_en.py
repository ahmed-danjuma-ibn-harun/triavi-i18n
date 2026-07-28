import re
import json

with open("/mnt/user-data/uploads/en.ts", "r", encoding="utf-8-sig") as f:
    raw = f.read()

# Normalize line endings
raw = raw.replace("\r\n", "\n")

lines = raw.split("\n")

entries = []
current_section = "General"
i = 0
n = len(lines)

# Regex to detect a section comment line like: // ── Welcome screen ─...
decor_chars = "─-?><=*/. \t"
# Regex for key start: key: "..."  or key:\n "..."
key_start_re = re.compile(r'^\s*([A-Za-z0-9_]+):\s*(.*)$')

def strip_line_comment(s):
    return s

buffer_key = None
buffer_parts = []

def flush(key, parts):
    if key is None:
        return
    joined = " ".join(p.strip() for p in parts if p.strip())
    # extract the string literal(s) - value may be concatenation of quoted strings
    # find all quoted substrings using a JS-string-aware regex
    strs = re.findall(r'"((?:[^"\\]|\\.)*)"', joined)
    if not strs:
        strs = re.findall(r"'((?:[^'\\]|\\.)*)'", joined)
    value = "".join(strs)
    # unescape common JS escapes
    value = value.encode().decode("unicode_escape") if "\\u" in value else value
    value = value.replace('\\"', '"').replace("\\'", "'")
    placeholders = sorted(set(re.findall(r"\{([a-zA-Z0-9_]+)\}", value)))
    entries.append({
        "key": key,
        "value": value,
        "section": current_section,
        "placeholders": placeholders,
    })

for line in lines:
    stripped = line.strip()
    if not stripped:
        continue
    if stripped.startswith("import ") or stripped.startswith("export const"):
        continue
    if stripped == "};" or stripped == "}":
        continue

    if stripped.startswith("//"):
        text = stripped.lstrip("/")
        text = text.strip(decor_chars)
        text = re.sub(r"[─]+", " ", text).strip()
        if 2 < len(text) <= 70 and re.search(r"[A-Za-z]", text):
            if buffer_key:
                flush(buffer_key, buffer_parts)
                buffer_key, buffer_parts = None, []
            current_section = text
        continue

    km = key_start_re.match(stripped)
    if km:
        # new key encountered -> flush previous
        if buffer_key:
            flush(buffer_key, buffer_parts)
        buffer_key = km.group(1)
        buffer_parts = [km.group(2)]
    else:
        # continuation line (multi-line string) belongs to current buffer_key
        if buffer_key:
            buffer_parts.append(stripped)

# flush last
if buffer_key:
    flush(buffer_key, buffer_parts)

print(f"Parsed {len(entries)} entries")

# Build section order
sections = []
for e in entries:
    if e["section"] not in sections:
        sections.append(e["section"])

with open("/home/claude/triavi_i18n/en_strings.json", "w", encoding="utf-8") as f:
    json.dump({"sections": sections, "entries": entries}, f, ensure_ascii=False, indent=2)

print("Sections:", sections)
