from __future__ import annotations

import os
import sys

WORKER_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "worker"))
if WORKER_ROOT not in sys.path:
    sys.path.insert(0, WORKER_ROOT)

from linkedinBot.services.linkedin_playwright_flow import (
    LINKEDIN_CARD_SELECTOR,
    _clean_linkedin_job_description,
    _easy_apply_root,
    _wait_for_browser_confirmation,
    _configure_page_timeouts,
    _continue_easy_apply_interstitial,
    _goto_with_page_recovery,
    _open_easy_apply,
    _run_single_job,
    _select_option_answer,
    _select_linkedin_page,
    build_linkedin_filter_plan,
    build_linkedin_search_url,
    current_linkedin_job_candidate,
    extract_linkedin_job_id,
    parse_linkedin_card,
    run_linkedin_playwright,
    verify_linkedin_search_filters,
)
from shared_services.persistence.api_client import BotApiError


def test_page_timeout_configuration_sets_finite_action_and_navigation_limits(monkeypatch) -> None:
    values = {
        "browser_action_timeout_seconds": 8,
        "browser_navigation_timeout_seconds": 25,
    }

    class Page:
        def __init__(self) -> None:
            self.action_timeout = None
            self.navigation_timeout = None

        def set_default_timeout(self, value):
            self.action_timeout = value

        def set_default_navigation_timeout(self, value):
            self.navigation_timeout = value

    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.get_runtime_value",
        lambda key, default=None: values.get(key, default),
    )
    page = Page()

    _configure_page_timeouts(page)

    assert page.action_timeout == 8000
    assert page.navigation_timeout == 25000


def test_linkedin_description_removes_surrounding_page_chrome() -> None:
    description = _clean_linkedin_job_description(
        "Company heading About the job Build React and TypeScript applications with a product team. "
        "Use Next.js, REST APIs, PostgreSQL, automated tests, and GitHub Actions in production. "
        "Set alert for similar jobs Put your best foot forward with your application"
    )

    assert description.startswith("Build React and TypeScript")
    assert "Set alert" not in description


def test_linkedin_top_card_and_footer_are_not_treated_as_a_job_description() -> None:
    description = _clean_linkedin_job_description(
        "Example Co Senior Full-Stack Engineer APAC Remote Contract Apply Save "
        "Hiring? Post a job About Accessibility Talent Solutions Community Guidelines "
        "LinkedIn Corporation © 2026"
    )

    assert description == ""


def test_select_option_uses_real_value_when_linkedin_label_contains_whitespace() -> None:
    class Option:
        def __init__(self, label, value) -> None:
            self.label = label
            self.value = value

        def inner_text(self):
            return self.label

        def get_attribute(self, name):
            return self.value if name == "value" else None

    class Options:
        values = [Option(" Select an option ", ""), Option("  Yes\n", "yes-value")]

        def count(self):
            return len(self.values)

        def nth(self, index):
            return self.values[index]

    class Field:
        def __init__(self) -> None:
            self.selected = None

        def locator(self, selector):
            assert selector == "option"
            return Options()

        def select_option(self, **choice):
            self.selected = choice

    field = Field()

    assert _select_option_answer(field, "Yes") == "Yes"
    assert field.selected == {"value": "yes-value"}


def test_easy_apply_root_never_falls_back_to_the_whole_page() -> None:
    class MissingLocator:
        @property
        def last(self):
            return self

        def count(self):
            return 0

        def is_visible(self):
            return False

    class Page:
        def locator(self, _selector):
            return MissingLocator()

    assert _easy_apply_root(Page()) is None


def test_easy_apply_interstitial_clicks_continue_applying_only(monkeypatch) -> None:
    clicked = []

    class Locator:
        def __init__(self, name):
            self.name = name

        @property
        def last(self):
            return self

        def count(self):
            return 1

        def is_visible(self):
            return True

        def locator(self, selector):
            assert "Continue applying" in selector
            assert "Review job post" not in selector
            return Locator("continue")

        def click(self, **_kwargs):
            clicked.append(self.name)

        def wait_for(self, **kwargs):
            assert kwargs == {"state": "hidden", "timeout": 5000}

    class Page:
        def locator(self, selector):
            assert selector == "[data-testid='dialog-content']"
            return Locator("prompt")

        def wait_for_timeout(self, _milliseconds):
            return None

    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.bot_status",
        lambda *_args, **_kwargs: None,
    )

    assert _continue_easy_apply_interstitial(Page()) is True
    assert clicked == ["continue"]


def test_linked_easy_apply_entry_navigates_to_its_real_flow_url() -> None:
    class Trigger:
        @property
        def first(self):
            return self

        def evaluate(self, _script):
            return "a"

        def get_attribute(self, name):
            assert name == "href"
            return "/jobs/view/123/?openSDUIApplyFlow=true"

        def click(self, **_kwargs):
            raise AssertionError("link-based Easy Apply must navigate via href")

    class Page:
        def __init__(self) -> None:
            self.navigations = []

        def locator(self, _selector):
            return Trigger()

        def goto(self, url, **kwargs):
            self.navigations.append((url, kwargs))

        def wait_for_timeout(self, _milliseconds):
            return None

    page = Page()

    _open_easy_apply(page)

    assert page.navigations == [
        (
            "https://www.linkedin.com/jobs/view/123/?openSDUIApplyFlow=true",
            {"wait_until": "domcontentloaded"},
        )
    ]


def test_single_job_api_failure_is_isolated_to_that_job(monkeypatch) -> None:
    class Page:
        def goto(self, *_args, **_kwargs):
            return None

        def wait_for_timeout(self, _milliseconds):
            return None

    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.api_client.create_application_plan",
        lambda _payload: (_ for _ in ()).throw(BotApiError("API timed out")),
    )

    result = _run_single_job(
        Page(),
        {
            "external_id": "123",
            "title": "Backend Engineer",
            "company": "Example Co",
            "job_link": "https://www.linkedin.com/jobs/view/123/",
        },
    )

    assert result == "failed"


def test_dry_run_stops_after_apply_decision_without_opening_form(monkeypatch) -> None:
    class Page:
        url = "https://www.linkedin.com/jobs/view/123/"

        def wait_for_timeout(self, _milliseconds):
            return None

    actions = []
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._text_from_page",
        lambda *_args, **_kwargs: "A sufficiently detailed backend engineering job description.",
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._is_easy_apply",
        lambda _page: True,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._install_linkedin_status_overlay",
        lambda _page: None,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._update_linkedin_status",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.get_runtime_value",
        lambda key, default=None: "dry_run" if key == "execution_mode" else default,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.api_client.create_application_plan",
        lambda _payload: {
            "application_id": "plan-1",
            "plan": {
                "decision": {
                    "action": "apply",
                    "explanation": "Candidate meets the threshold.",
                    "reason_codes": ["master_resume_recommended"],
                    "resume_strategy": "master",
                }
            },
        },
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.api_client.apply_application_plan_action",
        lambda plan_id, action, reason=None: actions.append((plan_id, action, reason)) or {},
    )

    result = _run_single_job(
        Page(),
        {
            "external_id": "123",
            "title": "Backend Engineer",
            "company": "Example Co",
            "job_link": "https://www.linkedin.com/jobs/view/123/",
        },
        run_id="run-1",
    )

    assert result == "review"
    assert actions == []


def test_existing_submitted_plan_is_skipped_before_browser_form_actions(monkeypatch) -> None:
    class Page:
        url = "https://www.linkedin.com/jobs/view/123/"

        def wait_for_timeout(self, _milliseconds):
            return None

    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._text_from_page",
        lambda *_args, **_kwargs: "A sufficiently detailed backend engineering job description.",
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._is_easy_apply",
        lambda _page: True,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._install_linkedin_status_overlay",
        lambda _page: None,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._update_linkedin_status",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.api_client.create_application_plan",
        lambda _payload: {
            "application_id": "plan-1",
            "plan": {
                "state": "submitted",
                "decision": {
                    "action": "apply",
                    "explanation": "Original application decision.",
                },
            },
        },
    )

    result = _run_single_job(
        Page(),
        {
            "external_id": "123",
            "title": "Backend Engineer",
            "company": "Example Co",
            "job_link": "https://www.linkedin.com/jobs/view/123/",
        },
        run_id="run-1",
    )

    assert result == "skip"


def test_search_url_contains_keyword_location_and_easy_apply_filter() -> None:
    url = build_linkedin_search_url("Python Engineer", "Brisbane", easy_apply=True)

    assert "keywords=Python+Engineer" in url
    assert "location=Brisbane" in url
    assert "f_AL=true" in url


def test_search_url_maps_and_verifies_supported_profile_filters() -> None:
    filters = {
        "sort_by": "Most recent",
        "date_posted": "Past week",
        "experience_level": ["Entry level", "Mid-Senior level"],
        "job_type": ["Full-time", "Contract"],
        "on_site": ["Remote", "Hybrid"],
        "salary": "$100,000+",
        "under_10_applicants": True,
        "in_your_network": True,
    }

    plan = build_linkedin_filter_plan(filters, easy_apply=True)
    url = build_linkedin_search_url("Backend Engineer", "Brisbane", filters=filters, easy_apply=True)

    assert plan["params"] == {
        "sortBy": "DD",
        "f_TPR": "r604800",
        "f_E": "2,4",
        "f_JT": "F,C",
        "f_WT": "2,3",
        "f_SB2": "4",
        "f_AL": "true",
        "f_EA": "true",
        "f_JIYN": "true",
    }
    assert plan["unsupported"] == []
    assert verify_linkedin_search_filters(url, plan["params"])["ok"] is True


def test_named_linkedin_facets_are_reported_instead_of_silently_ignored() -> None:
    plan = build_linkedin_filter_plan({"companies": ["Example Co"], "industry": ["Software"]})

    assert plan["unsupported"] == ["companies", "industry"]


def test_extract_linkedin_job_id_supports_job_url_shapes() -> None:
    assert extract_linkedin_job_id("https://www.linkedin.com/jobs/view/123456789/") == "123456789"
    assert extract_linkedin_job_id("/jobs/view/987654321/?trk=feed") == "987654321"


def test_open_linkedin_job_is_normalized_as_a_single_candidate() -> None:
    class Node:
        def __init__(self, text: str = "") -> None:
            self.text = text

        @property
        def first(self):
            return self

        def count(self):
            return 1 if self.text else 0

        def is_visible(self):
            return bool(self.text)

        def inner_text(self):
            return self.text

    class Page:
        url = "https://www.linkedin.com/jobs/search/?currentJobId=123456789"

        def locator(self, selector):
            if "job-title" in selector:
                return Node("Backend Engineer")
            if "company-name" in selector:
                return Node("Example Co")
            if "primary-description" in selector:
                return Node("Brisbane, Queensland")
            return Node()

    assert current_linkedin_job_candidate(Page()) == {
        "external_id": "123456789",
        "title": "Backend Engineer",
        "company": "Example Co",
        "work_location": "Brisbane, Queensland",
        "job_link": "https://www.linkedin.com/jobs/view/123456789/",
    }


def test_closed_linkedin_tab_is_not_selected() -> None:
    class Page:
        def __init__(self, url: str, closed: bool) -> None:
            self.url = url
            self.closed = closed

        def is_closed(self):
            return self.closed

    closed_job = Page("https://www.linkedin.com/jobs/view/123456789/", True)
    live_feed = Page("https://www.linkedin.com/feed/", False)
    context = type("Context", (), {"pages": [closed_job, live_feed]})()

    assert _select_linkedin_page(context) is live_feed


def test_closed_page_is_replaced_before_search_navigation() -> None:
    class ClosedPage:
        url = "https://www.linkedin.com/feed/"

        def is_closed(self):
            return True

    class LivePage:
        url = "about:blank"

        def __init__(self) -> None:
            self.navigations = []

        def is_closed(self):
            return False

        def goto(self, url, **_kwargs):
            self.navigations.append(url)

    live_page = LivePage()

    class Context:
        pages = [ClosedPage()]

        def new_page(self):
            return live_page

    result = _goto_with_page_recovery(
        Context(),
        Context.pages[0],
        "https://www.linkedin.com/jobs/search/?keywords=Backend+Engineer",
    )

    assert result is live_page
    assert live_page.navigations == ["https://www.linkedin.com/jobs/search/?keywords=Backend+Engineer"]


def test_linkedin_run_skips_ineligible_candidate_then_locks_one_job_without_switching_terms(monkeypatch) -> None:
    class Page:
        # A previous run may leave the managed browser on a job detail page.
        # Normal automation must still rebuild and verify the configured search.
        url = "https://www.linkedin.com/jobs/view/999999999/"

        def __init__(self) -> None:
            self.navigations = []

        def goto(self, url, **_kwargs):
            self.navigations.append(url)
            self.url = url

    class Cards:
        def count(self):
            return 3

        def nth(self, index):
            return index

    class Session:
        def __init__(self) -> None:
            self.page = Page()

        def start(self):
            return type("Context", (), {"pages": [self.page]})()

        def close(self):
            return None

    session = Session()
    processed = []

    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.PlaywrightBrowserSession",
        lambda: session,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.apply_api_worker_config",
        lambda runtime: runtime.update(
            {"search_terms": ["React Developer", "Python Developer"], "switch_number": 30}
        ),
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._configure_page_timeouts",
        lambda _page: None,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._install_linkedin_status_overlay",
        lambda _page: None,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._update_linkedin_status",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._wait_for_linkedin_login",
        lambda _page: True,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.QuestionCache",
        lambda _platform: object(),
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._wait_for_linkedin_cards",
        lambda _page: Cards(),
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.parse_linkedin_card",
        lambda card: {
            "external_id": "123456789" if card < 2 else "123456790",
            "title": "React Developer" if card < 2 else "Senior React Developer",
            "company": "Example Co",
            "work_location": "Brisbane",
            "job_link": (
                "https://www.linkedin.com/jobs/view/123456789/"
                if card < 2
                else "https://www.linkedin.com/jobs/view/123456790/"
            ),
        },
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._run_single_job",
        lambda _page, candidate, question_cache=None, run_id="": (
            processed.append(candidate) or ("skip" if len(processed) == 1 else "review")
        ),
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.update_bot_stats",
        lambda **_kwargs: None,
    )

    run_linkedin_playwright()

    assert [candidate["title"] for candidate in processed] == [
        "React Developer",
        "Senior React Developer",
    ]
    assert len(session.page.navigations) == 1
    assert "keywords=React+Developer" in session.page.navigations[0]


def test_linkedin_run_paginates_with_one_locked_term_and_deduplicates_across_pages(monkeypatch) -> None:
    class Page:
        url = "https://www.linkedin.com/feed/"

        def __init__(self) -> None:
            self.navigations = []
            self.page_number = 0

        def goto(self, url, **_kwargs):
            self.navigations.append(url)
            self.url = url
            self.page_number = 1 if "start=25" in url else 0

    class Cards:
        def __init__(self, page):
            self.page = page

        def count(self):
            # A short DOM list does not mean LinkedIn has no next result page.
            return 14

        def nth(self, index):
            return self.page.page_number, index

    class Session:
        def __init__(self) -> None:
            self.page = Page()

        def start(self):
            return type("Context", (), {"pages": [self.page]})()

        def close(self):
            return None

    session = Session()
    processed = []
    events = []

    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.PlaywrightBrowserSession",
        lambda: session,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.apply_api_worker_config",
        lambda runtime: runtime.update(
            {
                "search_terms": ["React Developer", "Python Developer"],
                "switch_number": 4,
                "sort_by": "Most recent",
            }
        ),
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._configure_page_timeouts",
        lambda _page: None,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._install_linkedin_status_overlay",
        lambda _page: None,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._update_linkedin_status",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._wait_for_linkedin_login",
        lambda _page: True,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.QuestionCache",
        lambda _platform: object(),
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._wait_for_linkedin_cards",
        lambda page: Cards(page),
    )

    def parse_card(card):
        page_number, index = card
        if page_number == 0:
            external_id = "job-1" if index % 2 == 0 else "job-2"
        else:
            external_id = ("job-2", "job-3", "job-4")[index % 3]
        return {
            "external_id": external_id,
            "title": f"React Developer {external_id}",
            "company": "Example Co",
            "work_location": "Brisbane",
            "job_link": f"https://www.linkedin.com/jobs/view/{external_id}/",
        }

    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.parse_linkedin_card",
        parse_card,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._run_single_job",
        lambda _page, candidate, question_cache=None, run_id="": processed.append(candidate) or "skip",
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.update_bot_stats",
        lambda **_kwargs: None,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._run_event",
        lambda _run_id, event, **data: events.append((event, data)),
    )

    run_linkedin_playwright()

    assert [candidate["external_id"] for candidate in processed] == [
        "job-1",
        "job-2",
        "job-3",
        "job-4",
    ]
    assert len(session.page.navigations) == 2
    assert "keywords=React+Developer" in session.page.navigations[0]
    assert "keywords=React+Developer" in session.page.navigations[1]
    assert "start=25" in session.page.navigations[1]
    assert all("Python+Developer" not in url for url in session.page.navigations)
    search_plan = next(data for event, data in events if event == "search_plan")
    assert "sort_by=Most recent" in search_plan["message"]
    assert "no job filters configured" in search_plan["message"]


def test_linkedin_run_stops_and_reports_exact_filter_removed_by_linkedin(monkeypatch) -> None:
    class Page:
        url = "https://www.linkedin.com/feed/"

        def goto(self, url, **_kwargs):
            # Simulate LinkedIn accepting navigation but dropping the requested sort filter.
            self.url = "https://www.linkedin.com/jobs/search/?keywords=React+Developer"

    class Session:
        def __init__(self) -> None:
            self.page = Page()
            self.closed = False

        def start(self):
            return type("Context", (), {"pages": [self.page]})()

        def close(self):
            self.closed = True

    session = Session()
    events = []
    status_updates = []

    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.PlaywrightBrowserSession",
        lambda: session,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.apply_api_worker_config",
        lambda runtime: runtime.update(
            {"search_terms": ["React Developer", "Python Developer"], "sort_by": "Most recent"}
        ),
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._configure_page_timeouts",
        lambda _page: None,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._install_linkedin_status_overlay",
        lambda _page: None,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._update_linkedin_status",
        lambda _page, message, status="running": status_updates.append((message, status)),
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._wait_for_linkedin_login",
        lambda _page: True,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.QuestionCache",
        lambda _platform: object(),
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._run_event",
        lambda _run_id, event, **data: events.append((event, data)),
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.update_bot_stats",
        lambda **_kwargs: None,
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow._wait_for_linkedin_cards",
        lambda _page: (_ for _ in ()).throw(AssertionError("cards must not be scanned")),
    )

    run_linkedin_playwright()

    verification = next(data for event, data in events if event == "search_filters_verified")
    finished = next(data for event, data in events if event == "run_finished")
    assert verification["ok"] is False
    assert verification["missing"] == ["sortBy"]
    assert "missing sortBy" in verification["message"]
    assert finished["status"] == "failed"
    assert finished["result"] == "filter_verification_failed"
    assert finished["failed"] == 1
    assert "missing sortBy" in finished["message"]
    assert all("Python Developer" not in message for message, _status in status_updates)
    assert session.closed is True


def test_parse_linkedin_card_normalizes_platform_candidate() -> None:
    class Node:
        def __init__(self, text: str = "", href: str = "") -> None:
            self.text = text
            self._href = href

        def get_attribute(self, name: str):
            return self._href if name == "href" else None

    class Card:
        def locator(self, selector: str):
            if "job-card-list__title" in selector:
                return Node("Backend Engineer", "https://www.linkedin.com/jobs/view/123456789/")
            if "company-name" in selector:
                return Node("Example Co")
            if "job-card-container__metadata-item" in selector:
                return Node("Brisbane, QLD")
            return Node()

    parsed = parse_linkedin_card(Card())

    assert parsed == {
        "external_id": "123456789",
        "title": "Backend Engineer",
        "company": "Example Co",
        "work_location": "Brisbane, QLD",
        "job_link": "https://www.linkedin.com/jobs/view/123456789/",
    }


def test_parse_linkedin_card_normalizes_relative_job_link() -> None:
    class Node:
        def __init__(self, text: str = "", href: str = "") -> None:
            self.text = text
            self._href = href

        def get_attribute(self, name: str):
            return self._href if name == "href" else None

    class Card:
        def locator(self, selector: str):
            if "job-card-list__title" in selector:
                return Node(
                    "Frontend Engineer",
                    "/jobs/view/4447776749/?trackingId=example",
                )
            if "company-name" in selector:
                return Node("Example Co")
            return Node()

    parsed = parse_linkedin_card(Card())

    assert parsed is not None
    assert parsed["external_id"] == "4447776749"
    assert parsed["job_link"] == (
        "https://www.linkedin.com/jobs/view/4447776749/?trackingId=example"
    )


def test_parse_linkedin_card_supports_current_data_job_id_markup() -> None:
    assert "[data-job-id]" in LINKEDIN_CARD_SELECTOR

    class Node:
        def __init__(self, text: str = "") -> None:
            self.text = text

        def inner_text(self):
            return self.text

        def get_attribute(self, name: str):
            return None

    class Card:
        def get_attribute(self, name: str):
            if name == "data-job-id":
                return "99887766"
            return None

        def locator(self, selector: str):
            if selector == "h3":
                return Node("Senior Platform Engineer")
            if selector == ".artdeco-entity-lockup__subtitle":
                return Node("Example Labs")
            if selector == ".artdeco-entity-lockup__caption":
                return Node("Melbourne, VIC")
            return Node()

    assert parse_linkedin_card(Card()) == {
        "external_id": "99887766",
        "title": "Senior Platform Engineer",
        "company": "Example Labs",
        "work_location": "Melbourne, VIC",
        "job_link": "https://www.linkedin.com/jobs/view/99887766/",
    }


def test_browser_confirmation_promotes_api_plan_before_submission(monkeypatch) -> None:
    class Page:
        calls = 0

        def evaluate(self, script):
            self.calls += 1
            return None if self.calls == 1 else True

    actions = []
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.get_runtime_value",
        lambda key, default=None: "browser"
        if key == "review_channel"
        else (0.1 if key == "review_timeout_seconds" else default),
    )
    monkeypatch.setattr(
        "linkedinBot.services.linkedin_playwright_flow.api_client.apply_application_plan_action",
        lambda plan_id, action, reason=None: actions.append((plan_id, action, reason)) or {},
    )

    assert _wait_for_browser_confirmation("plan-1", Page(), "Backend Engineer") is True
    assert actions == [("plan-1", "confirm_submit", None)]
