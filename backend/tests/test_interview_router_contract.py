import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from services.api.routers import interview
from services.api.routers.interview import (
    collections,
    community,
    gamification,
    helpers,
    practice,
    questions,
)


class InterviewRouterModularContractTests(unittest.TestCase):
    def test_router_package_contract_and_prefix(self):
        self.assertEqual(interview.router.prefix, "/api/interview")
        self.assertEqual(len(interview.router.routes), 93)

    def test_subrouters_route_counts(self):
        self.assertEqual(len(questions.router.routes), 15)
        self.assertEqual(len(practice.router.routes), 14)
        self.assertEqual(len(collections.router.routes), 10)
        self.assertEqual(len(gamification.router.routes), 15)
        self.assertEqual(len(community.router.routes), 39)

    def test_application_gamification_snapshot(self):
        app = SimpleNamespace(status="applied", pipeline_stage="interview")
        snapshot = interview.application_gamification_snapshot(app)
        self.assertEqual(snapshot, {"status": "applied", "pipeline_stage": "interview"})
        self.assertIsNone(interview.application_gamification_snapshot(None))

    def test_category_helpers_normalization(self):
        self.assertEqual(helpers.clean_category_name("  behaviour  "), "Behaviour")
        self.assertEqual(helpers.clean_category_name("company"), "Company")
        self.assertEqual(helpers.slugify_category("Role Specific"), "role_specific")

        metadata = helpers.category_metadata_for_name("Project")
        self.assertEqual(metadata["display_name"], "Project")
        self.assertEqual(metadata["slug"], "project")
        self.assertTrue(metadata["is_system"])


if __name__ == "__main__":
    unittest.main()
