from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from services.api import main
from services.shared.schemas import UserSkillCreate


def test_add_user_skill_persists_plugin_skill_without_resume_data() -> None:
    db = MagicMock()
    db.scalar.side_effect = [
        SimpleNamespace(canonical_name="Git"),
        None,
    ]
    current_user = SimpleNamespace(id=uuid4())

    skill = main.add_user_skill(
        UserSkillCreate(skill_name=".GIT"),
        db=db,
        current_user=current_user,
    )

    assert skill.user_id == current_user.id
    assert skill.skill_name == "Git"
    assert skill.canonical_name == "git"
    assert skill.source == "plugin"
    assert skill.category == "Plugin Skills"
    db.add.assert_called_once_with(skill)
    db.commit.assert_called_once()


def test_delete_user_skill_only_targets_plugin_source() -> None:
    stored = SimpleNamespace(
        id=uuid4(),
        skill_name="Git",
        canonical_name="git",
        source="plugin",
    )
    db = MagicMock()
    db.scalar.side_effect = [SimpleNamespace(canonical_name="Git"), stored]

    result = main.delete_user_skill(
        skill_name="Git",
        db=db,
        current_user=SimpleNamespace(id=uuid4()),
    )

    assert result["success"] is True
    assert result["skill"]["canonical_name"] == "git"
    db.delete.assert_called_once_with(stored)
    db.commit.assert_called_once()
