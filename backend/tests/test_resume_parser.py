import unittest
from unittest.mock import patch

from services.shared import resume_parser


SAMPLE_RESUME = """John Doe
Summary
Backend engineer building reliable services.
Experience
Acme Pty Ltd | Software Engineer | Brisbane
January 2022 - Present
Description: Built a payment processing platform.
Technologies: Python, AWS
Skills
Python, AWS
"""


class ResumeParserOptimizationTests(unittest.TestCase):
    def test_normalization_removes_leading_bullet_and_number_markers(self):
        result = resume_parser.normalize_resume_data({
            "experience": [{
                "description": [
                    "- Built a payment platform",
                    "* Improved deployment automation",
                    "·Maintained internal services",
                    "●Wrote API documentation",
                    "1. Reduced deployment time",
                    "2) Supported database operations",
                    "Improved conversion by -5% in one segment",
                ],
            }],
            "education": [{"highlights": ["▪ Dean's List"]}],
        })

        self.assertEqual(
            result["experience"][0]["description"],
            [
                "Built a payment platform",
                "Improved deployment automation",
                "Maintained internal services",
                "Wrote API documentation",
                "Reduced deployment time",
                "Supported database operations",
                "Improved conversion by -5% in one segment",
            ],
        )
        self.assertEqual(result["education"][0]["highlights"], ["Dean's List"])

    def test_respects_explicit_empty_or_modified_links_array(self):
        # When links is explicitly set to [] (user deleted all links),
        # normalize_resume_data should NOT re-add basics.linkedin_id via legacy_link_map
        result = resume_parser.normalize_resume_data({
            "basics": {"first_name": "John", "linkedin_id": "https://linkedin.com/in/johndoe"},
            "links": [],
        })
        self.assertEqual(result.get("links"), [])

        # When links has specific custom links, do not auto-append legacy linkedin link if excluded
        result_custom = resume_parser.normalize_resume_data({
            "basics": {"first_name": "John", "linkedin_id": "https://linkedin.com/in/johndoe"},
            "links": [{"type": "GitHub", "link": "https://github.com/johndoe"}],
        })
        self.assertEqual(result_custom.get("links"), [{"type": "GitHub", "link": "https://github.com/johndoe"}])

    def test_normalizes_combined_degree_and_field_of_study(self):
        cases = (
            ("Bachelor of Science in Computer Science", "Bachelor of Science", "Computer Science"),
            (
                "Master of Information Technology - Artificial Intelligence",
                "Master of Information Technology",
                "Artificial Intelligence",
            ),
        )
        for combined, expected_degree, expected_field in cases:
            with self.subTest(combined=combined):
                result = resume_parser.normalize_resume_data({
                    "education": [{
                        "institution": "Example University",
                        "degree": combined,
                    }],
                })

                self.assertEqual(result["education"][0]["degree"], expected_degree)
                self.assertEqual(result["education"][0]["field_of_study"], expected_field)

    def test_keeps_separate_degree_and_field_of_study(self):
        result = resume_parser.normalize_resume_data({
            "education": [{
                "degree": "Master of Science",
                "field_of_study": "Data Science",
            }],
        })

        self.assertEqual(result["education"][0]["degree"], "Master of Science")
        self.assertEqual(result["education"][0]["field_of_study"], "Data Science")

    def test_prepares_numbered_source_without_lossy_truncation(self):
        source = "Page 1 of 2\nplat-\nform engineering\n-----\nTip to jobseeker: add metrics\nKept line"

        lines = resume_parser._prepare_resume_lines(source)

        self.assertEqual(lines, ["platform engineering", "Kept line"])
        self.assertEqual(resume_parser._numbered_resume_text(lines), "1|platform engineering\n2|Kept line")

    def test_optimized_parser_restores_long_text_from_line_references(self):
        optimized_result = {
            "basics": {"first_name": "John", "last_name": "Doe"},
            "summary": {"line_ids": [3]},
            "experience": [
                {
                    "company": "Acme Pty Ltd",
                    "title": "Software Engineer",
                    "location": "Brisbane",
                    "start_date": "January 2022",
                    "end_date": "Present",
                    "description": {"line_ids": [7]},
                    "technologies": ["Python", "AWS"],
                }
            ],
            "skills": [{"type": "Other", "skills": ["Python", "AWS"]}],
            "search_terms": ["Software Engineer", "Backend Engineer", "Python Developer"],
        }

        with patch.object(resume_parser, "_complete", return_value=optimized_result) as complete:
            result = resume_parser.parse_resume_text_raw(SAMPLE_RESUME)

        self.assertEqual(result["summary"], "Backend engineer building reliable services.")
        self.assertEqual(result["experience"][0]["description"], ["Built a payment processing platform."])
        self.assertEqual(complete.call_count, 1)
        messages = complete.call_args.args[0]
        self.assertEqual(messages[0]["content"], resume_parser.RESUME_COMPACT_PROMPT)
        self.assertIn("7|Description: Built a payment processing platform.", messages[1]["content"])

    def test_missing_explicit_section_uses_legacy_parser(self):
        incomplete_result = {
            "skills": [{"type": "Other", "skills": ["Python"]}],
            "search_terms": ["Software Engineer", "Backend Engineer", "Python Developer"],
        }
        legacy_result = {
            "experience": [{"company": "Acme Pty Ltd", "title": "Software Engineer"}],
            "search_terms": ["Software Engineer", "Backend Engineer", "Python Developer"],
        }

        with patch.object(resume_parser, "_complete", side_effect=[incomplete_result, legacy_result]) as complete:
            result = resume_parser.parse_resume_text_raw(SAMPLE_RESUME)

        self.assertEqual(result, legacy_result)
        self.assertEqual(complete.call_count, 2)
        legacy_messages = complete.call_args_list[1].args[0]
        self.assertIn("Required JSON schema", legacy_messages[1]["content"])

    def test_missing_dated_item_uses_legacy_parser(self):
        source = SAMPLE_RESUME.replace(
            "Skills\n",
            "Beta Ltd | Senior Engineer\nMarch 2020 - December 2021\n- Led API delivery.\nSkills\n",
        )
        incomplete_result = {
            "experience": [
                {
                    "company": "Acme Pty Ltd",
                    "title": "Software Engineer",
                    "description": {"line_ids": [7]},
                    "technologies": ["Python", "AWS"],
                }
            ],
            "skills": [{"type": "Other", "skills": ["Python", "AWS"]}],
            "search_terms": ["Software Engineer", "Backend Engineer", "Python Developer"],
        }
        legacy_result = {
            "experience": [
                {"company": "Acme Pty Ltd", "title": "Software Engineer"},
                {"company": "Beta Ltd", "title": "Senior Engineer"},
            ],
            "search_terms": ["Software Engineer", "Backend Engineer", "Python Developer"],
        }

        with patch.object(resume_parser, "_complete", side_effect=[incomplete_result, legacy_result]) as complete:
            result = resume_parser.parse_resume_text_raw(source)

        self.assertEqual(result, legacy_result)
        self.assertEqual(complete.call_count, 2)

    def test_oversized_numbered_source_skips_optimized_api_call(self):
        source = "Experience\n" + "\n".join(f"Line {index} " + ("x" * 100) for index in range(500))
        legacy_result = {"search_terms": ["Engineer", "Developer", "Consultant"]}

        with patch.object(resume_parser, "_complete", return_value=legacy_result) as complete:
            result = resume_parser.parse_resume_text_raw(source)

        self.assertEqual(result, legacy_result)
        self.assertEqual(complete.call_count, 1)
        messages = complete.call_args.args[0]
        self.assertIn("Required JSON schema", messages[1]["content"])


if __name__ == "__main__":
    unittest.main()
