from services.api.main import _autofill_answer_category, _autofill_intent_key, _compatible_form_field_types


def test_form_autofill_classifies_location_salary_and_office_questions() -> None:
    assert _autofill_answer_category("Where are you currently based?") == "location"
    assert _autofill_answer_category("Are you able to work at the Perth office twice per week?") == "office_attendance"
    assert _autofill_answer_category("What is your desired annual base salary?") == "salary"


def test_form_autofill_leaves_unrelated_questions_uncategorized() -> None:
    assert _autofill_answer_category("Describe your experience with React") is None


def test_form_autofill_reuses_answers_between_compatible_controls() -> None:
    assert _compatible_form_field_types("radio", "select")
    assert _compatible_form_field_types("number", "text")
    assert not _compatible_form_field_types("checkbox", "radio")


def test_identity_intents_are_canonical_across_form_wording() -> None:
    assert _autofill_intent_key("First name") == "identity.first_name"
    assert _autofill_intent_key("Given name") == "identity.first_name"
    assert _autofill_intent_key("Preferred name") == "identity.preferred_name"
    assert _autofill_intent_key("Last name") == "identity.last_name"
    assert _autofill_intent_key("What is your desired annual base salary?") == "compensation.desired_base_salary"


def test_application_intents_cover_work_rights_and_experience_variants() -> None:
    assert _autofill_intent_key("Are you legally authorized to work in Australia?") == "employment.work_authorization"
    assert _autofill_intent_key("Will you require visa sponsorship?") == "employment.visa_sponsorship"
    assert _autofill_intent_key("How many years of professional experience do you have?") == "experience.years"
    assert _autofill_intent_key("Are you willing to relocate?") == "employment.relocation"
