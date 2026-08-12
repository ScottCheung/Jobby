from types import SimpleNamespace

from services.api.main import (
    _autofill_answer_category,
    _autofill_intent_key,
    _canonical_autofill_intent_key,
    _compatible_form_field_types,
    _coerce_form_value,
    _is_phone_country_field,
    _is_single_consent_checkbox,
    _phone_country_code,
    _phone_country_value,
)


def test_form_autofill_classifies_location_salary_and_office_questions() -> None:
    assert _autofill_answer_category("Where are you currently based?") == "location"
    assert _autofill_answer_category("Are you able to work at the Perth office twice per week?") == "office_attendance"
    assert _autofill_answer_category("What is your desired annual base salary?") == "salary"
    assert _autofill_answer_category("What is your current annual salary?") == "current_salary"
    assert _autofill_answer_category("Date Available") == "date_available"


def test_form_autofill_leaves_unrelated_questions_uncategorized() -> None:
    assert _autofill_answer_category("Describe your experience with React") is None


def test_form_autofill_reuses_answers_between_compatible_controls() -> None:
    assert _compatible_form_field_types("radio", "select")
    assert _compatible_form_field_types("number", "text")
    assert not _compatible_form_field_types("checkbox", "radio")


def test_identity_intents_are_canonical_across_form_wording() -> None:
    assert _autofill_intent_key("Title") == "identity.title"
    assert _autofill_intent_key("Salutation") == "identity.title"
    assert _autofill_intent_key("Job title") is None
    assert _autofill_intent_key("First name") == "identity.first_name"
    assert _autofill_intent_key("Given name") == "identity.first_name"
    assert _autofill_intent_key("Preferred name") == "identity.preferred_name"
    assert _autofill_intent_key("Pronouns") == "identity.pronouns"
    assert _autofill_intent_key("Last name") == "identity.last_name"
    assert _autofill_intent_key("What is your desired annual base salary?") == "compensation.desired_base_salary"


def test_title_value_is_coerced_to_the_page_option_value() -> None:
    field = SimpleNamespace(
        type="select",
        options=[
            {"label": " ", "value": ""},
            {"label": "Mr", "value": "Mr"},
            {"label": "Dr", "value": "Dr"},
        ],
    )
    assert _coerce_form_value("Mr", field) == ("Mr", None)
    assert _coerce_form_value("mr.", field) == ("Mr", None)
    value, reason = _coerce_form_value("Professor", field)
    assert value is None
    assert reason == "Value is not one of the available options."


def test_legacy_title_memory_keys_are_canonicalized() -> None:
    assert _canonical_autofill_intent_key("title") == "identity.title"
    assert _canonical_autofill_intent_key("learned.title") == "identity.title"
    assert _canonical_autofill_intent_key("employment.office_attendance") == "employment.office_attendance"


def test_application_intents_cover_work_rights_and_experience_variants() -> None:
    assert _autofill_intent_key("What is your citizenship?") == "employment.citizenship"
    assert _autofill_intent_key("What is your current visa status?") == "employment.visa_status"
    assert _autofill_intent_key("Do you have a valid working visa for Australia?") == "employment.visa_status"
    assert _autofill_intent_key("What is your visa type?") == "employment.visa_type"
    assert _autofill_intent_key("Are you legally authorized to work in Australia?") == "employment.work_authorization"
    assert _autofill_intent_key("Will you require visa sponsorship?") == "employment.visa_sponsorship"
    assert _autofill_intent_key("How many years of professional experience do you have?") == "experience.years"
    assert _autofill_intent_key("How many years experience do you have in this space?") == "experience.years"
    assert _autofill_intent_key("Are you willing to relocate?") == "employment.relocation"
    assert _autofill_intent_key("Date Available") == "employment.date_available"


def test_greenhouse_and_rippling_phone_country_field_detection() -> None:
    assert _is_phone_country_field(SimpleNamespace(id="country", type="select"))
    assert _is_phone_country_field(SimpleNamespace(id="phone_country_code", type="select"))
    assert _is_phone_country_field(SimpleNamespace(name="country_code", type="select"))
    assert _is_phone_country_field(SimpleNamespace(label="Country Code", type="select"))
    assert _is_phone_country_field(SimpleNamespace(label="Phone country code", type="text"))
    assert not _is_phone_country_field(SimpleNamespace(id="country", type="text"))
    assert not _is_phone_country_field(SimpleNamespace(id="address_country", type="select"))


def test_phone_country_inference_prefers_explicit_prefix_and_supports_display_aliases() -> None:
    assert _phone_country_code("+61 434 344 292") == "AU"
    assert _phone_country_code("0044 20 1234 5678") == "GB"
    assert _phone_country_code("0434344292") == "AU"
    field = SimpleNamespace(type="select", id="country", options=[
        {"label": "+61", "value": "AU"},
        {"label": "+44", "value": "GB"},
    ])
    assert _phone_country_value(field, "+61 434 344 292") == "AU"

    rippling_field = SimpleNamespace(type="select", id="phone_country_code", options=[
        {"label": "Australia (+61)", "value": "+61"},
        {"label": "United States (+1)", "value": "+1"},
    ])
    assert _phone_country_value(rippling_field, "+61 400 123 456") == "+61"


def test_pronouns_option_coercion_supports_formatting_variations() -> None:
    pronouns_field = SimpleNamespace(
        type="select",
        label="Pronouns",
        options=[
            {"label": "Please select", "value": ""},
            {"label": "He / Him / His", "value": "He / Him / His"},
            {"label": "She / Her / Hers", "value": "She / Her / Hers"},
            {"label": "They / Them / Theirs", "value": "They / Them / Theirs"},
            {"label": "Prefer not to say", "value": "Prefer not to say"},
        ],
    )
    val, err = _coerce_form_value("He/Him", pronouns_field, "identity.pronouns")
    assert val == "He / Him / His"
    assert err is None

    val_she, err_she = _coerce_form_value("She/Her", pronouns_field, "identity.pronouns")
    assert val_she == "She / Her / Hers"
    assert err_she is None


def test_required_privacy_consent_checkbox_is_safe_to_accept() -> None:
    assert _is_single_consent_checkbox(SimpleNamespace(
        type="checkbox", required=True, label="I have read and agreed with our Privacy Collection Statement",
        name="privacy", id="inp-privacy",
    ))
    assert not _is_single_consent_checkbox(SimpleNamespace(
        type="checkbox", required=True, label="Would you like to receive marketing emails?",
        name="marketing", id="marketing",
    ))


def test_salary_and_day_rate_expectations_and_notice_period_units() -> None:
    assert _autofill_intent_key("Salary Expectation (AUD/year)") == "compensation.desired_base_salary"
    assert _autofill_intent_key("Day Rate Expectation (AUD/day)") == "compensation.desired_day_rate"
    
    notice_field = SimpleNamespace(
        type="select",
        label="Notice Period",
        options=[
            {"label": "Select", "value": ""},
            {"label": "Immediate", "value": "Immediate"},
            {"label": "1 Week", "value": "1 Week"},
            {"label": "2 Weeks", "value": "2 Weeks"},
            {"label": "1 Month", "value": "1 Month"},
        ],
    )
    val, err = _coerce_form_value("14", notice_field, "employment.notice_period")
    assert val == "2 Weeks"
    assert err is None


def test_work_rights_value_matches_the_specific_rippling_status_option() -> None:
    field = SimpleNamespace(
        type="radio",
        label="Which option best describes your Australian work rights?",
        options=[
            {"label": "Australian/New Zealand citizen", "value": "Australian/New Zealand citizen"},
            {"label": "Permanent Resident", "value": "Permanent Resident"},
            {"label": "Valid visa holder", "value": "Valid visa holder"},
            {"label": "Requires sponsorship", "value": "Requires sponsorship"},
        ],
    )
    assert _coerce_form_value("Australian citizen", field, "employment.work_authorization") == (
        "Australian/New Zealand citizen",
        None,
    )


def test_rippling_custom_questions_matching() -> None:
    assert _autofill_intent_key("Do you have unrestricted work rights within Australia?") == "employment.work_authorization"
    assert _autofill_intent_key("Which option best describes your Australian work rights?") == "employment.work_authorization"
    assert _autofill_intent_key("What is your current notice period or availability?") == "employment.notice_period"
    assert _autofill_intent_key("What are your salary expectations for this role?") == "compensation.desired_base_salary"

