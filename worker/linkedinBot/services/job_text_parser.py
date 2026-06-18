import re


def first_non_empty_line(value: str | None) -> str:
    lines = [line.strip() for line in str(value or "").splitlines() if line.strip()]
    return lines[0] if lines else "Unknown"


def normalize_work_style(value: str | None) -> str | None:
    text = str(value or "").strip().lower().replace(" ", "-")
    if text in {"remote", "hybrid", "on-site"}:
        return text
    if text == "onsite":
        return "on-site"
    return None


def parse_company_location(value: str | None) -> tuple[str, str, str | None]:
    text = " ".join(str(value or "").split())
    if not text:
        return "Unknown", "Unknown", None

    if " · " not in text:
        return text, "Unknown", None

    company, location = text.split(" · ", 1)
    company = company.strip() or "Unknown"
    location = location.strip()
    work_style = None

    style_match = re.search(r"\((remote|hybrid|on[-\s]?site)\)\s*$", location, flags=re.IGNORECASE)
    if style_match:
        work_style = normalize_work_style(style_match.group(1))
        location = location[:style_match.start()].strip()

    return company, location or "Unknown", work_style


def clean_linkedin_title(value: str | None) -> str | None:
    text = " ".join(str(value or "").split())
    if not text:
        return None
    text = re.sub(r"\s*\|\s*LinkedIn\s*$", "", text, flags=re.IGNORECASE).strip()
    return text or None


def parse_public_title(value: str | None) -> tuple[str | None, str | None, str | None]:
    text = clean_linkedin_title(value)
    if not text:
        return None, None, None

    hiring_match = re.match(r"^(?P<company>.+?) hiring (?P<title>.+?) in (?P<location>.+)$", text, flags=re.IGNORECASE)
    if hiring_match:
        return (
            hiring_match.group("title").strip(),
            hiring_match.group("company").strip(),
            hiring_match.group("location").strip(),
        )

    parts = [part.strip() for part in re.split(r"\s+\|\s+", text) if part.strip()]
    if len(parts) >= 2:
        return parts[0], parts[1], parts[2] if len(parts) >= 3 else None

    at_match = re.match(r"^(?P<title>.+?) at (?P<company>.+)$", text, flags=re.IGNORECASE)
    if at_match:
        return at_match.group("title").strip(), at_match.group("company").strip(), None

    return text, None, None
