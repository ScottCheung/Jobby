from __future__ import annotations

from services.shared.application_matching import score_job_match


def test_match_score_uses_resume_terms_and_returns_explanation() -> None:
    result = score_job_match(
        "Build Python APIs with FastAPI and PostgreSQL",
        {
            "summary": "Backend engineer",
            "skills": [{"type": "Backend", "skills": ["Python", "FastAPI"]}],
        },
    )

    assert result.score > 0.45
    assert "python" in result.matched_terms
    assert "fastapi" in result.matched_terms


def test_unrelated_job_gets_a_low_score() -> None:
    result = score_job_match(
        "Senior iOS Swift UIKit engineer",
        {"skills": [{"type": "Backend", "skills": ["Python", "FastAPI"]}]},
    )

    assert result.score < 0.25
    assert result.matched_terms == ()


def test_title_alignment_keeps_verbose_relevant_job_above_application_threshold() -> None:
    result = score_job_match(
        "We are hiring a collaborative team member to build scalable products. "
        "Responsibilities include React, TypeScript, REST APIs, testing, and GitHub Actions. "
        + "The successful candidate will communicate with stakeholders and deliver outcomes. " * 20,
        {
            "summary": "Full-Stack Developer using React, Next.js, and FastAPI",
            "search_terms": ["Frontend Developer", "Full-Stack Developer"],
            "skills": ["React", "JavaScript", "TypeScript", "REST APIs", "GitHub Actions"],
        },
        job_title="Frontend Engineer - JavaScript (Remote)",
    )

    assert result.score >= 0.55


def test_unrelated_title_cannot_pass_on_generic_description_overlap_alone() -> None:
    result = score_job_match(
        "Build scalable products with teams, APIs, testing, cloud systems, and agile delivery.",
        {
            "summary": "Full-Stack Developer building scalable products with APIs and cloud systems",
            "search_terms": ["Frontend Developer", "Backend Developer"],
            "skills": ["React", "TypeScript", "FastAPI", "AWS"],
        },
        job_title="Salesforce Administrator",
    )

    assert result.score < 0.55


def test_empty_inputs_are_safe_and_explainable() -> None:
    result = score_job_match("", {})

    assert result.score == 0.0
    assert result.matched_terms == ()


def test_recency_decay_boosts_fresh_and_penalises_old_jobs() -> None:
    resume = {
        "summary": "Senior Python Backend Developer with 5 years experience",
        "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
    }
    desc = "Python Backend Developer role requiring FastAPI, PostgreSQL, Docker, AWS. 5+ years experience required."

    fresh = score_job_match(desc, resume, date_posted="2 hours ago")
    older = score_job_match(desc, resume, date_posted="30+ days ago")

    assert fresh.score > older.score


def test_daily_linear_recency_decay_schedule() -> None:
    from services.shared.application_matching import parse_recency_score
    assert parse_recency_score("today") == 1.00
    assert parse_recency_score("2 days ago") == 0.90
    assert parse_recency_score("3 days ago") == 0.80
    assert parse_recency_score("4 days ago") == 0.70
    assert parse_recency_score("5 days ago") == 0.60
    assert parse_recency_score("6 days ago") == 0.50
    assert parse_recency_score("7 days ago") == 0.40
    assert parse_recency_score("30+ days ago") == 0.25


def test_six_day_old_job_decay_significantly_reduces_score() -> None:
    resume = {
        "summary": "Full Stack Engineer",
        "skills": ["Python", "React", "Docker", "MySQL"],
    }
    desc = "Python, React, Docker, MySQL."
    
    fresh = score_job_match(desc, resume, job_title="Full Stack Engineer", date_posted="today")
    six_days_old = score_job_match(desc, resume, job_title="Full Stack Engineer", date_posted="6 days ago")
    
    assert fresh.score > 0.50
    assert six_days_old.score == round(fresh.score * 0.50, 4)






