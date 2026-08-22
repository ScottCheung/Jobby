from services.shared.autofill_memory import fallback_mapping_scenes, platform_mapping_scene


def test_platform_memory_is_scoped_to_ats_and_scene() -> None:
    assert platform_mapping_scene("workday", "job application") == "ats_workday__job_application"
    assert platform_mapping_scene("generic", "job application") == "job_application"


def test_platform_memory_falls_back_to_existing_generic_rules() -> None:
    assert fallback_mapping_scenes("greenhouse", "job application") == (
        "ats_greenhouse__job_application",
        "job_application",
    )
