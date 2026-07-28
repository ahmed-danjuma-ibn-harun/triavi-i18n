# Language catalog for the Triavi translation annotation tool.
# Each entry: (ISO-ish code, English name, native/local name, region group)

LANGUAGES = [
    # ── Nigerian & West African languages (priority group) ──
    ("yo", "Yoruba", "Yorùbá", "Nigeria"),
    ("ig", "Igbo", "Igbo", "Nigeria"),
    ("ha", "Hausa", "Hausa", "Nigeria"),
    ("pcm", "Nigerian Pidgin", "Naija", "Nigeria"),
    ("ff", "Fulfulde (Fulani)", "Fulfulde", "Nigeria"),
    ("kr", "Kanuri", "Kanuri", "Nigeria"),
    ("tiv", "Tiv", "Tiv", "Nigeria"),
    ("efi", "Efik", "Efik", "Nigeria"),
    ("ibb", "Ibibio", "Ibibio", "Nigeria"),
    ("bin", "Edo (Bini)", "Ẹ̀dó", "Nigeria"),
    ("ijc", "Ijaw (Izon)", "Izọn", "Nigeria"),
    ("urh", "Urhobo", "Urhobo", "Nigeria"),
    ("idu", "Idoma", "Idoma", "Nigeria"),
    ("igl", "Igala", "Igala", "Nigeria"),
    ("nup", "Nupe", "Nupe", "Nigeria"),
    ("igb", "Ebira", "Ebira", "Nigeria"),
    ("iso", "Isoko", "Isoko", "Nigeria"),

    # ── Other African languages ──
    ("sw", "Swahili", "Kiswahili", "Africa"),
    ("am", "Amharic", "አማርኛ", "Africa"),
    ("zu", "Zulu", "isiZulu", "Africa"),
    ("xh", "Xhosa", "isiXhosa", "Africa"),
    ("af", "Afrikaans", "Afrikaans", "Africa"),
    ("so", "Somali", "Soomaali", "Africa"),
    ("st", "Sesotho", "Sesotho", "Africa"),
    ("sn", "Shona", "chiShona", "Africa"),
    ("rw", "Kinyarwanda", "Ikinyarwanda", "Africa"),
    ("wo", "Wolof", "Wolof", "Africa"),
    ("ln", "Lingala", "Lingála", "Africa"),
    ("mg", "Malagasy", "Malagasy", "Africa"),

    # ── European languages ──
    ("es", "Spanish", "Español", "Europe/Americas"),
    ("fr", "French", "Français", "Europe/Africa"),
    ("pt", "Portuguese", "Português", "Europe/Americas"),
    ("de", "German", "Deutsch", "Europe"),
    ("it", "Italian", "Italiano", "Europe"),
    ("nl", "Dutch", "Nederlands", "Europe"),
    ("ru", "Russian", "Русский", "Europe/Asia"),
    ("pl", "Polish", "Polski", "Europe"),
    ("uk", "Ukrainian", "Українська", "Europe"),
    ("ro", "Romanian", "Română", "Europe"),
    ("el", "Greek", "Ελληνικά", "Europe"),
    ("sv", "Swedish", "Svenska", "Europe"),
    ("no", "Norwegian", "Norsk", "Europe"),
    ("da", "Danish", "Dansk", "Europe"),
    ("fi", "Finnish", "Suomi", "Europe"),
    ("cs", "Czech", "Čeština", "Europe"),
    ("sk", "Slovak", "Slovenčina", "Europe"),
    ("hu", "Hungarian", "Magyar", "Europe"),
    ("bg", "Bulgarian", "Български", "Europe"),
    ("sr", "Serbian", "Српски", "Europe"),
    ("hr", "Croatian", "Hrvatski", "Europe"),
    ("sl", "Slovenian", "Slovenščina", "Europe"),
    ("lt", "Lithuanian", "Lietuvių", "Europe"),
    ("lv", "Latvian", "Latviešu", "Europe"),
    ("et", "Estonian", "Eesti", "Europe"),
    ("is", "Icelandic", "Íslenska", "Europe"),
    ("ga", "Irish", "Gaeilge", "Europe"),
    ("cy", "Welsh", "Cymraeg", "Europe"),
    ("ca", "Catalan", "Català", "Europe"),
    ("eu", "Basque", "Euskara", "Europe"),
    ("sq", "Albanian", "Shqip", "Europe"),
    ("tr", "Turkish", "Türkçe", "Europe/Asia"),
    ("ka", "Georgian", "ქართული", "Europe/Asia"),
    ("hy", "Armenian", "Հայերեն", "Europe/Asia"),

    # ── Middle Eastern languages ──
    ("ar", "Arabic", "العربية", "Middle East/Africa"),
    ("he", "Hebrew", "עברית", "Middle East"),
    ("fa", "Persian (Farsi)", "فارسی", "Middle East"),
    ("ur", "Urdu", "اردو", "South Asia/Middle East"),

    # ── South & Southeast Asian languages ──
    ("hi", "Hindi", "हिन्दी", "South Asia"),
    ("bn", "Bengali", "বাংলা", "South Asia"),
    ("pa", "Punjabi", "ਪੰਜਾਬੀ", "South Asia"),
    ("ta", "Tamil", "தமிழ்", "South Asia"),
    ("te", "Telugu", "తెలుగు", "South Asia"),
    ("mr", "Marathi", "मराठी", "South Asia"),
    ("gu", "Gujarati", "ગુજરાતી", "South Asia"),
    ("kn", "Kannada", "ಕನ್ನಡ", "South Asia"),
    ("ml", "Malayalam", "മലയാളം", "South Asia"),
    ("ne", "Nepali", "नेपाली", "South Asia"),
    ("si", "Sinhala", "සිංහල", "South Asia"),
    ("th", "Thai", "ไทย", "Southeast Asia"),
    ("vi", "Vietnamese", "Tiếng Việt", "Southeast Asia"),
    ("id", "Indonesian", "Bahasa Indonesia", "Southeast Asia"),
    ("ms", "Malay", "Bahasa Melayu", "Southeast Asia"),
    ("tl", "Filipino (Tagalog)", "Filipino", "Southeast Asia"),
    ("km", "Khmer", "ខ្មែរ", "Southeast Asia"),
    ("lo", "Lao", "ລາວ", "Southeast Asia"),
    ("my", "Burmese", "မြန်မာ", "Southeast Asia"),
    ("mn", "Mongolian", "Монгол", "East Asia"),
    ("kk", "Kazakh", "Қазақ", "Central Asia"),
    ("uz", "Uzbek", "Oʻzbek", "Central Asia"),
    ("az", "Azerbaijani", "Azərbaycan", "Central Asia"),

    # ── East Asian languages ──
    ("zh-Hans", "Chinese (Simplified)", "简体中文", "East Asia"),
    ("zh-Hant", "Chinese (Traditional)", "繁體中文", "East Asia"),
    ("ja", "Japanese", "日本語", "East Asia"),
    ("ko", "Korean", "한국어", "East Asia"),
]

REGION_ORDER = [
    "Nigeria",
    "Africa",
    "Europe/Africa",
    "Europe/Americas",
    "Europe",
    "Europe/Asia",
    "Middle East/Africa",
    "Middle East",
    "South Asia/Middle East",
    "South Asia",
    "Southeast Asia",
    "Central Asia",
    "East Asia",
]

def language_options():
    """Returns list of dicts sorted by region priority, then name."""
    order = {r: i for i, r in enumerate(REGION_ORDER)}
    return sorted(
        [{"code": c, "name": n, "native": nv, "region": r} for c, n, nv, r in LANGUAGES],
        key=lambda x: (order.get(x["region"], 99), x["name"]),
    )

def label_for(lang):
    if lang["native"] and lang["native"] != lang["name"]:
        return f'{lang["name"]} ({lang["native"]}) — {lang["region"]}'
    return f'{lang["name"]} — {lang["region"]}'
