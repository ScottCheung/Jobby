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
    "next": "next.js",
    "expressjs": "express",
    "rest": "rest",
    "restful": "rest",
    "apis": "api",
    "frontend": "frontend",
    "front-end": "frontend",
    "backend": "backend",
    "back-end": "backend",
    "fullstack": "fullstack",
    "full-stack": "fullstack",
    "devops": "devops",
}

TITLE_EQUIVALENCE_MAP: dict[str, str] = {
    "developer": "engineer",
    "programmer": "engineer",
    "specialist": "engineer",
    "architect": "architect",
    "consultant": "consultant",
}

# Domain taxonomy for role identification and domain matching
DOMAIN_TAXONOMY: dict[str, frozenset[str]] = {
    "frontend": frozenset({
        "frontend", "ui", "ux", "web", "react", "vue", "angular", "javascript",
        "typescript", "nextjs", "next", "svelte", "html", "css", "tailwind",
    }),
    "backend": frozenset({
        "backend", "api", "server", "python", "golang", "go", "java", "c#",
        "dotnet", "rust", "node", "nodejs", "fastapi", "django", "spring",
        "microservices", "sql", "postgresql", "database",
    }),
    "fullstack": frozenset({
        "fullstack", "full", "stack",
    }),
    "mobile": frozenset({
        "mobile", "ios", "android", "swift", "flutter", "react-native", "kotlin", "uikit",
    }),
    "devops": frozenset({
        "devops", "sre", "cloud", "infrastructure", "kubernetes", "k8s", "docker",
        "aws", "gcp", "azure", "terraform", "platform", "ci/cd", "pipeline",
    }),
    "data_ai": frozenset({
        "data", "ai", "ml", "analytics", "nlp", "llm", "deep", "bi", "scientist",
        "machine", "learning", "etl", "spark", "hadoop", "databricks", "algorithm",
    }),
    "qa": frozenset({
        "qa", "test", "testing", "quality", "automation", "sdet", "tester",
    }),
    "security": frozenset({
        "security", "cyber", "infosec", "appsec", "soc", "penetration",
    }),
    "product": frozenset({
        "product", "scrum", "agile", "project", "program", "owner",
    }),
    "embedded": frozenset({
        "embedded", "firmware", "iot", "hardware", "c++", "c", "rtos",
    }),
}

# Pairwise domain affinity matrix (default is 0.25 for unlisted pairs)
DOMAIN_AFFINITY: dict[tuple[str, str], float] = {
    ("frontend", "frontend"): 1.0,
    ("backend", "backend"): 1.0,
    ("fullstack", "fullstack"): 1.0,
    ("mobile", "mobile"): 1.0,
    ("devops", "devops"): 1.0,
    ("data_ai", "data_ai"): 1.0,
    ("qa", "qa"): 1.0,
    ("security", "security"): 1.0,
    ("product", "product"): 1.0,
    ("embedded", "embedded"): 1.0,
    # High affinity adjacent domains
    ("fullstack", "frontend"): 0.88,
    ("frontend", "fullstack"): 0.88,
    ("fullstack", "backend"): 0.88,
    ("backend", "fullstack"): 0.88,
    ("frontend", "mobile"): 0.50,
    ("mobile", "frontend"): 0.50,
    ("backend", "devops"): 0.75,
    ("devops", "backend"): 0.75,
    ("backend", "data_ai"): 0.65,
    ("data_ai", "backend"): 0.65,
    ("backend", "qa"): 0.60,
    ("qa", "backend"): 0.60,
    ("frontend", "qa"): 0.60,
    ("qa", "frontend"): 0.60,
    ("devops", "security"): 0.75,
    ("security", "devops"): 0.75,
}

