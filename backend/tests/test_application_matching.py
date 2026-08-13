from __future__ import annotations

from services.shared.application_matching import parse_recency_score, score_job_match


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


def test_alias_normalization_matches_synonyms() -> None:
    result = score_job_match(
        "Require ReactJS and Golang experience with K8s",
        {
            "summary": "Full-stack developer",
            "skills": ["React.js", "Go", "Kubernetes"],
        },
    )

    assert "react" in result.matched_terms
    assert "go" in result.matched_terms
    assert "kubernetes" in result.matched_terms
    assert result.score > 0.45


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

    assert result.score >= 0.45


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


def test_smooth_plateau_recency_decay_schedule() -> None:
    assert parse_recency_score("today") > 0.95
    assert parse_recency_score("1 day ago") == 0.9200
    assert parse_recency_score("2 days ago") == 0.7547
    assert parse_recency_score("3 days ago") == 0.6191
    assert parse_recency_score("7 days ago") == 0.2804
    assert parse_recency_score("30+ days ago") < 0.05
    assert parse_recency_score(None) == 1.00


def test_seniority_mismatch_penalty() -> None:
    junior_resume = {
        "summary": "Junior Software Engineer / Intern with 1 year experience",
        "skills": ["Python", "JavaScript"],
    }
    desc = "Looking for a Staff Principal Architect to design distributed systems using Python and JavaScript."

    res = score_job_match(desc, junior_resume, job_title="Staff Principal Architect")
    assert res.score < 0.50







