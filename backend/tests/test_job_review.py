import json
import unittest
from unittest.mock import patch

from services.shared import job_review


class JobReviewTests(unittest.TestCase):
    def setUp(self):
        self.resume = {
            "summary": "Full-stack developer.",
            "skills": [
                {"type": "Backend", "skills": ["C#", ".NET", "PostgreSQL"]},
                {"type": "Cloud", "skills": ["AWS", "GitHub Actions"]},
            ],
            "experience": [{"description": ["Built APIs using C#."]}],
            "projects": [{"name": "Jobby", "description": ["Built resume tooling."]}],
        }
        self.job = {"job_description": "Build C# APIs on AWS with CI/CD."}

    def test_prompt_requires_editorial_selection_and_grounded_claims(self):
        prompt = job_review.TAILOR_PROMPT

        self.assertIn("editorial selection task", prompt)
        self.assertIn("do not remove strong evidence merely to satisfy an arbitrary count", prompt)
        self.assertIn("do not shorten it to meet an arbitrary page or word target", prompt)
        self.assertIn("do not assume the role is technical", prompt)
        self.assertIn('targeted_projects: default to []', prompt)
        self.assertIn("Do not target an arbitrary count", prompt)

    def test_tailor_input_excludes_old_summary_to_avoid_anchoring(self):
        messages = job_review.build_tailor_messages(self.job, self.resume)
        prompt_input = json.loads(messages[1]["content"])

        self.assertNotIn("summary", prompt_input["resume"])
        self.assertIn("experience", prompt_input["resume"])
        self.assertIn("projects", prompt_input["resume"])

    def test_accepts_new_qualifications_and_normalizes_flat_skills(self):
        ai_result = {
            "summary": "C# developer with API experience.",
            "key_qualifications": ["C#", "AWS", "CI/CD"],
            "skills": ["C#", ".NET", "AWS", "GitHub Actions"],
            "experience": [{"index": 0, "bullets": ["Built C# APIs."]}],
            "projects": self.resume["projects"],
            "targeted_projects": [],
        }
        with patch.object(job_review, "_complete", return_value=ai_result):
            result = job_review.review_job(self.job, self.resume)

        self.assertEqual(result["key_qualifications"], ["C#", "AWS", "CI/CD"])
        self.assertEqual(result["resume_data"]["skills"], [
            {"type": "Backend", "skills": ["C#", ".NET"]},
            {"type": "Cloud", "skills": ["AWS", "GitHub Actions"]},
        ])
        self.assertEqual(result["raw_ai_response"], ai_result)

    def test_keeps_representative_items_when_model_omits_a_group(self):
        resume = {
            **self.resume,
            "skills": [
                *self.resume["skills"],
                {"type": "Frontend", "skills": ["TypeScript", "React", "Next.js", "Framer Motion"]},
            ],
        }
        ai_result = {"skills": [{"type": "Backend", "skills": ["C#"]}]}

        with patch.object(job_review, "_complete", return_value=ai_result):
            result = job_review.review_job(self.job, resume)

        self.assertIn({"type": "Frontend", "skills": ["TypeScript", "React"]}, result["resume_data"]["skills"])

    def test_keeps_skill_groups_when_ai_omits_skills(self):
        with patch.object(job_review, "_complete", return_value={"summary": "", "key_qualifications": []}):
            result = job_review.review_job(self.job, self.resume)

        self.assertEqual(result["resume_data"]["skills"], [
            {"type": "Backend", "skills": ["C#", ".NET"]},
            {"type": "Cloud", "skills": ["AWS", "GitHub Actions"]},
        ])

    def test_accepts_legacy_match_skills_during_transition(self):
        with patch.object(job_review, "_complete", return_value={"match_skills": ["C#"]}):
            result = job_review.review_job(self.job, self.resume)

        self.assertEqual(result["key_qualifications"], ["C#"])

    def test_mock_mode_bypasses_ai(self):
        with patch.object(job_review, "_complete") as mock_complete:
            result = job_review.review_job(self.job, self.resume, mock=True)
            mock_complete.assert_not_called()

        self.assertTrue(result["raw_ai_response"].get("mock"))
        self.assertIn("Full-Stack Engineering", result["core_competencies"])


if __name__ == "__main__":
    unittest.main()

