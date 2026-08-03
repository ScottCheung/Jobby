import unittest
from unittest.mock import patch

from services.shared import resume_evaluator


RAW_EVALUATION = {
    "evaluation": [
        {
            "type": "experience_quality",
            "score": 60,
            "overview": "Experience bullets describe actions but rarely show outcomes.",
            "suggestions": ["Add credible outcomes to recent experience bullets."],
        },
        {
            "type": "factual_completeness",
            "score": 80,
            "overview": "Core career facts are present with one incomplete date range.",
            "suggestions": ["Complete the missing employment date."],
        },
        {
            "type": "information_density",
            "score": 90,
            "overview": "The resume is concise and avoids repeated content.",
            "suggestions": [],
        },
        {
            "type": "skill_evidence",
            "score": 70,
            "overview": "Most listed skills have supporting experience evidence.",
            "suggestions": ["Connect AWS to a specific project or role."],
        },
    ]
}


class ResumeEvaluatorTests(unittest.TestCase):
    def test_normalizes_fixed_order_and_calculates_weighted_total(self):
        result = resume_evaluator.normalize_resume_evaluation(RAW_EVALUATION)

        self.assertEqual(result["overall_score"], 70)
        self.assertEqual(
            [item["type"] for item in result["evaluation"]],
            list(resume_evaluator.DIMENSION_WEIGHTS),
        )

    def test_compact_input_excludes_identity_and_company_values(self):
        resume_data = {
            "basics": {"first_name": "Private", "email": "private@example.com"},
            "experience": [
                {
                    "company": "Secret Company",
                    "title": "Engineer",
                    "start_date": "2022",
                    "description": ["Implemented a reliable API."],
                    "technologies": ["Python"],
                }
            ],
            "education": [],
            "projects": [],
            "skills": [{"type": "Technical", "skills": ["Python"]}],
        }

        compact = resume_evaluator._evaluation_input(resume_data)
        serialized = str(compact)

        self.assertNotIn("Private", serialized)
        self.assertNotIn("private@example.com", serialized)
        self.assertNotIn("Secret Company", serialized)
        self.assertTrue(compact["signals"]["has_name"])
        self.assertTrue(compact["signals"]["has_contact"])

    def test_evaluation_uses_independent_prompt_and_operation(self):
        resume_data = {
            "experience": [{"title": "Engineer", "description": ["Built an API."]}],
            "education": [],
            "projects": [],
            "skills": [{"type": "Technical", "skills": ["Python"]}],
        }

        with patch.object(resume_evaluator, "_complete", return_value=RAW_EVALUATION) as complete:
            result = resume_evaluator.evaluate_resume_data(resume_data)

        self.assertEqual(result["overall_score"], 64)
        self.assertEqual(complete.call_args.kwargs["operation"], "resume_evaluation")
        messages = complete.call_args.args[0]
        self.assertEqual(messages[0]["content"], resume_evaluator.RESUME_EVALUATION_PROMPT)
        self.assertNotIn("Required JSON schema", messages[0]["content"])

    def test_completeness_uses_structured_presence_not_private_values(self):
        resume_data = {
            "basics": {"first_name": "Private", "email": "private@example.com"},
            "experience": [{
                "company": "Secret Company",
                "title": "Engineer",
                "start_date": "2022",
                "end_date": "Present",
                "description": ["Built an API."],
            }],
            "education": [{
                "institution": "Private University",
                "degree": "Bachelor of Science",
                "field_of_study": "Computer Science",
            }],
            "projects": [],
            "skills": [{"type": "Technical", "skills": ["Python"]}],
        }

        result = resume_evaluator.normalize_resume_evaluation(RAW_EVALUATION, resume_data)
        completeness = result["evaluation"][0]

        self.assertEqual(completeness["score"], 100)
        self.assertEqual(completeness["suggestions"], [])

    def test_high_scores_and_generic_skill_advice_do_not_force_suggestions(self):
        raw = {
            "evaluation": [
                {
                    "type": "experience_quality",
                    "score": 85,
                    "overview": "Experience is specific and outcome focused.",
                    "suggestions": ["Add more organizational context."],
                },
                {
                    "type": "skill_evidence",
                    "score": 80,
                    "overview": "Core skills have supporting evidence.",
                    "suggestions": ["Ensure all listed skills appear in experience descriptions."],
                },
                {
                    "type": "information_density",
                    "score": 90,
                    "overview": "Content is concise and reusable.",
                    "suggestions": ["Condense some bullets."],
                },
            ],
        }
        resume_data = {
            "basics": {"first_name": "A", "email": "a@example.com"},
            "experience": [{
                "company": "Company",
                "title": "Engineer",
                "start_date": "2022",
                "end_date": "Present",
                "description": ["Built an API with Python."],
            }],
            "education": [{
                "institution": "University",
                "degree": "Bachelor of Science",
                "field_of_study": "Computer Science",
            }],
            "skills": [{"type": "Technical", "skills": ["Python"]}],
        }

        result = resume_evaluator.normalize_resume_evaluation(raw, resume_data)

        self.assertTrue(all(not item["suggestions"] for item in result["evaluation"]))

    def test_missing_dimension_is_rejected(self):
        incomplete = {"evaluation": RAW_EVALUATION["evaluation"][:-1]}

        with self.assertRaises(resume_evaluator.ResumeEvaluationError):
            resume_evaluator.normalize_resume_evaluation(incomplete)


if __name__ == "__main__":
    unittest.main()
