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
        self.assertIn("职业简介（summary）", prompt)
        self.assertIn("核心能力（core_competencies）", prompt)
        self.assertIn("工作经历（experience）", prompt)
        self.assertIn("项目（projects）", prompt)

    def test_tailor_input_includes_source_style_anchors(self):
        messages = job_review.build_tailor_messages(self.job, self.resume)
        prompt_input = json.loads(messages[1]["content"])

        self.assertEqual(prompt_input["resume"]["summary"], self.resume["summary"])
        self.assertIn("experience", prompt_input["resume"])
        self.assertIn("projects", prompt_input["resume"])

    def test_tailor_input_includes_job_and_additional_resume_evidence(self):
        resume = {
            **self.resume,
            "education": [{"institution": "University", "degree": "BSc"}],
            "certifications": [{"type": "Cloud", "certifications": [{"name": "AWS Certified"}]}],
        }
        job = {**self.job, "title": "Platform Engineer", "company": "Example Co"}
        prompt_input = json.loads(job_review.build_tailor_messages(job, resume)[1]["content"])

        self.assertEqual(prompt_input["job"], {
            "title": "Platform Engineer",
            "company": "Example Co",
            "job_description": "Build C# APIs on AWS with CI/CD.",
            "output_language": "en",
        })
        self.assertEqual(prompt_input["resume"]["education"], resume["education"])
        self.assertEqual(prompt_input["resume"]["certifications"], resume["certifications"])
        self.assertIn("skills", prompt_input["resume"])
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

        self.assertIn("不得新增或推断未经支持", prompt)
        self.assertIn("React 不得变成 Angular", prompt)

    def test_prompt_uses_relevance_based_experience_bullet_guidance(self):
        prompt = job_review.TAILOR_PROMPT

        self.assertIn("3–5", prompt)
        self.assertIn("2–4", prompt)
        self.assertIn("1–2", prompt)
        self.assertIn("10–14", prompt)
        self.assertIn("指导，不是最低配额", prompt)
        self.assertNotIn("默认每段经历最多 3 条", prompt)

    def test_prompt_limits_project_bullets_by_relevance(self):
        prompt = job_review.TAILOR_PROMPT

        self.assertIn("通常保留 1–3 条", prompt)
        self.assertIn("最多 4 条", prompt)
        self.assertNotIn("通常保留 4-6 条", prompt)

    def test_prompt_keeps_project_evidence_and_blocks_semantic_stretching(self):
        prompt = job_review.TAILOR_PROMPT

        self.assertNotIn("JD Evidence Coverage Check", prompt)
        self.assertIn("最强或唯一", prompt)
        self.assertIn("客户调研", prompt)
        self.assertIn("JD 只能决定什么重要，不能决定候选人做过什么", prompt)
        self.assertIn("不得因为证据来自项目就自动降权", prompt)
        self.assertIn("特定产品/领域能力", prompt)
        self.assertNotIn("map-based software", prompt)

    def test_combined_prompt_has_one_output_schema(self):
        self.assertEqual(job_review.BOTH_PROMPT.count('"summary": ""'), 1)
        self.assertEqual(job_review.BOTH_PROMPT.count('"cover_letter": ""'), 1)

    def test_cover_letter_generation_mock_and_ai(self):
        mock_res = job_review.review_job(self.job, self.resume, doc_type="cover_letter", mock=True)
        self.assertIsNotNone(mock_res.get("cover_letter"))
        self.assertNotIn("Dear", mock_res["cover_letter"])
        self.assertNotIn("Sincerely", mock_res["cover_letter"])

        ai_cover_result = {"cover_letter": "Custom tailored cover letter."}
        with patch.object(job_review, "_complete", return_value=ai_cover_result):
            res = job_review.review_job(self.job, self.resume, doc_type="cover_letter")
            self.assertEqual(res["cover_letter"], "Custom tailored cover letter.")

    def test_cover_letter_prompt_uses_the_jd_primary_language(self):
        prompt = job_review.COVER_LETTER_PROMPT

        self.assertIn("要求输出语言：英文（en）", prompt)
        self.assertIn("`cover_letter` 必须使用“输出语言”规定的语言", prompt)

    def test_requested_output_language_reaches_prompt(self):
        messages = job_review.build_tailor_messages(
            {**self.job, "output_language": "zh-CN"},
            self.resume,
        )
        prompt_input = json.loads(messages[1]["content"])

        self.assertIn("要求输出语言：简体中文（zh-CN）", messages[0]["content"])
        self.assertEqual(prompt_input["job"]["output_language"], "zh-CN")

    def test_english_language_drift_retries_once(self):
        with patch.object(
            job_review,
            "_complete",
            side_effect=[{"summary": "这是一个中文职业简介，负责构建可靠的软件系统。"}, {"summary": "English professional summary."}],
        ) as complete:
            result = job_review.review_job(self.job, self.resume)

        self.assertEqual(complete.call_count, 2)
        self.assertEqual(result["resume_data"]["summary"], "English professional summary.")
        self.assertIn("语言校验失败", complete.call_args_list[1].args[0][-1]["content"])

    def test_both_generation_mock_and_ai(self):
        mock_res = job_review.review_job(self.job, self.resume, doc_type="both", mock=True)
        self.assertIsNotNone(mock_res.get("cover_letter"))
        self.assertIsNotNone(mock_res.get("resume_data"))
        self.assertIn("Full-Stack Engineering", mock_res["core_competencies"])

    def test_both_generation_uses_one_combined_usage_operation(self):
        def complete(_messages, **kwargs):
            return {
                "summary": "Tailored",
                "cover_letter": "Tailored cover letter.",
            }

        with patch.object(job_review, "_complete", side_effect=complete) as complete_mock:
            result = job_review.review_job(
                self.job,
                self.resume,
                doc_type="both",
                correlation_id="generation-1",
            )

        self.assertEqual(complete_mock.call_count, 1)
        calls = complete_mock.call_args_list
        self.assertEqual(
            {call.kwargs["operation"] for call in calls},
            {"resume_and_cover_letter"},
        )
        self.assertEqual({call.kwargs["correlation_id"] for call in calls}, {"generation-1"})
        self.assertTrue(all(call.kwargs["reasoning_effort"] == "low" for call in calls))
        self.assertEqual(result["cover_letter"], "Tailored cover letter.")

    def test_tailor_operations_use_low_thinking(self):
        for doc_type, operations in (("resume", {"resume_tailor"}), ("cover_letter", {"cover_letter"}), ("both", {"resume_and_cover_letter"})):
            with self.subTest(doc_type=doc_type), patch.object(job_review, "_complete", return_value={"summary": "Tailored"}) as complete:
                job_review.review_job(self.job, self.resume, doc_type=doc_type)

            self.assertEqual({call.kwargs["operation"] for call in complete.call_args_list}, operations)
            self.assertTrue(all(call.kwargs["reasoning_effort"] == "low" for call in complete.call_args_list))

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

    def test_omitted_skill_groups_are_not_restored(self):
        resume = {
            **self.resume,
            "skills": [
                {"type": "Frontend", "skills": ["React", "TypeScript"]},
                {"type": "Design", "skills": ["Photoshop", "Illustrator"]},
            ],
        }
        ai_result = {"skills": [{"type": "Frontend", "skills": ["React"]}]}

        with patch.object(job_review, "_complete", return_value=ai_result):
            result = job_review.review_job(self.job, resume)

        self.assertEqual(result["resume_data"]["skills"], [
            {"type": "Frontend", "skills": ["React"]},
        ])

    def test_hallucinated_skill_is_dropped(self):
        generated = [{"type": "Frontend", "skills": ["React", "Angular"]}]
        source = [{"type": "Frontend", "skills": ["React", "TypeScript"]}]

        self.assertEqual(job_review._normalize_skill_groups(source, generated), [
            {"type": "Frontend", "skills": ["React"]},
        ])

        self.assertEqual(job_review._normalize_skill_groups(source, [{"type": "Frontend", "skills": ["Angular"]}]), [])

    def test_skill_normalization_preserves_source_spelling(self):
        source = [{"type": "Frontend", "skills": ["Next.js"]}]
        generated = [{"type": "Frontend", "skills": ["nextjs"]}]

        self.assertEqual(job_review._normalize_skill_groups(source, generated), [
            {"type": "Frontend", "skills": ["Next.js"]},
        ])

    def test_preserves_complete_skill_groups_when_ai_omits_skills(self):
        with patch.object(job_review, "_complete", return_value={"summary": "", "key_qualifications": []}):
            result = job_review.review_job(self.job, self.resume)

        self.assertEqual(result["resume_data"]["skills"], [
            {"type": "Backend", "skills": ["C#", ".NET", "PostgreSQL"]},
            {"type": "Cloud", "skills": ["AWS", "GitHub Actions"]},
        ])

    def test_explicit_empty_skills_remain_empty(self):
        self.assertEqual(job_review._normalize_skill_groups(self.resume["skills"], []), [])

    def test_experience_bullets_are_capped_by_source_count_and_six(self):
        original = [{
            "company": "Acme",
            "description": [f"Source bullet {index}" for index in range(8)],
        }, {
            "company": "Beta",
            "description": ["Source bullet 1", "Source bullet 2"],
        }]
        generated = [
            {"index": 0, "bullets": [f"Generated bullet {index}" for index in range(10)]},
            {"index": 1, "bullets": [f"Generated bullet {index}" for index in range(4)]},
        ]

        merged = job_review._merge_experience_bullets(original, generated)

        self.assertEqual(len(merged[0]["description"]), 6)
        self.assertEqual(len(merged[1]["description"]), 2)

    def test_project_context_includes_source_index(self):
        projects = [{"name": "Jobby", "url": "https://example.test", "description": ["Built it."], "technologies": ["React"]}]

        self.assertEqual(job_review._project_context(projects), [{
            "index": 0,
            "name": "Jobby",
            "url": "https://example.test",
            "start_date": "",
            "end_date": "",
            "description": ["Built it."],
            "technologies": ["React"],
        }])

    def test_project_metadata_and_technologies_are_source_locked(self):
        source = [{
            "name": "Jobby",
            "url": "https://source.test",
            "start_date": "2023",
            "end_date": "2024",
            "description": ["Original"],
            "technologies": ["Next.js", "FastAPI"],
        }]
        generated = [{
            "index": 0,
            "name": "Invented Project",
            "url": "https://invented.test",
            "start_date": "1900",
            "end_date": "1901",
            "description": ["One", "Two", "Three", "Four", "Five"],
            "technologies": ["nextjs", "Angular", "FastAPI"],
        }]

        result = job_review._normalize_projects(source, generated)

        self.assertEqual(result, [{
            "name": "Jobby",
            "url": "https://source.test",
            "start_date": "2023",
            "end_date": "2024",
            "description": ["One", "Two", "Three", "Four"],
            "technologies": ["Next.js", "FastAPI"],
        }])

    def test_invalid_or_omitted_project_indexes_are_not_added(self):
        source = [{"name": "Jobby"}, {"name": "Other"}]

        self.assertEqual(job_review._normalize_projects(source, [{"index": 99}]), [])
        self.assertEqual(job_review._normalize_projects(source, [{"index": 1}]), [{"name": "Other"}])

    def test_empty_projects_remove_projects_and_malformed_projects_fallback(self):
        source = [{"name": "Jobby"}]

        self.assertEqual(job_review._normalize_projects(source, []), [])
        self.assertEqual(job_review._normalize_projects(source, None), source)
        self.assertEqual(job_review._normalize_projects(source, {"index": 0}), source)
        self.assertEqual(job_review._normalize_projects(source, [{"name": "Missing index"}]), source)

    def test_missing_or_empty_summary_preserves_source_summary(self):
        for generated_summary in (None, "", "   ", ["not a summary"]):
            ai_result = {"summary": generated_summary, "skills": [], "experience": [], "projects": []}
            with patch.object(job_review, "_complete", return_value=ai_result):
                result = job_review.review_job(self.job, self.resume)
            self.assertEqual(result["resume_data"]["summary"], self.resume["summary"])

    def test_core_competencies_are_capped_at_seven(self):
        ai_result = {"core_competencies": [f"Competency {index}" for index in range(10)], "skills": [], "experience": [], "projects": []}
        with patch.object(job_review, "_complete", return_value=ai_result):
            result = job_review.review_job(self.job, self.resume)

        self.assertEqual(len(result["core_competencies"]), 7)
        self.assertEqual(len(result["key_qualifications"]), 7)

    def test_missing_core_competencies_preserve_source_values(self):
        resume = {**self.resume, "core_competencies": ["Source competency"]}
        with patch.object(job_review, "_complete", return_value={"summary": "Updated summary", "skills": [], "experience": [], "projects": []}):
            result = job_review.review_job(self.job, resume)

        self.assertEqual(result["core_competencies"], ["Source competency"])
        self.assertEqual(result["key_qualifications"], ["Source competency"])

    def test_experience_metadata_remains_locked(self):
        generated = [{
            "index": 0,
            "company": "Invented Co",
            "title": "Invented Title",
            "location": "Elsewhere",
            "start_date": "January 1900",
            "end_date": "Present",
            "bullets": ["Rewritten source-supported bullet."],
        }]

        merged = job_review._merge_experience_bullets(self.resume["experience"], generated)

        self.assertEqual(merged[0]["company"], "Acme")
        self.assertEqual(merged[0]["title"], "Software Engineer")
        self.assertEqual(merged[0]["location"], "Sydney")
        self.assertEqual(merged[0]["start_date"], "January 2022")
        self.assertEqual(merged[0]["end_date"], "Present")
        self.assertEqual(merged[0]["description"], ["Rewritten source-supported bullet."])

    def test_experience_summary_merged_from_tailor_result(self):
        generated = [{
            "index": 0,
            "summary": "Architected and delivered scalable platforms.",
            "bullets": ["Rewritten bullet."],
        }]
        merged = job_review._merge_experience_bullets(self.resume["experience"], generated)
        self.assertEqual(merged[0]["summary"], "Architected and delivered scalable platforms.")

    def test_invalid_experience_index_preserves_every_source_experience(self):
        original = [
            self.resume["experience"][0],
            {"company": "Beta", "title": "Developer", "description": ["Built tooling."]},
        ]
        merged = job_review._merge_experience_bullets(original, [{"index": 99, "bullets": ["Invalid."]}])

        self.assertEqual(merged, original)

    def test_duplicate_experience_index_uses_only_the_first_valid_entry(self):
        merged = job_review._merge_experience_bullets(self.resume["experience"], [
            {"index": 0, "bullets": ["First replacement."]},
            {"index": 0, "bullets": ["Second replacement."]},
        ])

        self.assertEqual(merged[0]["description"], ["First replacement."])

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
        self.assertEqual(mock_complete.call_args.kwargs["reasoning_effort"], "low")
        self.assertEqual(result["resume_data"]["summary"], "Async tailored summary.")
        self.assertEqual(result["core_competencies"], ["C#", "AWS"])

    def test_async_both_review_uses_one_combined_usage_operation(self):
        async def complete(_messages, **kwargs):
            return {
                "summary": "Async tailored summary.",
                "core_competencies": ["C#", "AWS"],
                "skills": [],
                "experience": [],
                "projects": [],
                "cover_letter": "Async tailored cover letter.",
            }

        with patch.object(
            job_review,
            "_complete_async",
            new=AsyncMock(side_effect=complete),
        ) as complete_mock:
            result = asyncio.run(
                job_review.review_job_async(
                    self.job,
                    self.resume,
                    doc_type="both",
                    correlation_id="generation-1",
                )
            )

        self.assertEqual(complete_mock.await_count, 1)
        calls = complete_mock.await_args_list
        self.assertEqual(
            {call.kwargs["operation"] for call in calls},
            {"resume_and_cover_letter"},
        )
        self.assertEqual({call.kwargs["correlation_id"] for call in calls}, {"generation-1"})
        self.assertEqual(result["cover_letter"], "Async tailored cover letter.")

    def test_delete_tailored_resume_endpoint(self):
        import sys
        from uuid import uuid4
        from unittest.mock import MagicMock
        if "boto3" not in sys.modules:
            sys.modules["boto3"] = MagicMock()
        from services.api.routers.resumes import delete_tailored_resume
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

    def test_delete_tailored_document_keeps_the_other_document(self):
        import sys
        from uuid import uuid4
        from unittest.mock import MagicMock
        from services.api.routers.resumes import delete_tailored_document
        from services.shared.models import TailoredResume, User

        user_id = uuid4()
        user = MagicMock(spec=User)
        user.id = user_id

        for document_type in ("resume", "cover_letter"):
            with self.subTest(document_type=document_type):
                tailored_id = uuid4()
                tailored = MagicMock(spec=TailoredResume)
                tailored.id = tailored_id
                tailored.user_id = user_id
                tailored.resume_data = {"summary": "Resume content"}
                tailored.core_competencies = ["Python"]
                tailored.key_qualifications = ["APIs"]
                tailored.targeted_projects = [{"name": "Jobby"}]
                tailored.raw_ai_response = {
                    "summary": "Resume content",
                    "cover_letter": "Cover letter content",
                    "generated_documents": {"resume": True, "cover_letter": True},
                }

                db = MagicMock()
                db.get.return_value = tailored

                delete_tailored_document(
                    tailored_id,
                    document_type,
                    db=db,
                    current_user=user,
                )

                if document_type == "resume":
                    self.assertEqual(tailored.resume_data, {})
                    self.assertEqual(tailored.core_competencies, [])
                    self.assertEqual(tailored.key_qualifications, [])
                    self.assertEqual(tailored.targeted_projects, [])
                    self.assertNotIn("summary", tailored.raw_ai_response)
                    self.assertEqual(
                        tailored.raw_ai_response["cover_letter"],
                        "Cover letter content",
                    )
                    self.assertEqual(
                        tailored.raw_ai_response["generated_documents"],
                        {"cover_letter": True},
                    )
                else:
                    self.assertEqual(
                        tailored.resume_data,
                        {"summary": "Resume content"},
                    )
                    self.assertNotIn("cover_letter", tailored.raw_ai_response)
                    self.assertEqual(
                        tailored.raw_ai_response["generated_documents"],
                        {"resume": True},
                    )
                db.commit.assert_called_once()
                db.refresh.assert_called_once_with(tailored)

        for document_type in ("resume", "cover_letter"):
            with self.subTest(only=document_type):
                tailored_id = uuid4()
                tailored = MagicMock(spec=TailoredResume)
                tailored.id = tailored_id
                tailored.user_id = user_id
                tailored.resume_data = {"basics": {"first_name": "Candidate"}}
                tailored.core_competencies = ["Python"]
                tailored.key_qualifications = ["APIs"]
                tailored.targeted_projects = [{"name": "Jobby"}]
                tailored.raw_ai_response = {
                    "summary": "Resume content",
                    "cover_letter": "Cover letter content",
                    "generated_documents": {document_type: True},
                }

                db = MagicMock()
                db.get.return_value = tailored

                delete_tailored_document(
                    tailored_id,
                    document_type,
                    db=db,
                    current_user=user,
                )

                self.assertEqual(
                    tailored.raw_ai_response["generated_documents"],
                    {"resume": False, "cover_letter": False},
                )
                if document_type == "resume":
                    self.assertEqual(tailored.resume_data, {})
                else:
                    self.assertEqual(
                        tailored.resume_data,
                        {"basics": {"first_name": "Candidate"}},
                    )

    def test_update_tailored_resume_persists_cover_letter(self):
        import sys
        from uuid import uuid4
        from unittest.mock import MagicMock
        if "boto3" not in sys.modules:
            sys.modules["boto3"] = MagicMock()
        from services.api.routers.resumes import update_tailored_resume
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
