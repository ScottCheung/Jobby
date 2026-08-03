from __future__ import annotations

import os
import sys

WORKER_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "worker"))
if WORKER_ROOT not in sys.path:
    sys.path.insert(0, WORKER_ROOT)

from shared_services.resumes.tailored_materializer import materialize_tailored_resume_pdf


def test_materializer_creates_pdf_outside_worker_checkout(tmp_path) -> None:
    path = materialize_tailored_resume_pdf(
        {
            "job_title": "Backend Engineer",
            "company": "Example Co",
            "resume_data": {
                "basics": {"name": "Ada Lovelace", "email": "ada@example.com"},
                "summary": "Builds reliable APIs.",
                "skills": [{"type": "Languages", "skills": ["Python", "SQL"]}],
                "experience": [
                    {
                        "title": "Engineer",
                        "company": "Example Co",
                        "dates": "2020 - Present",
                        "bullets": ["Built backend services."],
                    }
                ],
            },
        }
    )

    try:
        assert os.path.exists(path)
        assert os.path.getsize(path) > 0
        assert "worker" not in os.path.abspath(path).split(os.sep)
    finally:
        os.unlink(path)
