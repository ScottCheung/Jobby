from __future__ import annotations

import os
import sys

WORKER_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "worker"))
if WORKER_ROOT not in sys.path:
    sys.path.insert(0, WORKER_ROOT)

from seekBot.services.seek_flow import build_seek_search_url, extract_seek_job_id, parse_seek_card


def test_seek_search_url_encodes_location_and_page() -> None:
    url = build_seek_search_url("Python Engineer", "Brisbane", page=2)

    assert "keywords=Python+Engineer" in url
    assert "where=Brisbane" in url
    assert "page=2" in url


def test_seek_job_id_and_card_parser_use_playwright_locators() -> None:
    class Node:
        def __init__(self, text: str = "", href: str = "") -> None:
            self._text = text
            self._href = href

        @property
        def first(self):
            return self

        def count(self):
            return 1 if self._text or self._href else 0

        def is_visible(self):
            return True

        def inner_text(self):
            return self._text

        def get_attribute(self, name):
            return self._href if name == "href" else None

    class Card:
        def locator(self, selector):
            if "jobTitle" in selector:
                return Node("Backend Engineer", "https://www.seek.com.au/job/123456789")
            if "jobCompany" in selector:
                return Node("Example Co")
            if "jobLocation" in selector:
                return Node("Brisbane")
            return Node()

    assert extract_seek_job_id("https://www.seek.com.au/job/123456789") == "123456789"
    assert parse_seek_card(Card()) == {
        "platform": "seek",
        "job_id": "123456789",
        "external_id": "123456789",
        "title": "Backend Engineer",
        "company": "Example Co",
        "work_location": "Brisbane",
        "job_link": "https://www.seek.com.au/job/123456789",
    }
