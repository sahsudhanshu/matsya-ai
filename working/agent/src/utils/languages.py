"""
Language detection and validation utilities.

Uses Unicode script ranges for lightweight detection.
Supports the 10 Indian languages + Hinglish.
"""
from __future__ import annotations
import re
from typing import Dict, List, Optional, Tuple

# ── Script detection regexes ─────────────────────────────────────────────────

SCRIPT_PATTERNS: Dict[str, re.Pattern] = {
    "devanagari": re.compile(r"[\u0900-\u097F]"),
    "bengali":    re.compile(r"[\u0980-\u09FF]"),
    "gujarati":   re.compile(r"[\u0A80-\u0AFF]"),
    "gurmukhi":   re.compile(r"[\u0A00-\u0A7F]"),
    "kannada":    re.compile(r"[\u0C80-\u0CFF]"),
    "malayalam":  re.compile(r"[\u0D00-\u0D7F]"),
    "odia":       re.compile(r"[\u0B00-\u0B7F]"),
    "tamil":      re.compile(r"[\u0B80-\u0BFF]"),
    "telugu":     re.compile(r"[\u0C00-\u0C7F]"),
    "latin":      re.compile(r"[A-Za-z]"),
}

# ── Language → acceptable scripts ────────────────────────────────────────────

LANGUAGE_SCRIPTS: Dict[str, List[str]] = {
    "en": ["latin"],
    "hi": ["devanagari", "latin"],       # Hindi + Hinglish (romanised Hindi)
    "mr": ["devanagari", "latin"],       # Marathi + romanised
    "ml": ["malayalam", "latin"],
    "ta": ["tamil", "latin"],
    "te": ["telugu", "latin"],
    "kn": ["kannada", "latin"],
    "bn": ["bengali", "latin"],
    "gu": ["gujarati", "latin"],
    "or": ["odia", "latin"],
}

LANGUAGE_LABELS: Dict[str, str] = {
    "en": "English",
    "hi": "हिन्दी (Hindi)",
    "mr": "मराठी (Marathi)",
    "ml": "മലയാളം (Malayalam)",
    "ta": "தமிழ் (Tamil)",
    "te": "తెలుగు (Telugu)",
    "kn": "ಕನ್ನಡ (Kannada)",
    "bn": "বাংলা (Bengali)",
    "gu": "ગુજરાતી (Gujarati)",
    "or": "ଓଡ଼ିଆ (Odia)",
}

REJECTION_MESSAGES: Dict[str, str] = {
    "en": "I can only understand English. Please write your message in English. 🙏",
    "hi": "कृपया हिन्दी में लिखें। मैं केवल हिन्दी समझ सकता हूँ। Hinglish भी चलेगा! 🙏",
    "mr": "कृपया मराठीत लिहा. मी फक्त मराठी समजू शकतो. 🙏",
    "ml": "ദയവായി മലയാളത്തിൽ എഴുതുക. എനിക്ക് മലയാളം മാത്രമേ മനസ്സിലാകൂ. 🙏",
    "ta": "தயவுசெய்து தமிழில் எழுதுங்கள். எனக்கு தமிழ் மட்டுமே புரியும். 🙏",
    "te": "దయచేసి తెలుగులో రాయండి. నాకు తెలుగు మాత్రమే అర్థమవుతుంది. 🙏",
    "kn": "ದಯವಿಟ್ಟು ಕನ್ನಡದಲ್ಲಿ ಬರೆಯಿರಿ. ನನಗೆ ಕನ್ನಡ ಮಾತ್ರ ಅರ್ಥವಾಗುತ್ತದೆ. 🙏",
    "bn": "অনুগ্রহ করে বাংলায় লিখুন। আমি শুধু বাংলা বুঝতে পারি। 🙏",
    "gu": "કૃપા કરીને ગુજરાતીમાં લખો. હું ફક્ત ગુજરાતી સમજી શકું છું. 🙏",
    "or": "ଦୟାକରି ଓଡ଼ିଆରେ ଲେଖନ୍ତୁ। ମୁଁ କେବଳ ଓଡ଼ିଆ ବୁଝିପାରେ। 🙏",
}

# ── Strip pattern - removes digits, emojis, punctuation for meaningful char count ─

_STRIP_RE = re.compile(r"[\s\d.,!?;:'\"\--–()\[\]{}/\\@#$%^&*+=~`|<>]+")


def detect_scripts(text: str) -> Dict[str, int]:
    """Return mapping of script name → count of matching chars."""
    counts: Dict[str, int] = {}
    for script, pattern in SCRIPT_PATTERNS.items():
        matches = pattern.findall(text)
        if matches:
            counts[script] = len(matches)
    return counts


def validate_language(text: str, selected_lang: str) -> Tuple[bool, Optional[str]]:
    """
    Check whether user input is acceptable for the selected language.

    Rules:
      1. Very short input (< 3 meaningful chars) → always accept
      2. Latin-only input → always accept (English / Hinglish / transliterated)
      3. If Indic script detected, it must match the selected language
      4. Mixed Latin + matching Indic → accept (Hinglish-style)
      5. Foreign Indic script → reject with helpful message

    Returns (accepted: bool, rejection_reason: Optional[str])
    """
    # Strip noise
    stripped = _STRIP_RE.sub("", text)
    # Also strip emojis
    stripped = re.sub(
        r"[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF"
        r"\U0001F1E0-\U0001F1FF\U00002702-\U000027B0\U0001F900-\U0001F9FF"
        r"\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF\U00002600-\U000026FF]+",
        "", stripped
    )

    if len(stripped) < 3:
        return True, None

    scripts = detect_scripts(text)
    script_names = list(scripts.keys())

    if not script_names:
        return True, None

    if script_names == ["latin"]:
        return True, None

    acceptable = LANGUAGE_SCRIPTS.get(selected_lang, ["latin"])

    for script in script_names:
        if script == "latin":
            continue
        if script not in acceptable:
            label = LANGUAGE_LABELS.get(selected_lang, selected_lang)
            return False, (
                f"Detected {script} script but selected language is {label}. "
                f"Please write in {label}."
            )

    return True, None


def get_rejection_message(selected_lang: str) -> str:
    """Get user-facing rejection message in the selected language."""
    return REJECTION_MESSAGES.get(selected_lang, REJECTION_MESSAGES["en"])
