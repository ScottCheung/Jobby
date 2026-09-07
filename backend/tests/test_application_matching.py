from __future__ import annotations

from unittest.mock import patch
import pytest

from services.shared.application_matching import (
    ExperienceResult, _extract_user_years, calculate_experience_score,
    TitleResult, calculate_title_result, calculate_title_score, parse_recency_score,
    score_job_match,
)
from services.shared.skill_catalog import extract_jd_skills, _MULTI_WORD_INDEX


@pytest.mark.parametrize('title,low,high', [
    ('Front End Engineer', 0.95, 1), ('React Developer', 0.90, 1),
    ('Full Stack Engineer', 0.75, 0.90), ('Software Engineer', 0.60, 0.79),
    ('Data Engineer', 0, 0.35), ('DevOps Engineer', 0, 0.35),
    ('Salesforce Administrator', 0, 0.25), ('HR Manager', 0, 0.25),
])
def test_title_calibration(title, low, high):
    score = calculate_title_score(title, {'target_title': 'Frontend Developer'}, '', 1)
    assert low <= score <= high


@pytest.mark.parametrize('target,title', [
    ('Software Engineer', 'Software Developer'),
    ('Full Stack Developer', 'Fullstack Engineer'),
])
def test_normalized_title_equivalence(target, title):
    assert calculate_title_score(title, {'target_title': target}, '', 1) == 1


def test_generic_engineer_and_history_cannot_override_target():
    resume = {'target_title': 'Frontend Developer', 'experience': [{'title': 'Data Engineer'}]}
    assert calculate_title_score('Data Engineer', resume, '', 1) < 0.35
    assert calculate_title_score('Engineer', resume, '', 1) < 0.40
    assert calculate_title_score('HR Manager', {'target_title': 'Software Engineer'}, '', 1) < 0.25


def test_title_evidence_has_explicit_and_historical_confidence():
    assert calculate_title_result('Frontend Developer', {'target_title': 'Frontend Developer'}, '', 1) == TitleResult(1, 1)
    historical = calculate_title_result(
        'Frontend Developer', {'experience': [{'title': 'Frontend Developer'}]}, '', 1
    )
    assert historical.score == 1
    assert historical.confidence == 0.75
    assert calculate_title_result('Frontend Developer', {'skills': ['React']}, '', 1) == TitleResult(0, 0)


def test_missing_title_evidence_does_not_dilute_skill_match():
    result = score_job_match(
        'React required.',
        {'skills': ['React']},
        job_title='Frontend Developer',
        technologies=['React'],
    )
    assert result.title_score == 0
    assert result.title_confidence == 0
    assert result.exp_score is None
    assert result.match_score == 1


def test_match_score_has_no_ambiguous_score_alias():
    result = score_job_match('React required.', {'skills': ['React']}, technologies=['React'])
    assert not hasattr(result, 'score')


def test_seniority_ignores_incidental_stakeholders_and_engineers():
    result = calculate_experience_score(
        'You will collaborate with senior stakeholders.',
        'Frontend Developer',
        {'years_of_experience': 3},
        'Worked closely with senior engineers',
    )
    assert result == ExperienceResult(0.85, 1, 3)


def test_unknown_experience_is_excluded_not_zero():
    resume = {'target_title': 'Frontend Developer', 'skills': ['React']}
    unknown = score_job_match('React required. 3 years experience.', resume, job_title='Frontend Developer', technologies=['React'])
    zero = score_job_match('React required. 3 years experience.', resume, job_title='Frontend Developer', technologies=['React'], user_years_experience=0)
    assert _extract_user_years(resume, None) == (None, 0)
    assert unknown.exp_score is None
    assert unknown.match_score == 1
    assert zero.exp_score is not None
    assert zero.match_score < unknown.match_score
    exact = calculate_experience_score('3 years experience', 'Frontend Developer', resume, '', 3)
    assert exact == ExperienceResult(1, 1, 3)


@pytest.mark.parametrize('resume,years,confidence', [
    ({'experience': [{'start_date': '2020-01', 'end_date': '2023-12'}]}, 4, 0.95),
    ({'experience': [{'start_date': '2020-01', 'end_date': '2022-12'}, {'start_date': '2021-01', 'end_date': '2023-12'}]}, 4, 0.95),
    ({'experience': [{'start_date': f'{year}-01', 'end_date': f'{year}-03'} for year in (2021, 2022, 2023)]}, 0.75, 0.95),
    ({'summary': '3 years of experience'}, 3, 0.65),
    ({'total_work_experience': '4 years 9 months'}, 4.75, 1),
    ({'experience': [{'start_date': '2023-99', 'end_date': '2024-01'}]}, None, 0),
    ({'years_of_experience': float('nan')}, None, 0),
])
def test_experience_evidence(resume, years, confidence):
    assert _extract_user_years(resume, None) == (years, confidence)


def test_primary_coverage_and_required_skill_monotonicity():
    description = 'Required:\nReact\nTypeScript\nKafka\nKubernetes'
    scores = [score_job_match(description, {'skills': skills}, technologies=['React', 'TypeScript'])
              for skills in ([], ['React'], ['React', 'TypeScript'], ['React', 'TypeScript', 'Kafka'])]
    assert scores[2].skill_score == 0.90
    assert all(a.skill_score <= b.skill_score for a, b in zip(scores, scores[1:]))
    assert all(a.match_score <= b.match_score for a, b in zip(scores, scores[1:]))


def test_skill_context_aliases_and_inline_preference():
    result = score_job_match('Required: ReactJS; Kafka preferred.', {'skills': ['React']}, technologies=['React', 'Kafka'])
    assert result.skill_score == round(1 / 1.35, 4)
    result = score_job_match('Next.js required.', {'skills': ['Next.js']}, technologies=['Next.js', 'NextJS'])
    assert result.skill_score == 1
    for description in ('React required. Kafka preferred.', 'React required but Kafka preferred.'):
        result = score_job_match(description, {'skills': ['React']}, technologies=['React', 'Kafka'])
        assert result.skill_score == round(1 / 1.35, 4)


@pytest.mark.parametrize('text', [
    'React, REST APIs, GitHub Actions and Amazon Web Services',
    'Project Management, Supply Chain Management and Financial Reporting',
    'C++ programming, CI/CD pipelines and .NET Core',
])
def test_indexed_catalog_retains_multiword_matches(text):
    reference = {label for entries in _MULTI_WORD_INDEX.values() for label, pattern in entries if pattern.search(text)}
    assert reference <= set(extract_jd_skills(text))


def test_current_experience_uses_resume_schema_flag():
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    years, confidence = _extract_user_years({'experience': [{'start_date': f'{now.year}-01', 'is_current': True}]}, None)
    assert years == now.month / 12
    assert confidence == 0.95


def test_freshness_never_changes_compatibility():
    resume = {'target_title': 'Frontend Developer', 'skills': ['React'], 'years_of_experience': 3}
    scores = [score_job_match('React required. 3 years experience.', resume, job_title='Frontend Developer', technologies=['React'], date_posted=age)
              for age in ('30 days ago', '7 days ago', '1 day ago')]
    assert all(s.match_score == 1 for s in scores)
    assert scores[0].priority_score < scores[1].priority_score < scores[2].priority_score


@pytest.mark.parametrize('component', ['skill', 'title', 'experience'])
def test_component_increase_cannot_reduce_match(component):
    scores = []
    for value in (0, 0.25, 0.5, 0.75, 1):
        with patch('services.shared.application_matching.calculate_title_score', return_value=value if component == 'title' else 0.5), patch(
            'services.shared.application_matching.calculate_experience_score',
            return_value=ExperienceResult(value if component == 'experience' else 0.5, 0.65, 3),
        ):
            skills = ['React', 'TypeScript', 'Kafka', 'Kubernetes']
            result = score_job_match('', {'skills': skills[:int(value * 4)] if component == 'skill' else skills[:2]}, job_title='Frontend Developer', technologies=skills)
            scores.append(result.match_score)
            assert all(0 <= score <= 1 for score in (result.match_score, result.priority_score, result.skill_score, result.title_score, result.exp_score))
    assert scores == sorted(scores)


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
    assert result.match_score > 0.45


def test_unrelated_job_gets_a_low_score() -> None:
    result = score_job_match(
        "Senior iOS Swift UIKit engineer",
        {"skills": [{"type": "Backend", "skills": ["Python", "FastAPI"]}]},
    )

    assert result.match_score < 0.25
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

    assert result.match_score >= 0.45


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

    assert result.match_score < 0.55


def test_empty_inputs_are_safe_and_explainable() -> None:
    result = score_job_match("", {})

    assert result.match_score == 0.0
    assert result.matched_terms == ()


def test_recency_decay_boosts_fresh_and_penalises_old_jobs() -> None:
    resume = {
        "summary": "Senior Python Backend Developer with 5 years experience",
        "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
    }
    desc = "Python Backend Developer role requiring FastAPI, PostgreSQL, Docker, AWS. 5+ years experience required."

    fresh = score_job_match(desc, resume, date_posted="2 hours ago")
    older = score_job_match(desc, resume, date_posted="30+ days ago")

    assert fresh.priority_score > older.priority_score


@pytest.mark.parametrize("age, expected", [
    ("today", 1.00),
    ("1 day ago", 0.96),
    ("2 days ago", 0.91),
    ("3 days ago", 0.86),
    ("4 days ago", 0.81),
    ("5 days ago", 0.76),
    ("6 days ago", 0.72),
    ("7 days ago", 0.68),
    ("10 days ago", 0.60),
    ("14 days ago", 0.52),
    ("21 days ago", 0.42),
    ("30+ days ago", 0.32),
    ("45 days ago", 0.25),
    ("90 days ago", 0.25),
])
def test_recency_score_matches_recommendation_calibration(age: str, expected: float) -> None:
    assert parse_recency_score(age) == expected


def test_recency_score_interpolates_between_anchors_and_is_monotonic() -> None:
    assert parse_recency_score("8 days ago") == 0.6533
    scores = [parse_recency_score(f"{days} days ago") for days in range(0, 61)]
    assert all(left >= right for left, right in zip(scores, scores[1:]))
    assert scores[-1] == 0.25


def test_recency_score_keeps_unknown_date_neutral() -> None:
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
    assert res.match_score < 0.50


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
    assert res.recency_factor == 0.8600  # 3 days ago recency factor (0.86)
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


def test_browser_technologies_use_one_supporting_catalog_scan() -> None:
    with patch("services.shared.application_matching.extract_jd_skills") as extract_catalog:
        score_job_match(
            "React is required for this role.",
            {"skills": ["React"]},
            job_title="Frontend Developer",
            technologies=["React"],
        )

    extract_catalog.assert_called_once()


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
    assert result.recency_factor == 0.32
    assert result.priority_score == round(result.match_score * result.recency_factor, 4)


def test_match_components_are_independent_of_posting_age() -> None:
    resume = {
        "target_title": "Frontend Developer",
        "skills": ["React", "TypeScript"],
        "years_of_experience": 5,
    }
    description = "React and TypeScript required. 5+ years of experience required."
    fresh = score_job_match(
        description,
        resume,
        job_title="Frontend Developer",
        technologies=["React", "TypeScript"],
        date_posted="today",
    )
    old = score_job_match(
        description,
        resume,
        job_title="Frontend Developer",
        technologies=["React", "TypeScript"],
        date_posted="30 days ago",
    )

    assert (fresh.match_score, fresh.skill_score, fresh.title_score, fresh.exp_score) == (
        old.match_score, old.skill_score, old.title_score, old.exp_score
    )
    assert fresh.recency_factor > old.recency_factor
    assert fresh.priority_score == fresh.match_score
    assert old.priority_score == round(old.match_score * old.recency_factor, 4)


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
