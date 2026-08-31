from services.shared.autofill_intents import _autofill_intent_key_for_field
from services.shared.autofill_memory import fallback_mapping_scenes, platform_mapping_scene


class DummyField:
    def __init__(self, label: str = "", name: str = "", id_: str = "") -> None:
        self.label = label
        self.name = name
        self.id = id_


def test_platform_memory_is_scoped_to_ats_and_scene() -> None:
    assert platform_mapping_scene("workday", "job application") == "ats_workday__job_application"
    assert platform_mapping_scene("icims", "job application") == "ats_icims__job_application"
    assert platform_mapping_scene("successfactors", "job application") == "ats_successfactors__job_application"
    assert platform_mapping_scene("oracle", "job application") == "ats_oracle__job_application"
    assert platform_mapping_scene("workable", "job application") == "ats_workable__job_application"
    assert platform_mapping_scene("bamboohr", "job application") == "ats_bamboohr__job_application"
    assert platform_mapping_scene("jora", "job application") == "ats_jora__job_application"
    assert platform_mapping_scene("generic", "job application") == "job_application"


def test_platform_memory_falls_back_to_existing_generic_rules() -> None:
    assert fallback_mapping_scenes("greenhouse", "job application") == (
        "ats_greenhouse__job_application",
        "job_application",
    )
    assert fallback_mapping_scenes("workable", "job application") == (
        "ats_workable__job_application",
        "job_application",
    )
    assert fallback_mapping_scenes("jora", "job application") == (
        "ats_jora__job_application",
        "job_application",
    )


def test_new_ats_platforms_use_identifier_hints_for_autofill() -> None:
    for platform in ("icims", "successfactors", "oracle", "workable", "bamboohr", "jora"):
        field = DummyField(label="", name="first_name", id_="candidate_first_name")
        assert _autofill_intent_key_for_field(field, platform=platform) == "identity.first_name"

