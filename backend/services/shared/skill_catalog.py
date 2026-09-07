"""Skill catalog loader and JD skill extractor.

Loads industry skill catalogs (synced from browser-extension/src/content/skills/industries/)
and provides fast extraction of known skills from job description text.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

_CATALOG_DIR = Path(__file__).parent / "skill_catalogs"

_WORD_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9+#.-]{1,}")


def _load_catalogs() -> tuple[dict[str, str], dict[str, list[tuple[str, re.Pattern[str]]]]]:
    """Load single terms and multi-word patterns indexed by their first token.

    single_word_map: lowercased term -> canonical label
    multi_word_index: first token -> (label, compiled_regex) entries
    """
    single: dict[str, str] = {}
    multi: dict[str, list[tuple[str, re.Pattern[str]]]] = {}
    seen_labels: set[str] = set()

    for json_file in sorted(_CATALOG_DIR.glob("*.json")):
        with open(json_file, encoding="utf-8") as f:
            entries = json.load(f)
        for entry in entries:
            label: str = entry["label"]
            label_key = label.strip().lower()
            if label_key in seen_labels:
                continue
            seen_labels.add(label_key)

            all_terms = [label] + entry.get("terms", [])
            for term in all_terms:
                term = term.strip()
                if not term:
                    continue
                key = term.lower()
                if " " in key or "\t" in key:
                    # Multi-word term: compile regex pattern with word boundaries
                    escaped = re.escape(key).replace(r"\ ", r"\s+")
                    pattern = re.compile(
                        rf"(?:^|[^a-zA-Z0-9])({escaped})(?=$|[^a-zA-Z0-9])",
                        re.IGNORECASE,
                    )
                    first_word = _WORD_RE.search(key)
                    if first_word:
                        multi.setdefault(first_word.group().rstrip('.'), []).append((label, pattern))
                else:
                    if key not in single:
                        single[key] = label

    return single, multi


_SINGLE_WORD_MAP, _MULTI_WORD_INDEX = _load_catalogs()


def extract_jd_skills(text: str) -> list[str]:
    """Extract known skill labels from job description text.

    Returns canonical labels sorted by first appearance position in the text.
    Handles both single-word terms (via set lookup) and multi-word terms (via regex).
    """
    if not text or not text.strip():
        return []

    found: dict[str, int] = {}  # label -> first position
    text_lower = text.lower()

    # Single-word matching via tokenization + set lookup
    tokens = set()
    for match in _WORD_RE.finditer(text_lower):
        token = match.group().rstrip('.')
        tokens.add(token)
        label = _SINGLE_WORD_MAP.get(token)
        if label and label not in found:
            found[label] = match.start()

    # Multi-word matching via pre-compiled regex
    for token in sorted(tokens):
        for label, pattern in _MULTI_WORD_INDEX.get(token, ()):
            m = pattern.search(text)
            if m and (label not in found or m.start() < found[label]):
                found[label] = m.start()

    return [label for label, _ in sorted(found.items(), key=lambda x: x[1])]
