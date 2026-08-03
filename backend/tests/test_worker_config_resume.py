import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "worker")))

import unittest
from shared_services.persistence.worker_config import format_resume_data_to_text, _apply_resume_data

class WorkerConfigResumeTests(unittest.TestCase):
    def test_format_resume_data_to_text(self):
        resume_data = {
            "summary": "Experienced Full-Stack Developer.",
            "skills": [
                {"type": "Frontend", "skills": ["React", "Next.js"]},
                {"type": "Backend", "skills": ["Python", "FastAPI"]}
            ],
            "experience": [
                {
                    "title": "Senior Engineer",
                    "company": "Tech Corp",
                    "dates": "2022 - Present",
                    "bullets": ["Architected scalable web apps", "Improved performance by 50%"]
                }
            ],
            "projects": [
                {
                    "name": "Auto Apply Bot",
                    "technologies": ["Playwright", "FastAPI"],
                    "description": ["Automated job applications"]
                }
            ]
        }

        text = format_resume_data_to_text(resume_data)
        self.assertIn("Summary:\nExperienced Full-Stack Developer.", text)
        self.assertIn("Frontend: React, Next.js", text)
        self.assertIn("- Senior Engineer at Tech Corp (2022 - Present)", text)
        self.assertIn("* Architected scalable web apps", text)
        self.assertIn("- Auto Apply Bot [Playwright, FastAPI]", text)

    def test_apply_resume_data_populates_globals(self):
        globals_dict = {"user_information_all": "Candidate notes"}
        resume_data = {
            "basics": {
                "first_name": "Alex",
                "last_name": "Smith",
                "email": "alex@example.com",
                "phone": "+123456789"
            },
            "summary": "Full-Stack Engineer with 5 years experience."
        }

        _apply_resume_data(resume_data, [], globals_dict)

        self.assertEqual(globals_dict["first_name"], "Alex")
        self.assertEqual(globals_dict["last_name"], "Smith")
        self.assertEqual(globals_dict["email"], "alex@example.com")
        self.assertEqual(globals_dict["phone_number"], "+123456789")
        self.assertIn("--- RESUME DETAILS ---", globals_dict["user_information_all"])
        self.assertIn("Summary:\nFull-Stack Engineer with 5 years experience.", globals_dict["user_information_all"])

if __name__ == "__main__":
    unittest.main()
