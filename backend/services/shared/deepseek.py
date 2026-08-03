import json
import logging
import re

import httpx

from services.shared.settings import get_settings


logger = logging.getLogger(__name__)


class DeepSeekError(Exception):
    pass


def sanitize_ai_output(value):
    if isinstance(value, str):
        return value.replace("DeepSeek", "AI").replace("deepseek", "AI")
    if isinstance(value, list):
        return [sanitize_ai_output(item) for item in value]
    if isinstance(value, dict):
        return {key: sanitize_ai_output(item) for key, item in value.items()}
    return value


def _extract_json_payload(content: object) -> dict:
    if isinstance(content, dict):
        return sanitize_ai_output(content)
    if not isinstance(content, str):
        raise ValueError("AI returned a non-text response")

    text = content.strip()
    if not text:
        raise ValueError("AI returned an empty response")

    candidates = [text]
    fenced_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fenced_match:
        candidates.append(fenced_match.group(1))

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidates.append(text[start : end + 1])

    for candidate in candidates:
        try:
            return sanitize_ai_output(json.loads(candidate))
        except (ValueError, TypeError):
            continue

    raise ValueError("AI response did not contain valid JSON")


def _complete(
    messages: list[dict[str, str]],
    temperature: float = 0.35,
    operation: str = "generic",
    timeout: float = 45.0,
) -> dict:
    settings = get_settings()
    if not settings.deepseek_api_key:
        raise DeepSeekError("AI is not configured")
    try:
        response = httpx.post(
            f"{settings.deepseek_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.deepseek_api_key}"},
            json={
                "model": settings.deepseek_model,
                "messages": messages,
                "response_format": {"type": "json_object"},
                "temperature": temperature,
            },
            timeout=timeout,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("AI returned a non-object response")
        usage = payload.get("usage")
        if isinstance(usage, dict):
            logger.info(
                "AI token usage operation=%s model=%s prompt=%s completion=%s total=%s cache_hit=%s cache_miss=%s",
                operation,
                settings.deepseek_model,
                usage.get("prompt_tokens"),
                usage.get("completion_tokens"),
                usage.get("total_tokens"),
                usage.get("prompt_cache_hit_tokens"),
                usage.get("prompt_cache_miss_tokens"),
            )
        content = payload["choices"][0]["message"]["content"]
        return _extract_json_payload(content)
    except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError) as exc:
        raise DeepSeekError("AI could not produce a valid response") from exc


def _normalize_question_metadata(raw_metadata) -> dict:
    if isinstance(raw_metadata, dict):
        nested = raw_metadata.get("question_metadata")
        if isinstance(nested, dict):
            raw_metadata = nested
    raw_metadata = raw_metadata if isinstance(raw_metadata, dict) else {}
    raw_tags = raw_metadata.get("tags", [])
    tags = (
        [str(tag).strip()[:50] for tag in raw_tags[:3] if str(tag).strip()]
        if isinstance(raw_tags, list)
        else []
    )
    try:
        importance_score = max(1, min(5, int(raw_metadata.get("importance_score", 3))))
    except (TypeError, ValueError):
        importance_score = 3
    difficulty = str(raw_metadata.get("difficulty", "medium")).strip().lower()
    if difficulty not in {"easy", "medium", "hard"}:
        difficulty = "medium"
    frequency = str(raw_metadata.get("frequency", "medium")).strip().lower()
    if frequency not in {"low", "medium", "high"}:
        frequency = "medium"
    try:
        estimated_duration = max(30, min(300, int(raw_metadata.get("estimated_duration", 90))))
    except (TypeError, ValueError):
        estimated_duration = 90
    return {
        "tags": list(dict.fromkeys(tags)),
        "importance_score": importance_score,
        "difficulty": difficulty,
        "frequency": frequency.title(),
        "estimated_duration": estimated_duration,
    }


def generate_question_metadata(question: str, question_type: str | None = None) -> dict:
    result = _complete([
        {
            "role": "system",
            "content": (
                "You classify interview questions for candidate practice. Return JSON ONLY, no prose or markdown fences. "
                "Return exactly this schema: {\"tags\": [string], \"importance_score\": int, \"difficulty\": string, \"frequency\": string, \"estimated_duration\": int}. "
                "Tags: 0 to 3 short, reusable concrete topics or skills; never use question type, difficulty, priority, or company as a tag. "
                "importance_score is 1 to 5, where 1 is niche or low-signal, 3 is normal, and 5 is core interview value. "
                "difficulty is one of easy, medium, hard. frequency is one of low, medium, high. estimated_duration is spoken seconds from 30 to 180. "
                "This metadata is used to fill missing details safely, so prefer broadly useful defaults over aggressive guesses."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Interview question type: {question_type or 'General'}\n"
                f"Interview question: {question}"
            ),
        },
    ])
    return _normalize_question_metadata(result)


def generate_reference_answer(
    question: str,
    question_type: str | None = None,
    include_question_metadata: bool = False,
) -> dict:
    question_metadata_schema = ""
    question_metadata_rules = ""
    if include_question_metadata:
        question_metadata_schema = (
            "  \"question_metadata\": {\n"
            "    \"tags\": [string],          // 0 to 3 concise topic or skill tags\n"
            "    \"importance_score\": int,    // 1 to 5: interview value for the stated question type\n"
            "    \"difficulty\": string,       // ONE of: easy | medium | hard\n"
            "    \"estimated_duration\": int   // spoken seconds, roughly 30 to 180\n"
            "  },\n"
        )
        question_metadata_rules = (
            "Question metadata rules:\n"
            "- Tags describe concrete topics or skills in the question, not its question type, difficulty, priority, or company.\n"
            "- Use at most 3 short, reusable tags; an empty tag list is allowed when no tag is useful.\n"
            "- Importance 1 means niche or low-signal; 3 means a normal interview signal; 5 means a core, high-signal question.\n"
        )

    result = _complete([
        {
            "role": "system",
            "content": (
                "You are a senior interview coach specialising in concise, high-signal answers. "
                "The answers must be industry-agnostic and universally applicable unless the question clearly requires technical detail. "
                "Return JSON ONLY, no prose, no markdown fences. "
                "The JSON must exactly conform to this schema:\n"
                "{\n"
                "  \"title\": string,                // short answer headline\n"
                "  \"template_type\": string,       // ONE of: professional_solution | story | personal_profile | motivation_fit\n"
                "  \"length\": string,              // ONE of: short | medium | long\n"
                "  \"one_line_strategy\": string,   // one sentence describing the best answer direction\n"
                "  \"summary\": string,             // one sentence: what a strong answer must accomplish\n"
                "  \"core_keywords\": [string],     // 3 to 5 keywords or short phrases for fast review\n"
                "  \"sections\": [\n"
                "    {\n"
                "      \"key\": string,              // stable snake_case identifier\n"
                "      \"heading\": string,          // short display title\n"
                "      \"content\": [string]         // 1 to 3 concise bullets for this section\n"
                "    }\n"
                "  ],\n"
                "  \"common_mistakes\": [string]" + (",\n" if include_question_metadata else "\n") +
                question_metadata_schema +
                "}\n"
                "Template guidance:\n"
                "- professional_solution: Concept, Principle, Method, Trade-off, Validation.\n"
                "- story: Situation, Task, Action, Result, Reflection.\n"
                "- personal_profile: Who you are, What shaped you, What you are good at, Why that matters.\n"
                "- motivation_fit: Why this role/company, What matches, What you bring, Close positively.\n"
                "Length guidance:\n"
                "- short: simple concept or explanation questions, 2 sections, minimal detail.\n"
                "- medium: normal interview questions, 3 sections.\n"
                "- long: behavioral or experience-heavy questions, 4 sections maximum.\n"
                "Rules:\n"
                "- Keep output concise and candidate-friendly.\n"
                "- Prefer short, speakable bullets over long paragraphs.\n"
                "- Do not add extra fields.\n"
                "- Do not generate a long answer when the question is a simple concept or definition question.\n"
                "- If the question is simple, choose short and keep sections minimal.\n"
                "- If the question asks for a story, use the story template rather than forcing every answer into the same pattern.\n" +
                question_metadata_rules
            ),
        },
        {
            "role": "user",
            "content": (
                f"Interview question type: {question_type or 'General'}\n"
                f"Interview question: {question}"
            ),
        },
    ])

    title = str(result.get("title", "AI Reference Answer")).strip()[:255]

    template_type = str(result.get("template_type", "professional_solution")).strip().lower()
    if template_type not in {"professional_solution", "story", "personal_profile", "motivation_fit"}:
        template_type = "professional_solution"

    summary = str(result.get("summary", "")).strip()

    one_line_strategy = str(result.get("one_line_strategy", "")).strip()

    length = str(result.get("length", "medium")).strip().lower()
    if length not in {"short", "medium", "long"}:
        length = "medium"

    raw_sections = result.get("sections", [])
    sections = []
    if isinstance(raw_sections, list):
        max_sections = {"short": 3, "medium": 3, "long": 4}.get(length, 3)
        for idx, item in enumerate(raw_sections[:max_sections]):
            if not isinstance(item, dict):
                continue
            content = item.get("content", [])
            if isinstance(content, str):
                content = [content]
            if not isinstance(content, list):
                continue
            bullets = [str(b).strip() for b in content[:3] if str(b).strip()]
            if not bullets:
                continue
            raw_heading = item.get("heading") or item.get("title") or item.get("name") or item.get("key") or f"Point {idx + 1}"
            heading = str(raw_heading).strip()

            section: dict = {
                "key": str(item.get("key", "point")).strip()[:40],
                "heading": heading[:80],
                "content": bullets,
            }
            sections.append(section)

    if not sections:
        raise DeepSeekError("AI returned an empty reference answer")

    raw_phrases = result.get("core_keywords", [])
    core_keywords = [str(p).strip() for p in raw_phrases[:5] if str(p).strip()][:5] if isinstance(raw_phrases, list) else []

    raw_mistakes = result.get("common_mistakes", [])
    common_mistakes = [str(m).strip() for m in raw_mistakes[:3] if str(m).strip()][:3] if isinstance(raw_mistakes, list) else []

    body = "\n\n".join(
        f"{s['heading']}\n" + "\n".join(f"- {b}" for b in s["content"])
        for s in sections
    )

    content_blob: dict = {
        "template_type": template_type,
        "length": length,
        "one_line_strategy": one_line_strategy,
        "summary": summary,
        "sections": sections,
        "core_keywords": core_keywords,
        "common_mistakes": common_mistakes,
    }

    response = {
        "title": title or "AI Reference Answer",
        "body": body,
        "content": content_blob,
    }
    if include_question_metadata:
        response["question_metadata"] = _normalize_question_metadata(
            result.get("question_metadata", {})
        )
        # Keep the first answer self-contained while the frontend transitions to question-level metadata.
        content_blob.update({
            "difficulty": response["question_metadata"]["difficulty"],
            "estimated_duration": response["question_metadata"]["estimated_duration"],
        })
    return response


def evaluate_practice_answer(question: str, answer: str) -> dict:
    result = _complete([
        {
            "role": "system",
            "content": (
                "You are a practical interview coach. Evaluate the candidate's answer strictly, but make the feedback useful enough "
                "that the candidate knows exactly what to change in the next attempt. Return JSON ONLY. Write feedback in Chinese "
                "unless the candidate's answer is not Chinese and Chinese would be confusing.\n"
                "Schema:\n"
                "{\n"
                '  "overall_score": int (0-100),\n'
                '  "dimensions": [\n'
                '    {"name": "切题度", "score": int (0-100), "feedback": "why this score, <= 32 Chinese chars", "evidence": "specific cue from answer, <= 40 Chinese chars", "fix": "concrete next change, <= 48 Chinese chars"},\n'
                '    {"name": "结构完整度", "score": int (0-100), "feedback": "why this score", "evidence": "specific cue from answer", "fix": "concrete next change"},\n'
                '    {"name": "内容深度", "score": int (0-100), "feedback": "why this score", "evidence": "specific cue from answer", "fix": "concrete next change"},\n'
                '    {"name": "表达流畅度", "score": int (0-100), "feedback": "pace/clarity/filler/logic flow", "evidence": "specific cue from answer", "fix": "concrete speaking improvement"}\n'
                '  ],\n'
                '  "score_basis": [string (2-3 bullets explaining the score, <= 36 Chinese chars each)],\n'
                '  "strengths": [string (max 2 concrete points, <= 28 Chinese chars each)],\n'
                '  "gaps": [string (max 2 concrete weaknesses, <= 32 Chinese chars each)],\n'
                '  "next_steps": [string (2-3 specific actions for the next practice, <= 42 Chinese chars each)],\n'
                '  "polished_answer": string (improved interview answer preserving the candidate intent, 80-140 words),\n'
                '  "gold_rewrite": string (1 gold-standard answer sentence showing how to refine this answer, <= 40 words)\n'
                "}"
            ),
        },
        {
            "role": "user",
            "content": f"Interview Question: {question}\nCandidate Answer: {answer}",
        },
    ])
    try:
        score = int(result["overall_score"])
    except (KeyError, TypeError, ValueError) as exc:
        raise DeepSeekError("DeepSeek returned an invalid evaluation") from exc
    result["overall_score"] = max(0, min(100, score))
    for key in ("dimensions", "score_basis", "strengths", "gaps", "next_steps"):
        if not isinstance(result.get(key), list):
            result[key] = []
    for key in ("gold_rewrite", "polished_answer"):
        if not isinstance(result.get(key), str):
            result[key] = ""
    return result
