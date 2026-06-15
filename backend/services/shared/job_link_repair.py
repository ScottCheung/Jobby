import html
import json
import re
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from modules.linkedin.job_text_parser import normalize_work_style, parse_public_title


class JobLinkRepairError(RuntimeError):
    pass


def repair_from_link(url: str) -> dict[str, Any]:
    html_text = _fetch_html(url)
    json_ld = _extract_job_posting(html_text)

    repaired: dict[str, Any] = {"repair_source": "job_link"}
    if json_ld:
        _merge_json_ld(repaired, json_ld)

    meta_title = _extract_meta(html_text, "og:title") or _extract_title(html_text)
    title, company, location = parse_public_title(meta_title)
    repaired.setdefault("title", title)
    repaired.setdefault("company", company)
    repaired.setdefault("work_location", location)

    meta_description = _extract_meta(html_text, "description") or _extract_meta(html_text, "og:description")
    if meta_description and not repaired.get("job_description") and not is_linkedin_public_summary(meta_description):
        repaired["job_description"] = _clean_text(meta_description)

    repaired["job_id"] = repaired.get("job_id") or extract_job_id(url)
    return {key: value for key, value in repaired.items() if value not in (None, "", "Unknown")}


def extract_job_id(url: str | None) -> str | None:
    if not url:
        return None
    match = re.search(r"/jobs/view/(\d+)", url)
    return match.group(1) if match else None


def _fetch_html(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        raise JobLinkRepairError("Application link is not a valid HTTP URL")

    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urlopen(request, timeout=4) as response:
            body = response.read(650_000)
            return body.decode(response.headers.get_content_charset() or "utf-8", errors="replace")
    except HTTPError as error:
        raise JobLinkRepairError(f"Could not read job link: HTTP {error.code}") from error
    except (URLError, TimeoutError) as error:
        raise JobLinkRepairError(f"Could not read job link: {error}") from error


def _extract_job_posting(html_text: str) -> dict | None:
    for raw_script in re.findall(
        r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
        html_text,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        try:
            data = json.loads(html.unescape(raw_script).strip())
        except json.JSONDecodeError:
            continue
        posting = _find_job_posting(data)
        if posting:
            return posting
    return None


def _find_job_posting(value: Any) -> dict | None:
    if isinstance(value, dict):
        if value.get("@type") == "JobPosting":
            return value
        for child in value.values():
            found = _find_job_posting(child)
            if found:
                return found
    if isinstance(value, list):
        for child in value:
            found = _find_job_posting(child)
            if found:
                return found
    return None


def _merge_json_ld(target: dict[str, Any], posting: dict) -> None:
    target["title"] = _clean_text(posting.get("title"))
    organization = posting.get("hiringOrganization")
    if isinstance(organization, dict):
        target["company"] = _clean_text(organization.get("name"))

    target["work_location"] = _location_from_json_ld(posting.get("jobLocation"))
    target["job_description"] = _clean_html(posting.get("description"))

    workplace_type = posting.get("jobLocationType")
    if isinstance(workplace_type, str) and workplace_type.upper() == "TELECOMMUTE":
        target["work_style"] = "remote"
    elif posting.get("applicantLocationRequirements"):
        target["work_style"] = normalize_work_style(str(posting.get("employmentType") or ""))


def _location_from_json_ld(value: Any) -> str | None:
    if isinstance(value, list):
        locations = [_location_from_json_ld(item) for item in value]
        return "; ".join(location for location in locations if location) or None
    if not isinstance(value, dict):
        return None

    address = value.get("address")
    if isinstance(address, dict):
        parts = [
            address.get("addressLocality"),
            address.get("addressRegion"),
            address.get("addressCountry"),
        ]
        return ", ".join(_clean_text(part) for part in parts if _clean_text(part)) or None
    return _clean_text(value.get("name"))


def _extract_meta(html_text: str, name: str) -> str | None:
    pattern = (
        rf"<meta[^>]+(?:property|name)=[\"']{re.escape(name)}[\"'][^>]+content=[\"'](?P<content>.*?)[\"'][^>]*>"
        rf"|<meta[^>]+content=[\"'](?P<content_alt>.*?)[\"'][^>]+(?:property|name)=[\"']{re.escape(name)}[\"'][^>]*>"
    )
    match = re.search(pattern, html_text, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return None
    return _clean_text(match.group("content") or match.group("content_alt"))


def _extract_title(html_text: str) -> str | None:
    match = re.search(r"<title[^>]*>(.*?)</title>", html_text, flags=re.IGNORECASE | re.DOTALL)
    return _clean_text(match.group(1)) if match else None


def _clean_html(value: Any) -> str | None:
    if not value:
        return None
    text = re.sub(r"<br\s*/?>", "\n", str(value), flags=re.IGNORECASE)
    text = re.sub(r"</p\s*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    return _clean_text(text)


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = html.unescape(str(value))
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def is_linkedin_public_summary(value: str | None) -> bool:
    text = str(value or "")
    return "See this and similar jobs on LinkedIn" in text or "…See this" in text
