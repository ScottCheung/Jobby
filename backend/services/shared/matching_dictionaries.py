"""Dictionary mappings and stopwords for skill normalization in job matching."""

from __future__ import annotations

RECRUITMENT_STOPWORDS: frozenset[str] = frozenset(
    {
        "opportunity", "candidate", "candidates", "successful",
        "business", "solutions", "environment", "working", "looking", "seeking",
        "qualified", "joining", "member", "company", "culture", "equal",
        "employer", "workplace", "location", "hybrid", "onsite", "full-time", "part-time",
        "must", "should", "ideal", "drive", "impact", "help",
    }
)

CANONICAL_ALIAS_MAP: dict[str, str] = {
    "reactjs": "react",
    "react.js": "react",
    "vuejs": "vue",
    "vue.js": "vue",
    "golang": "go",
    "k8s": "kubernetes",
    "aws": "aws",
    "gcp": "gcp",
    "azure": "azure",
    "nodejs": "node",
    "node.js": "node",
    "ts": "typescript",
    "js": "javascript",
    "py": "python",
    "postgres": "postgresql",
    "postgresql": "postgresql",
    "mongo": "mongodb",
    "nextjs": "next",
    "next.js": "next",
    "expressjs": "express",
}
