from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from services.api import main


def test_existing_processing_generation_is_idempotent() -> None:
    existing = SimpleNamespace(status="processing")
    db = MagicMock()
    db.scalar.return_value = existing

    tailored_resume, should_generate = main.start_tailored_resume_generation(
        db,
        SimpleNamespace(id="user-1"),
        SimpleNamespace(id="application-1"),
    )

    assert tailored_resume is existing
    assert should_generate is False
    db.add.assert_not_called()
    db.commit.assert_not_called()


def test_new_generation_is_persisted_before_ai_work_starts() -> None:
    db = MagicMock()
    db.scalar.return_value = None
    user = SimpleNamespace(id="user-1")
    application = SimpleNamespace(
        id="application-1",
        title="Engineer",
        company="Example Co",
        job_description="Build APIs",
    )
    profile = SimpleNamespace(
        id="profile-1",
        extra_data={"resume_data": {"summary": "Candidate"}},
    )

    with patch.object(main, "_default_career_profile", return_value=profile):
        tailored_resume, should_generate = main.start_tailored_resume_generation(
            db,
            user,
            application,
        )

    assert should_generate is True
    assert tailored_resume.status == "processing"
    assert tailored_resume.resume_data == {}
    assert tailored_resume.source_resume_data == {"summary": "Candidate"}
    db.add.assert_called_once_with(tailored_resume)
    db.commit.assert_called_once()


def test_background_generation_uses_mocked_result_and_marks_ready() -> None:
    tailored_resume = SimpleNamespace(
        id="resume-1",
        job_application_id="application-1",
        status="processing",
        source_resume_data={"summary": "Candidate"},
        job_description="Build APIs",
        job_title="Engineer",
        company="Example Co",
        resume_data={},
        raw_ai_response={},
        core_competencies=[],
        key_qualifications=[],
        targeted_projects=[],
        error_message=None,
    )
    application = SimpleNamespace(id="application-1", date_posted=None)
    db = MagicMock()
    db.get.side_effect = lambda model, _id: (
        tailored_resume if model is main.TailoredResume else application
    )
    result = {
        "resume_data": {"summary": "Tailored"},
        "core_competencies": ["Python"],
    }

    with (
        patch.object(main, "SessionLocal", return_value=db),
        patch.object(main, "_run_tailored_resume_generation", return_value=result) as generate,
        patch.object(main, "broadcast_sync") as broadcast,
    ):
        main.process_tailored_resume("resume-1")

    generate.assert_called_once_with(tailored_resume, application, mock=False)
    assert tailored_resume.status == "ready"
    assert tailored_resume.resume_data == {"summary": "Tailored"}
    assert tailored_resume.core_competencies == ["Python"]
    db.commit.assert_called_once()
    db.close.assert_called_once()
    broadcast.assert_called_once()


def test_generate_endpoint_returns_processing_record_and_schedules_background_work() -> None:
    application = SimpleNamespace(id="application-1", user_id="user-1")
    tailored_resume = SimpleNamespace(id="resume-1", status="processing")
    db = MagicMock()
    db.get.return_value = application
    background_tasks = main.BackgroundTasks()

    with patch.object(
        main,
        "start_tailored_resume_generation",
        return_value=(tailored_resume, True),
    ):
        result = main.generate_application_tailored_resume(
            "application-1",
            background_tasks,
            db=db,
            current_user=SimpleNamespace(id="user-1"),
        )

    assert result is tailored_resume
    assert len(background_tasks.tasks) == 1
    assert background_tasks.tasks[0].func is main.process_tailored_resume
    assert background_tasks.tasks[0].args == ("resume-1",)


def test_job_review_persists_processing_before_mocked_generation() -> None:
    db = MagicMock()
    db.scalars.return_value.all.return_value = []
    profile = SimpleNamespace(
        id="profile-1",
        extra_data={"resume_data": {"summary": "Candidate"}},
    )
    added: list[object] = []

    def add(record: object) -> None:
        added.append(record)
        if isinstance(record, main.JobApplication):
            record.id = "application-1"
        elif isinstance(record, main.TailoredResume):
            record.id = "resume-1"

    db.add.side_effect = add

    def mocked_review(*_args, **_kwargs):
        tailored_resume = next(
            record for record in added if isinstance(record, main.TailoredResume)
        )
        assert db.commit.call_count == 1
        assert tailored_resume.status == "processing"
        return {
            "resume_data": {"summary": "Tailored"},
            "core_competencies": ["Python"],
            "raw_ai_response": {},
        }

    with (
        patch.object(main, "_default_career_profile", return_value=profile),
        patch.object(main, "review_job", side_effect=mocked_review),
        patch.object(main, "tailored_resume_response", return_value={"id": "resume-1"}),
        patch.object(main, "broadcast_sync"),
    ):
        result = main.review_job_from_jd(
            {
                "job_description": "Build APIs",
                "title": "Engineer",
                "company": "Example Co",
                "doc_type": "resume",
                "mock": True,
                "generation_id": "generation-1",
            },
            db=db,
            current_user=SimpleNamespace(id="user-1"),
        )

    tailored_resume = next(
        record for record in added if isinstance(record, main.TailoredResume)
    )
    assert db.commit.call_count == 2
    assert tailored_resume.status == "ready"
    assert tailored_resume.resume_data == {"summary": "Tailored"}
    assert result["tailored_resume"] == {"id": "resume-1"}
