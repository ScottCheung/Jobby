# python3 scripts/import_bulk_skills.py --file ../worker/data/skills/test_bulk_skills.json
import argparse
import json
import re
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.orm import Session

from services.shared.database import SessionLocal
from services.shared.models import Skill


def clean_text(value: object | None) -> str | None:
    text = str(value or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text or None


def normalize_key(value: str) -> str:
    text = clean_text(value) or ""
    return re.sub(r"\s+", " ", text).strip().lower()


def import_flat_skills(db: Session, json_path: Path) -> None:
    if not json_path.exists():
        print(f"Error: JSON file not found at {json_path}")
        return

    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Error: Failed to parse JSON file: {e}")
        return

    if not isinstance(data, dict):
        print("Error: JSON file must contain a flat key-value dictionary.")
        return

    added_count = 0
    updated_count = 0
    seen_names = set()

    for key, val in data.items():
        name_key = normalize_key(key)
        canonical = clean_text(val)
        if not name_key or not canonical:
            continue

        if name_key in seen_names:
            continue
        seen_names.add(name_key)

        # Rule: if normalized search key matches normalized canonical value, it is not an alias
        is_alias = (name_key != canonical.lower())

        existing = db.scalar(select(Skill).where(Skill.name == name_key))
        if existing:
            # Update if anything changed
            if existing.canonical_name != canonical or existing.is_alias != is_alias:
                existing.canonical_name = canonical
                existing.is_alias = is_alias
                updated_count += 1
        else:
            new_skill = Skill(
                name=name_key,
                canonical_name=canonical,
                is_alias=is_alias
            )
            db.add(new_skill)
            added_count += 1

    db.commit()
    print(f"Bulk import completed from {json_path.name}:")
    print(f"  - Added: {added_count} skills")
    print(f"  - Updated: {updated_count} skills")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bulk import flat JSON dictionary skills data into PostgreSQL database."
    )
    parser.add_argument(
        "--file", "-f",
        required=True,
        help="Path to the JSON file containing the flat dictionary {key: value} mapping."
    )
    args = parser.parse_args()

    json_path = Path(args.file)
    with SessionLocal() as db:
        import_flat_skills(db, json_path)


if __name__ == "__main__":
    main()
