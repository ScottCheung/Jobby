from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi import BackgroundTasks

from services.api.routers import applications, job_review
from services.domain import tailored_resumes
from services.shared.models import Job, JobApplication, TailoredResume


def test_existing_processing_generation_is_idempotent() -> None:
    existing = SimpleNamespace(status="processing")
    db = MagicMock()
    db.scalar.return_value = existing

    tailored_resume, should_generate = tailored_resumes.start_tailored_resume_generation(
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

    with patch.object(tailored_resumes, "_default_career_profile", return_value=profile):
        tailored_resume, should_generate = tailored_resumes.start_tailored_resume_generation(
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
    application = SimpleNamespace(id="application-1", last_posted_at=None)
    db = MagicMock()
    db.get.side_effect = lambda model, _id: (
        tailored_resume if model is TailoredResume else application
    )
    result = {
        "resume_data": {"summary": "Tailored"},
        "core_competencies": ["Python"],
    }

    with (
        patch.object(tailored_resumes, "SessionLocal", return_value=db),
        patch.object(tailored_resumes, "_run_tailored_resume_generation", return_value=result) as generate,
        patch.object(tailored_resumes, "broadcast_sync") as broadcast,
    ):
        tailored_resumes.process_tailored_resume("resume-1")

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
    background_tasks = BackgroundTasks()

    with patch.object(
        applications,
        "start_tailored_resume_generation",
        return_value=(tailored_resume, True),
    ):
        result = applications.generate_application_tailored_resume(
            "application-1",
            background_tasks,
            db=db,
            current_user=SimpleNamespace(id="user-1"),
        )

    assert result is tailored_resume
    assert len(background_tasks.tasks) == 1
    assert background_tasks.tasks[0].func is applications.process_tailored_resume
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
        if isinstance(record, JobApplication):
            record.id = "application-1"
        elif isinstance(record, TailoredResume):
            record.id = "resume-1"

    db.add.side_effect = add

    def mocked_review(*_args, **_kwargs):
        tailored_resume = next(
            record for record in added if isinstance(record, TailoredResume)
        )
        assert db.commit.call_count == 1
        assert tailored_resume.status == "processing"
        return {
            "resume_data": {"summary": "Tailored"},
            "core_competencies": ["Python"],
            "raw_ai_response": {},
        }

    with (
        patch.object(job_review, "_default_career_profile", return_value=profile),
        patch.object(job_review, "review_job", side_effect=mocked_review),
        patch.object(job_review, "tailored_resume_response", return_value={"id": "resume-1"}),
        patch.object(job_review, "broadcast_sync"),
    ):
        result = job_review.review_job_from_jd(
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
        record for record in added if isinstance(record, TailoredResume)
    )
    assert db.commit.call_count == 2
    assert tailored_resume.status == "ready"
    assert tailored_resume.resume_data == {"summary": "Tailored"}
    assert result["tailored_resume"] == {"id": "resume-1"}


def test_job_review_does_not_reuse_another_jobs_record_but_reuses_current_job_record() -> None:
    db = MagicMock()
    db.scalars.return_value.all.return_value = []
    user = SimpleNamespace(id="user-1")
    profile = SimpleNamespace(
        id="profile-1",
        extra_data={"resume_data": {"summary": "Candidate"}},
    )
    job_a_id = str(uuid4())
    job_b_id = str(uuid4())
    job_a_record = SimpleNamespace(
        id=job_a_id,
        user_id="user-1",
        job_title="Job A",
        company="Company A",
        job_description="Build product A",
    )
    added: list[object] = []
    application = None
    created = None

    def add(record: object) -> None:
        nonlocal application, created
        added.append(record)
        if isinstance(record, JobApplication):
            record.id = "application-b"
            application = record
        elif isinstance(record, TailoredResume):
            record.id = job_b_id
            created = record

    def get(model: object, record_id: object) -> object | None:
        if model is TailoredResume:
            if str(record_id) == job_a_id:
                return job_a_record
            if str(record_id) == job_b_id:
                return created
        if model is JobApplication:
            return application
        return None

    db.add.side_effect = add
    db.get.side_effect = get
    reviewer_jobs: list[dict] = []

    def mocked_review(job: dict, *_args, **_kwargs) -> dict:
        reviewer_jobs.append(job)
        return {
            "resume_data": {"summary": "Tailored"},
            "core_competencies": ["Python"],
            "raw_ai_response": {},
        }

    job_b = {
        "job_description": "Build product B",
        "title": "Job B",
        "company": "Company B",
    }

    with (
        patch.object(tailored_resumes, "_default_career_profile", return_value=profile),
        patch.object(
            tailored_resumes,
            "upsert_job",
            return_value=SimpleNamespace(
                job=Job(
                    id="job-b",
                    title="Job B",
                    company="Company B",
                    description="Build product B",
                )
            ),
        ),
    ):
        _, first_record = tailored_resumes.generate_tailored_document(
            db,
            user,
            job=job_b,
            doc_type="resume",
            tailored_resume_id=job_a_id,
            generation_id="generation-b-resume",
            reviewer=mocked_review,
        )
        second, _ = tailored_resumes.generate_tailored_document(
            db,
            user,
            job=job_b,
            doc_type="cover_letter",
            tailored_resume_id=first_record.id,
            generation_id="generation-b-cover-letter",
            reviewer=mocked_review,
        )

    assert created is first_record
    assert second["resume_data"] == {"summary": "Tailored"}
    assert len([record for record in added if isinstance(record, TailoredResume)]) == 1
    assert [job["title"] for job in reviewer_jobs] == ["Job B", "Job B"]
    assert [job["company"] for job in reviewer_jobs] == ["Company B", "Company B"]
    assert [job["job_description"] for job in reviewer_jobs] == [
        "Build product B",
        "Build product B",
    ]
