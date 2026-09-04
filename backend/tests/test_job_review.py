import json
import asyncio
import unittest
import sys
from unittest.mock import AsyncMock, MagicMock, patch

for mod in ["boto3", "pypdf", "pypdf.errors"]:
    if mod not in sys.modules:
        sys.modules[mod] = MagicMock()

from services.shared import job_review


class JobReviewTests(unittest.TestCase):
    def setUp(self):
        self.resume = {
            "summary": "Full-stack developer.",
            "skills": [
                {"type": "Backend", "skills": ["C#", ".NET", "PostgreSQL"]},
                {"type": "Cloud", "skills": ["AWS", "GitHub Actions"]},
            ],
            "experience": [{
                "company": "Acme",
                "title": "Software Engineer",
                "location": "Sydney",
                "start_date": "January 2022",
                "end_date": "Present",
                "description": ["Built APIs using C#."],
            }],
            "projects": [{"name": "Jobby", "description": ["Built resume tooling."]}],
        }
        self.job = {"job_description": "Build C# APIs on AWS with CI/CD."}

    def test_prompt_requires_editorial_selection_and_grounded_claims(self):
        prompt = job_review.TAILOR_PROMPT

        self.assertIn("简历编辑专家", prompt)
        self.assertIn("SUMMARY", prompt)
        self.assertIn("CORE_COMPETENCIES", prompt)
        self.assertIn("EXPERIENCE", prompt)
        self.assertIn("PROJECTS", prompt)

    def test_tailor_input_excludes_old_summary_to_avoid_anchoring(self):
        messages = job_review.build_tailor_messages(self.job, self.resume)
        prompt_input = json.loads(messages[1]["content"])

        self.assertNotIn("summary", prompt_input["resume"])
        self.assertIn("experience", prompt_input["resume"])
        self.assertIn("projects", prompt_input["resume"])

    def test_tailor_input_includes_work_history_metadata(self):
        messages = job_review.build_tailor_messages(self.job, self.resume)
        experience = json.loads(messages[1]["content"])["resume"]["experience"]

        self.assertEqual(experience, [{
            "index": 0,
            "title": "Software Engineer",
            "company": "Acme",
            "location": "Sydney",
            "start_date": "January 2022",
            "end_date": "Present",
            "bullets": ["Built APIs using C#."],
        }])

    def test_tailor_input_includes_deduplicated_work_duration(self):
        resume = {
            **self.resume,
            "experience": [
                self.resume["experience"][0],
                {
                    "company": "Acme",
                    "title": "Part-time Engineer",
                    "start_date": "January 2023",
                    "end_date": "December 2023",
                    "description": ["Built tooling."],
                },
            ],
        }
        prompt_input = json.loads(job_review.build_tailor_messages(self.job, resume)[1]["content"])

        self.assertEqual(prompt_input["resume"]["total_work_experience"], "4 years 9 months")

    def test_both_prompt_reuses_resume_evidence_rules(self):
        prompt = job_review.BOTH_PROMPT

        self.assertIn("不得因技术相近", prompt)
        self.assertIn("最多 3 条", prompt)
        self.assertIn("不得把 React 写成 Angular", prompt)

    def test_cover_letter_generation_mock_and_ai(self):
        mock_res = job_review.review_job(self.job, self.resume, doc_type="cover_letter", mock=True)
        self.assertIsNotNone(mock_res.get("cover_letter"))
        self.assertIn("Dear Hiring Team", mock_res["cover_letter"])

        ai_cover_result = {"cover_letter": "Custom tailored cover letter."}
        with patch.object(job_review, "_complete", return_value=ai_cover_result):
            res = job_review.review_job(self.job, self.resume, doc_type="cover_letter")
            self.assertEqual(res["cover_letter"], "Custom tailored cover letter.")

    def test_both_generation_mock_and_ai(self):
        mock_res = job_review.review_job(self.job, self.resume, doc_type="both", mock=True)
        self.assertIsNotNone(mock_res.get("cover_letter"))
        self.assertIsNotNone(mock_res.get("resume_data"))
        self.assertIn("Full-Stack Engineering", mock_res["core_competencies"])

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

    def test_async_review_uses_cancellable_completion_path(self):
        ai_result = {
            "summary": "Async tailored summary.",
            "core_competencies": ["C#", "AWS"],
            "skills": [{"type": "Backend", "skills": ["C#", ".NET"]}],
            "experience": [{"index": 0, "bullets": ["Built APIs using C#."]}],
            "projects": [],
        }
        with patch.object(
            job_review,
            "_complete_async",
            new=AsyncMock(return_value=ai_result),
        ) as mock_complete:
            result = asyncio.run(job_review.review_job_async(self.job, self.resume))

        mock_complete.assert_awaited_once()
        self.assertEqual(result["resume_data"]["summary"], "Async tailored summary.")
        self.assertEqual(result["core_competencies"], ["C#", "AWS"])

    def test_delete_tailored_resume_endpoint(self):
        import sys
        from uuid import uuid4
        from unittest.mock import MagicMock
        if "boto3" not in sys.modules:
            sys.modules["boto3"] = MagicMock()
        from services.api.main import delete_tailored_resume
        from services.shared.models import TailoredResume, User

        user_id = uuid4()
        user = MagicMock(spec=User)
        user.id = user_id

        tailored_id = uuid4()
        tailored = MagicMock(spec=TailoredResume)
        tailored.id = tailored_id
        tailored.user_id = user_id

        db = MagicMock()
        db.get.return_value = tailored

        res = delete_tailored_resume(tailored_id, db=db, current_user=user)
        self.assertTrue(res["success"])
        self.assertEqual(res["id"], str(tailored_id))
        db.delete.assert_called_once_with(tailored)
        db.commit.assert_called_once()

    def test_update_tailored_resume_persists_cover_letter(self):
        import sys
        from uuid import uuid4
        from unittest.mock import MagicMock
        if "boto3" not in sys.modules:
            sys.modules["boto3"] = MagicMock()
        from services.api.main import update_tailored_resume
        from services.shared.models import TailoredResume, User

        user_id = uuid4()
        user = MagicMock(spec=User)
        user.id = user_id

        tailored_id = uuid4()
        tailored = MagicMock(spec=TailoredResume)
        tailored.id = tailored_id
        tailored.user_id = user_id
        tailored.raw_ai_response = {}

        db = MagicMock()
        db.get.return_value = tailored

        update_tailored_resume(
            tailored_id,
            {"cover_letter": "Dear Hiring Manager,\n\nI am excited to apply."},
            db=db,
            current_user=user,
        )
        self.assertEqual(
            tailored.raw_ai_response.get("cover_letter"),
            "Dear Hiring Manager,\n\nI am excited to apply.",
        )
        self.assertTrue(tailored.raw_ai_response.get("generated_documents", {}).get("cover_letter"))
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(tailored)


if __name__ == "__main__":
    unittest.main()
