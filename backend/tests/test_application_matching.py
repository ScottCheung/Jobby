from __future__ import annotations

from unittest.mock import patch

from services.shared.application_matching import parse_recency_score, score_job_match


def test_match_score_uses_resume_terms_and_returns_explanation() -> None:
    result = score_job_match(
        "Build Python APIs with FastAPI and PostgreSQL",
        {
            "summary": "Backend engineer",
            "skills": [{"type": "Backend", "skills": ["Python", "FastAPI"]}],
        },
    )

    assert result.match_score > 0.45
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
    assert parse_recency_score("1 day ago") == 0.9600
    assert parse_recency_score("2 days ago") == 0.9200
    assert parse_recency_score("3 days ago") == 0.8800
    assert parse_recency_score("4 days ago") == 0.8400
    assert parse_recency_score("5 days ago") == 0.7313
    assert parse_recency_score("7 days ago") == 0.5542
    assert parse_recency_score("8 days ago") == 0.4825
    assert parse_recency_score("9 days ago") == 0.4200
    assert parse_recency_score("9d ago") == 0.4200
    assert parse_recency_score("2 weeks ago") == 0.2100
    assert parse_recency_score("14d ago") == 0.2100
    assert parse_recency_score("19 days ago") == 0.1050
    assert parse_recency_score("26d ago") == 0.0398
    assert parse_recency_score("30+ days ago") < 0.05
    assert parse_recency_score(None) == 0.75
    assert parse_recency_score("Unknown") == 0.75
    assert parse_recency_score("未知") == 0.75
    assert parse_recency_score("无法标准化") == 0.75


def test_seniority_mismatch_penalty() -> None:
    junior_resume = {
        "summary": "Junior Software Engineer / Intern with 1 year experience",
        "skills": ["Python", "JavaScript"],
    }
    desc = "Looking for a Staff Principal Architect to design distributed systems using Python and JavaScript."

    res = score_job_match(desc, junior_resume, job_title="Staff Principal Architect")
    assert res.score < 0.50


def test_tiered_skill_weighting_gives_high_score_when_all_technologies_match() -> None:
    resume = {
        "summary": "Frontend Engineer specializing in React, Next.js, and TypeScript",
        "skills": ["React", "TypeScript", "Next.js", "REST APIs", "Tailwind CSS"],
    }
    desc = "Promising front-end developer needed to join in the development of a new SaaS product as well as integration of new AI interfaces."
    technologies = ["React", "Next.js", "TypeScript", "REST APIs"]

    res = score_job_match(
        desc,
        resume,
        job_title="Front End Developer",
        date_posted="3 days ago",
        technologies=technologies,
    )

    # When all 4 core hard technologies match, skill_score should be >= 0.85 and match_score >= 0.85
    assert res.skill_score >= 0.85
    assert res.title_score == 1.0  # Front End Developer vs Frontend Engineer synonym match
    assert res.match_score >= 0.85
    assert res.recency_factor == 0.8800  # 3 days ago recency factor (0.88)
    assert res.priority_score == round(res.match_score * res.recency_factor, 4)


def test_required_skills_outweigh_preferred_skills() -> None:
    description = """
    Required:
    - React
    - TypeScript
    Nice to have:
    - Kafka
    """
    resume_without_preferred = {"skills": ["React", "TypeScript"]}
    resume_without_required = {"skills": ["TypeScript", "Kafka"]}
    technologies = ["React", "TypeScript", "Kafka"]

    preferred_missing = score_job_match(
        description,
        resume_without_preferred,
        job_title="Frontend Developer",
        technologies=technologies,
    )
    required_missing = score_job_match(
        description,
        resume_without_required,
        job_title="Frontend Developer",
        technologies=technologies,
    )

    assert preferred_missing.skill_score > 0.80
    assert required_missing.skill_score < 0.65
    assert preferred_missing.skill_score > required_missing.skill_score


def test_browser_technologies_skip_catalog_rescan() -> None:
    with patch("services.shared.application_matching.extract_jd_skills") as extract_catalog:
        score_job_match(
            "React is required for this role.",
            {"skills": ["React"]},
            job_title="Frontend Developer",
            technologies=["React"],
        )

    extract_catalog.assert_not_called()


def test_strong_match_keeps_freshness_out_of_match_score() -> None:
    result = score_job_match(
        """
        Required:
        - React
        - TypeScript
        - REST APIs
        5+ years of experience required.
        """,
        {
            "target_title": "Frontend Developer",
            "skills": ["React", "TypeScript", "REST APIs"],
            "years_of_experience": 5,
        },
        job_title="Frontend Developer",
        technologies=["React", "TypeScript", "REST APIs"],
        date_posted="30+ days ago",
    )

    assert result.match_score >= 0.85
    assert result.recency_factor < 0.10
    assert result.priority_score < result.match_score * 0.10


def test_experience_uses_dated_intervals_and_merges_overlap() -> None:
    four_year_role = {
        "experience": [{"start_date": "2020-01", "end_date": "2023-12"}],
        "skills": ["Python"],
    }
    internships = {
        "experience": [
            {"start_date": "2022-01", "end_date": "2022-03"},
            {"start_date": "2022-06", "end_date": "2022-08"},
            {"start_date": "2023-01", "end_date": "2023-03"},
        ],
        "skills": ["Python"],
    }
    overlapping_roles = {
        "experience": [
            {"start_date": "2020-01", "end_date": "2022-12"},
            {"start_date": "2021-01", "end_date": "2023-12"},
        ],
        "skills": ["Python"],
    }

    four_year_result = score_job_match(
        "Python role requiring 4 years of experience.",
        four_year_role,
        job_title="Software Engineer",
    )
    internship_result = score_job_match(
        "Python role requiring 1 year of experience.",
        internships,
        job_title="Software Engineer",
    )
    overlap_result = score_job_match(
        "Python role requiring 5 years of experience.",
        overlapping_roles,
        job_title="Software Engineer",
    )

    assert four_year_result.exp_score == 1.0
    assert 0.80 < internship_result.exp_score < 0.90
    assert overlap_result.exp_score < 0.80


def test_explicit_total_work_experience_takes_precedence() -> None:
    result = score_job_match(
        "Python role requiring 4 years of experience.",
        {
            "total_work_experience": "4 years 9 months",
            "experience": [{"start_date": "2023-01", "end_date": "2023-06"}],
            "skills": ["Python"],
        },
        job_title="Software Engineer",
    )

    assert result.exp_score == 0.9775


def test_title_differentiation_across_domains() -> None:
    frontend_resume = {
        "target_title": "Senior Frontend Developer",
        "search_terms": ["Frontend Engineer", "React Developer"],
        "summary": "Senior Frontend Developer with 5+ years building React & TypeScript apps",
        "skills": ["React", "TypeScript", "Next.js", "CSS", "HTML"],
    }
    desc = "We are seeking an experienced developer to join our product engineering group."

    # 1. Exact domain & title match -> high score (>= 0.90)
    exact_res = score_job_match(desc, frontend_resume, job_title="Frontend Engineer")
    assert exact_res.title_score >= 0.90

    # 2. Adjacent domain match (Fullstack) -> good affinity (0.70 - 0.90)
    adjacent_res = score_job_match(desc, frontend_resume, job_title="Full Stack Engineer")
    assert 0.70 <= adjacent_res.title_score <= 0.90

    # 3. Cross domain (Data / ML) -> low title score (<= 0.35)
    cross_res = score_job_match(desc, frontend_resume, job_title="Data Engineer - ETL & Spark")
    assert cross_res.title_score <= 0.35

    # 4. Mobile domain (iOS) vs Frontend -> moderate/low distinction (<= 0.50)
    mobile_res = score_job_match(desc, frontend_resume, job_title="Senior iOS Swift Engineer")
    assert mobile_res.title_score <= 0.50

    # 5. Non-tech/unrelated -> very low title score (<= 0.25)
    unrelated_res = score_job_match(desc, frontend_resume, job_title="Human Resources Coordinator")
    assert unrelated_res.title_score <= 0.25


def test_experience_differentiation_and_gradients() -> None:
    mid_resume = {
        "years_of_experience": 3.0,
        "summary": "Software Engineer with 3 years experience in web platforms",
        "skills": ["Python", "FastAPI", "React"],
    }
    desc_template = "Engineering role working on cloud platforms using Python and React. {}"

    # 1. Sweet spot: requires 3 years, user has 3 years -> 0.95 - 1.00
    sweet_res = score_job_match(desc_template.format("3+ years of experience required."), mid_resume, job_title="Software Engineer")
    assert sweet_res.exp_score >= 0.95

    # 2. Underqualified: requires 5 years, user has 3 years -> 0.50 - 0.75
    under_res = score_job_match(desc_template.format("Minimum 5 years of experience required."), mid_resume, job_title="Senior Software Engineer")
    assert under_res.exp_score < 0.75

    # 3. Severely underqualified: requires 8 years, user has 3 years -> <= 0.45
    severely_under = score_job_match(desc_template.format("8+ years of experience required."), mid_resume, job_title="Staff Principal Engineer")
    assert severely_under.exp_score <= 0.45

    # 4. Overqualified: user with 10 years applying to 1 year entry job -> 0.70 - 0.85 (not 1.0)
    senior_resume = {
        "years_of_experience": 10.0,
        "summary": "Lead Principal Architect with 10 years of experience",
        "skills": ["Python", "FastAPI", "React"],
    }
    over_res = score_job_match(desc_template.format("1-2 years experience required."), senior_resume, job_title="Junior Software Engineer")
    assert 0.65 <= over_res.exp_score <= 0.85

    # 5. No explicit years in JD -> baseline ~0.85 (not blind 1.0)
    no_years_res = score_job_match("Looking for a software engineer to build APIs.", mid_resume, job_title="Software Engineer")
    assert no_years_res.exp_score == 0.85











def test_unrelated_role_without_tech_tags_is_damped_and_not_recommended() -> None:
    engineer_resume = {
        "target_title": "Software Engineer",
        "search_terms": ["Software Engineer", "Backend Developer", "Full Stack Developer"],
        "summary": "Software Engineer with 4 years experience building web systems, data validation pipelines, and APIs.",
        "skills": ["Python", "FastAPI", "React", "PostgreSQL", "Docker"],
    }
    payroll_desc = (
        "The Payroll Officer will join IMC Finance team in Sydney, working directly with the Payroll Manager "
        "to execute and govern payroll across 5+ APAC jurisdictions, supporting 350+ employees. "
        "Key near-term priority is supporting the global payroll migration to Neeyamo. "
        "Responsibilities include end-to-end APAC payroll, payroll mutations, reconciliations, and posting to GL in Workday."
    )

    result = score_job_match(
        payroll_desc,
        engineer_resume,
        job_title="Payroll Officer",
        date_posted="Unknown",
    )

    # Title score should be very low (< 0.25)
    assert result.title_score < 0.25
    # Skill score should be damped due to domain mismatch, NOT 1.00
    assert result.skill_score < 0.30
    # Recency factor should be neutral 0.75 for unknown date
    assert result.recency_factor == 0.75
    # Overall score should be firmly in Not Recommended territory (< 0.40)
    assert result.match_score < 0.35
    assert result.priority_score < 0.30
