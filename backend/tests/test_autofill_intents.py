"""Tests for autofill_intents module."""

from types import SimpleNamespace
import pytest

from services.shared.autofill_intents import (
    ATS_PLATFORMS,
    autofill_answer_category,
    autofill_intent_key,
    autofill_intent_key_for_field,
    inverse_sponsorship_answer,
    normalize_form_label,
)


def test_normalize_form_label() -> None:
    assert normalize_form_label("  First   Name  ") == "first name"
    assert normalize_form_label("") == ""
    assert normalize_form_label(None) == ""


def test_autofill_answer_category() -> None:
    assert autofill_answer_category("Notice Period") == "notice_period"
    assert autofill_answer_category("Where are you currently based?") == "location"
    assert autofill_answer_category("What is your current salary?") == "current_salary"
    assert autofill_answer_category("Expected day rate") == "day_rate"
    assert autofill_answer_category("Do you require visa sponsorship?") == "visa_sponsorship"
    assert autofill_answer_category("Do you have full working rights?") == "work_authorization"
    assert autofill_answer_category("Random custom question about React") is None


def test_autofill_intent_key() -> None:
    assert autofill_intent_key("First name") == "identity.first_name"
    assert autofill_intent_key("Given name") == "identity.first_name"
    assert autofill_intent_key("Last name") == "identity.last_name"
    assert autofill_intent_key("Email address") == "identity.email"
    assert autofill_intent_key("Mobile number") == "identity.phone"
    assert autofill_intent_key("LinkedIn profile") == "employment.linkedin_url"
    assert autofill_intent_key("GitHub") == "employment.github_url"
    assert autofill_intent_key("Authorized to work without sponsorship") == "employment.work_authorization_without_sponsorship"


def test_autofill_intent_key_for_field_objects_and_dicts() -> None:
    # Test with SimpleNamespace
    field_obj = SimpleNamespace(label="First Name", type="text")
    assert autofill_intent_key_for_field(field_obj) == "identity.first_name"

    # Test with dict
    field_dict = {"label": "Last Name", "type": "text"}
    assert autofill_intent_key_for_field(field_dict) == "identity.last_name"

    # Test rejecting identity intents on choice fields
    field_checkbox = SimpleNamespace(label="Email", type="checkbox")
    assert autofill_intent_key_for_field(field_checkbox) is None

    # Test ATS fallback via id/name
    field_unlabeled = SimpleNamespace(label="", name="applicant_email", id="email_input", type="text")
    assert autofill_intent_key_for_field(field_unlabeled, platform="greenhouse") == "identity.email"
    assert autofill_intent_key_for_field(field_unlabeled, platform="generic") is None


def test_inverse_sponsorship_answer() -> None:
    assert inverse_sponsorship_answer("Yes") == "No"
    assert inverse_sponsorship_answer("required") == "No"
    assert inverse_sponsorship_answer("No") == "Yes"
    assert inverse_sponsorship_answer("not required") == "Yes"
    assert inverse_sponsorship_answer("unknown") is None


def test_ats_platforms_set() -> None:
    assert "greenhouse" in ATS_PLATFORMS
    assert "ashby" in ATS_PLATFORMS
    assert "workday" in ATS_PLATFORMS
    assert "indeed" in ATS_PLATFORMS
    assert "avature" in ATS_PLATFORMS
    assert "seek" not in ATS_PLATFORMS
