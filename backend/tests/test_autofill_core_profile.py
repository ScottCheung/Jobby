from uuid import uuid4

from services.shared.autofill_profile import (
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
