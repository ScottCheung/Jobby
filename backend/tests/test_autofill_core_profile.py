from uuid import uuid4

from services.shared.autofill_profile import (
    default_core_value_transform,
    decrypt_profile_value,
    encrypt_profile_value,
    match_mapping_rule,
    transformed_core_value,
)
from services.shared.models import FieldMappingRule


class RuleSession:
    def __init__(self, rules: list[FieldMappingRule]) -> None:
        self.rules = rules

    def scalars(self, _query):
        return iter(self.rules)


def rule(*, user_id=None, key: str, alias: str, scene: str, features: list[str], custom: bool) -> FieldMappingRule:
    return FieldMappingRule(
        id=uuid4(),
        user_id=user_id,
        core_field_key=key,
        alias=alias,
        normalized_alias=alias.casefold(),
        scene=scene,
        semantic_features=features,
        value_transform={},
        is_user_defined=custom,
        confidence=100 if custom else 80,
        times_used=0,
    )


def test_profile_values_are_encrypted_and_round_trip() -> None:
    value = "private@example.com"
    first = encrypt_profile_value(value)
    second = encrypt_profile_value(value)
    assert first.startswith("fernet:v1:")
    assert first != value
    assert first != second
    assert decrypt_profile_value(first) == value


def test_user_rule_wins_before_a_matching_system_rule() -> None:
    user_id = uuid4()
    user_rule = rule(
        user_id=user_id,
        key="identity.legal_first_name",
        alias="legal first name",
        scene="generic",
        features=["legal", "first", "name"],
        custom=True,
    )
    system_rule = rule(
        key="identity.first_name",
        alias="legal first name",
        scene="generic",
        features=["legal", "first", "name"],
        custom=False,
    )
    match = match_mapping_rule(
        RuleSession([system_rule, user_rule]),
        user_id=user_id,
        alias="Legal first name",
        scene="generic",
        semantic_features=["legal", "first", "name"],
        field_type="text",
    )
    assert match is not None
    assert match.rule is user_rule


def test_scene_and_semantics_disambiguate_same_choice_values() -> None:
    user_id = uuid4()
    sponsorship = rule(
        user_id=user_id,
        key="employment.visa_sponsorship",
        alias="yes or no",
        scene="visa_application",
        features=["visa", "sponsorship"],
        custom=True,
    )
    relocation = rule(
        user_id=user_id,
        key="employment.relocation",
        alias="yes or no",
        scene="job_application",
        features=["relocation"],
        custom=True,
    )
    match = match_mapping_rule(
        RuleSession([relocation, sponsorship]),
        user_id=user_id,
        alias="Yes or no",
        scene="visa_application",
        semantic_features=["visa", "sponsorship"],
        field_type="radio",
    )
    assert match is not None
    assert match.rule.core_field_key == "employment.visa_sponsorship"


def test_full_name_transform_only_uses_core_values() -> None:
    full_name = rule(
        key="identity.full_name",
        alias="full name",
        scene="generic",
        features=["full", "name"],
        custom=False,
    )
    full_name.value_transform = {
        "operation": "join",
        "source_keys": ["identity.first_name", "identity.middle_name", "identity.last_name"],
        "separator": " ",
    }
    assert transformed_core_value(
        full_name,
        {"identity.first_name": "Ada", "identity.last_name": "Lovelace"},
    ) == "Ada Lovelace"


def test_legal_full_name_does_not_match_the_regular_full_name_rule() -> None:
    user_id = uuid4()
    full_name = rule(
        key="identity.full_name",
        alias="full name",
        scene="generic",
        features=["full", "name"],
        custom=False,
    )
    legal_full_name = rule(
        key="identity.legal_full_name",
        alias="legal full name",
        scene="generic",
        features=["legal", "full", "name"],
        custom=False,
    )

    match = match_mapping_rule(
        RuleSession([full_name, legal_full_name]),
        user_id=user_id,
        alias="Legal Full Name",
        scene="generic",
        semantic_features=["legal", "full", "name"],
        field_type="text",
    )

    assert match is not None
    assert match.rule is legal_full_name


def test_australian_address_aliases_match_suburb_and_postcode() -> None:
    user_id = uuid4()
    suburb_match = match_mapping_rule(
        RuleSession([]),
        user_id=user_id,
        alias="Suburb",
        scene="generic",
        semantic_features=["suburb"],
        field_type="text",
    )
    postcode_match = match_mapping_rule(
        RuleSession([]),
        user_id=user_id,
        alias="Postcode",
        scene="generic",
        semantic_features=["postcode"],
        field_type="text",
    )
    postal_code_match = match_mapping_rule(
        RuleSession([]),
        user_id=user_id,
        alias="Postal code",
        scene="generic",
        semantic_features=["postal", "code"],
        field_type="text",
    )

    assert suburb_match is not None
    assert suburb_match.rule.core_field_key == "address.suburb"
    assert postcode_match is not None
    assert postcode_match.rule.core_field_key == "address.postal_code"
    assert postal_code_match is not None
    assert postal_code_match.rule.core_field_key == "address.postal_code"


def test_state_and_date_available_aliases_match_builtin_rules() -> None:
    user_id = uuid4()
    state_match = match_mapping_rule(
        RuleSession([]), user_id=user_id, alias="State", scene="generic",
        semantic_features=["state"], field_type="select",
    )
    date_match = match_mapping_rule(
        RuleSession([]), user_id=user_id, alias="Date Available", scene="generic",
        semantic_features=["date", "available"], field_type="date",
    )
    assert state_match is not None
    assert state_match.rule.core_field_key == "address.state"
    assert date_match is not None
    assert date_match.rule.core_field_key == "employment.date_available"


def test_mobile_phone_alias_matches_phone_profile_value() -> None:
    match = match_mapping_rule(
        RuleSession([]), user_id=uuid4(), alias="Mobile Phone", scene="generic",
        semantic_features=["mobile", "phone"], field_type="text",
    )
    assert match is not None
    assert match.rule.core_field_key == "identity.phone"


def test_registration_password_aliases_match_the_saved_password() -> None:
    for alias in ("Password", "New Password", "Verify New Password", "Confirm Password"):
        match = match_mapping_rule(
            RuleSession([]), user_id=uuid4(), alias=alias, scene="registration",
            semantic_features=alias.casefold().split(), field_type="password",
        )
        assert match is not None
        assert match.rule.core_field_key == "application.password"


def test_gender_specify_alias_does_not_reuse_primary_gender() -> None:
    match = match_mapping_rule(
        RuleSession([]), user_id=uuid4(), alias="Gender (please specify)", scene="generic",
        semantic_features=["gender", "please", "specify"], field_type="text",
    )
    assert match is not None
    assert match.rule.core_field_key == "demographic.gender_identity"


def test_full_name_user_rules_keep_the_name_parts_fallback() -> None:
    assert default_core_value_transform("identity.full_name") == {
        "operation": "join",
        "source_keys": ["identity.first_name", "identity.middle_name", "identity.last_name"],
        "separator": " ",
    }
    assert default_core_value_transform("employment.website") == {}
