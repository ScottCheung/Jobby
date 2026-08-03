import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from services.api import main
from services.shared.models import MasterResume


class ResumeLifecycleTests(unittest.TestCase):
    def test_draft_response_keeps_the_published_version_stable(self):
        published_data = {"basics": {"first_name": "A"}}
        draft_data = {"basics": {"first_name": "A", "headline": "Engineer"}}
        resume = SimpleNamespace(
            id=uuid4(),
            original_filename="resume.pdf",
            original_url="https://assets.example/resume.pdf",
            resume_data=draft_data,
            content_version=19,
            published_version=3,
            draft_base_version=3,
            published_data=published_data,
            evaluation={},
            published_evaluation={},
            evaluation_updated_at=None,
            published_at=None,
            status="draft",
            confirmed_at=None,
            created_at=main.utc_now(),
            updated_at=main.utc_now(),
        )

        response = main.master_resume_response(resume)

        self.assertEqual(response["content_version"], 3)
        self.assertEqual(response["published_version"], 3)
        self.assertTrue(response["has_draft_changes"])

    def test_evaluation_is_current_only_for_the_exact_draft_content(self):
        resume_data = {"basics": {"first_name": "A"}}
        evaluation = {
            "source_hash": main.resume_content_hash(resume_data),
            "rubric_version": main.RUBRIC_VERSION,
        }
        resume = SimpleNamespace(
            id=uuid4(),
            original_filename="resume.pdf",
            original_url="https://assets.example/resume.pdf",
            resume_data=resume_data,
            published_version=1,
            draft_base_version=1,
            published_data=resume_data,
            evaluation=evaluation,
            published_evaluation=evaluation,
            evaluation_updated_at=main.utc_now(),
            published_at=main.utc_now(),
            status="confirmed",
            confirmed_at=main.utc_now(),
            created_at=main.utc_now(),
            updated_at=main.utc_now(),
        )

        response = main.master_resume_response(resume)

        self.assertTrue(response["evaluation_is_current"])
        resume.resume_data = {"basics": {"first_name": "B"}}
        self.assertFalse(main.master_resume_response(resume)["evaluation_is_current"])

    def test_upload_identity_prefers_current_asset_url(self):
        current_upload_id = str(uuid4())
        stale_upload_id = str(uuid4())
        resume = SimpleNamespace(
            original_url=f"https://assets.example/master-resumes/user/{current_upload_id}.pdf?v=2",
            original_storage_key=f"master-resumes/user/{stale_upload_id}.pdf",
        )

        self.assertEqual(main.resume_upload_id(resume), current_upload_id)
        self.assertEqual(
            main.canonical_resume_storage_key(resume),
            f"master-resumes/user/{current_upload_id}.pdf",
        )

    def test_stale_parse_cannot_overwrite_a_new_upload(self):
        current_upload_id = str(uuid4())
        stale_upload_id = str(uuid4())
        resume = SimpleNamespace(
            status="processing",
            original_url=f"https://assets.example/master-resumes/user/{current_upload_id}.pdf",
            original_storage_key=f"master-resumes/user/{current_upload_id}.pdf",
        )
        db = MagicMock()
        db.scalar.return_value = True
        db.get.side_effect = lambda model, _id: resume if model is MasterResume else None

        with (
            patch.object(main, "SessionLocal", return_value=db),
            patch.object(main, "extract_pdf_text") as extract_pdf_text,
        ):
            main.process_master_resume(uuid4(), b"old pdf", stale_upload_id)

        extract_pdf_text.assert_not_called()
        self.assertEqual(resume.status, "processing")

    def test_refund_is_idempotent(self):
        db = MagicMock()
        db.scalar.return_value = uuid4()
        current_user = SimpleNamespace(id=uuid4())

        main.refund_resume_coins(
            db,
            current_user,
            5,
            "Master resume upload refund",
            str(uuid4()),
        )

        db.add.assert_not_called()

    def test_current_published_version_cannot_be_deleted(self):
        resume = SimpleNamespace(
            id=uuid4(),
            published_version=3,
            draft_base_version=3,
            resume_data={"basics": {}},
            published_data={"basics": {}},
        )
        snapshot = SimpleNamespace(version=3)
        db = MagicMock()
        db.scalar.side_effect = [resume, snapshot]

        with self.assertRaises(main.HTTPException) as raised:
            main.delete_master_resume_version(3, db=db, current_user=SimpleNamespace(id=uuid4()))

        self.assertEqual(raised.exception.status_code, 409)
        db.delete.assert_not_called()

    def test_unused_published_version_can_be_deleted(self):
        resume = SimpleNamespace(
            id=uuid4(),
            published_version=3,
            draft_base_version=3,
            resume_data={"basics": {}},
            published_data={"basics": {}},
        )
        snapshot = SimpleNamespace(version=1)
        db = MagicMock()
        db.scalar.side_effect = [resume, snapshot]

        main.delete_master_resume_version(
            1,
            db=db,
            current_user=SimpleNamespace(id=uuid4()),
        )

        db.execute.assert_called_once()
        db.delete.assert_called_once_with(snapshot)
        db.commit.assert_called_once()

    def test_master_resume_without_profile_can_be_deleted(self):
        resume = SimpleNamespace(
            id=uuid4(),
            original_url="https://assets.example/current.pdf",
            original_storage_key="master-resumes/user/current.pdf",
        )
        db = MagicMock()
        db.scalar.side_effect = [resume, None]
        storage = MagicMock()

        with patch.object(main, "get_object_storage", return_value=storage):
            main.delete_master_resume(db=db, current_user=SimpleNamespace(id=uuid4()))

        storage.delete.assert_called_once_with(resume.original_storage_key)
        db.delete.assert_called_once_with(resume)
        db.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
