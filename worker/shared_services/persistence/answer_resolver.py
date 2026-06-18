import os

from shared_services.persistence.question_cache import QuestionCache, normalize_label, match_option_in_list
from shared_services.runtime import get_runtime_value
from shared_services.utils.helpers import print_lg


aiClient = None
full_name = ""
desired_salary = ""
desired_salary_lakhs = ""
desired_salary_monthly = ""
current_ctc = ""
current_ctc_lakhs = ""
current_ctc_monthly = ""
notice_period = ""
notice_period_months = ""
notice_period_weeks = ""


def answer_common_questions(label: str, answer: str) -> str:
    if "sponsorship" in label or "visa" in label:
        return str(get_runtime_value("require_visa", "No"))
    return answer


def resolve_custom_answer(label_org: str, field_type: str) -> str | None:
    label = normalize_label(label_org)
    for rule in list(get_runtime_value("custom_questions", []) or []):
        field_types = rule.get("field_types")
        if field_types and field_type not in field_types:
            continue

        exact_label = rule.get("label")
        if exact_label and normalize_label(exact_label) == label:
            return str(rule.get("answer", ""))

        keywords = rule.get("keywords", [])
        if keywords and any(kw.lower() in label for kw in keywords):
            return str(rule.get("answer", ""))
    return None


def resolve_keyword_answer(label_org: str, field_type: str, work_location: str) -> str | None:
    label = label_org.lower()

    if field_type == "file":
        if any(word in label for word in ["resume", "cv", "cover letter", "attachment", "upload"]):
            if "cover" in label:
                return ""
            return str(get_runtime_value("default_resume_path", ""))
        return None

    if field_type == "select":
        if any(word in label for word in ["resume", "resumé", "cv"]):
            default_resume_path = str(get_runtime_value("default_resume_path", ""))
            filename = os.path.basename(default_resume_path).strip()
            return filename or default_resume_path
        if "email" in label or "phone" in label:
            return None
        if "gender" in label or "sex" in label:
            return str(get_runtime_value("gender", ""))
        if "disability" in label:
            return str(get_runtime_value("disability_status", ""))
        if "proficiency" in label:
            return "Professional"
        if any(loc_word in label for loc_word in ["location", "city", "state", "country"]):
            if "country" in label:
                return str(get_runtime_value("country", ""))
            if "state" in label:
                return str(get_runtime_value("state", ""))
            if "city" in label:
                current_city = str(get_runtime_value("current_city", ""))
                return current_city if current_city else work_location
            return work_location
        return answer_common_questions(label, "Yes")

    if field_type == "radio":
        if "citizenship" in label or "employment eligibility" in label:
            return str(get_runtime_value("us_citizenship", ""))
        if "veteran" in label or "protected" in label:
            return str(get_runtime_value("veteran_status", ""))
        if "disability" in label or "handicapped" in label:
            return str(get_runtime_value("disability_status", ""))
        return answer_common_questions(label, "Yes")

    if field_type == "text":
        if "experience" in label or "years" in label:
            return str(get_runtime_value("years_of_experience", ""))
        if "phone" in label or "mobile" in label:
            return str(get_runtime_value("phone_number", ""))
        if "street" in label:
            return str(get_runtime_value("street", ""))
        if "city" in label or "location" in label or "address" in label:
            current_city = str(get_runtime_value("current_city", ""))
            return current_city if current_city else work_location
        if "signature" in label:
            return str(get_runtime_value("full_name", ""))
        if "name" in label:
            if "full" in label:
                return str(get_runtime_value("full_name", ""))
            if "first" in label and "last" not in label:
                return str(get_runtime_value("first_name", ""))
            if "middle" in label and "last" not in label:
                return str(get_runtime_value("middle_name", ""))
            if "last" in label and "first" not in label:
                return str(get_runtime_value("last_name", ""))
            if "employer" in label:
                return str(get_runtime_value("recent_employer", ""))
            return str(get_runtime_value("full_name", ""))
        if "notice" in label:
            if "month" in label:
                return str(get_runtime_value("notice_period_months", ""))
            if "week" in label:
                return str(get_runtime_value("notice_period_weeks", ""))
            return str(get_runtime_value("notice_period", ""))
        if "salary" in label or "compensation" in label or "ctc" in label or "pay" in label:
            if "current" in label or "present" in label:
                if "month" in label:
                    return str(get_runtime_value("current_ctc_monthly", ""))
                if "lakh" in label:
                    return str(get_runtime_value("current_ctc_lakhs", ""))
                return str(get_runtime_value("current_ctc", ""))
            if "month" in label:
                return str(get_runtime_value("desired_salary_monthly", ""))
            if "lakh" in label:
                return str(get_runtime_value("desired_salary_lakhs", ""))
            return str(get_runtime_value("desired_salary", ""))
        if "linkedin" in label:
            return str(get_runtime_value("linkedIn", ""))
        if "website" in label or "blog" in label or "portfolio" in label or "link" in label:
            return str(get_runtime_value("website", ""))
        if "scale of 1-10" in label:
            return str(get_runtime_value("confidence_level", ""))
        if "headline" in label:
            return str(get_runtime_value("linkedin_headline", ""))
        if ("hear" in label or "come across" in label) and "this" in label and ("job" in label or "position" in label):
            return "https://github.com/GodsScion/Auto_job_applier_linkedIn"
        if "state" in label or "province" in label:
            return str(get_runtime_value("state", ""))
        if "zip" in label or "postal" in label or "code" in label:
            return str(get_runtime_value("zipcode", ""))
        if "country" in label:
            return str(get_runtime_value("country", ""))
        return answer_common_questions(label, "")

    if field_type == "textarea":
        if "summary" in label:
            return str(get_runtime_value("linkedin_summary", ""))
        if "cover" in label:
            return str(get_runtime_value("cover_letter", ""))
        return ""

    return None


def resolve_ai_answer(
    label_org: str,
    field_type: str,
    job_description: str | None,
) -> str | None:
    if not bool(get_runtime_value("use_AI", False)) or not aiClient or field_type not in ("text", "textarea"):
        return None

    try:
        ai_provider = str(get_runtime_value("ai_provider", "openai")).lower()
        user_information_all = str(get_runtime_value("user_information_all", ""))
        if ai_provider == "openai":
            from shared_services.ai.openaiConnections import ai_answer_question
            answer = ai_answer_question(
                aiClient,
                label_org,
                question_type=field_type,
                job_description=job_description,
                user_information_all=user_information_all,
            )
        elif ai_provider == "deepseek":
            from shared_services.ai.deepseekConnections import deepseek_answer_question
            answer = deepseek_answer_question(
                aiClient,
                label_org,
                options=None,
                question_type=field_type,
                job_description=job_description,
                about_company=None,
                user_information_all=user_information_all,
            )
        elif ai_provider == "gemini":
            from shared_services.ai.geminiConnections import gemini_answer_question
            answer = gemini_answer_question(
                aiClient,
                label_org,
                options=None,
                question_type=field_type,
                job_description=job_description,
                about_company=None,
                user_information_all=user_information_all,
            )
        else:
            return None

        if answer and isinstance(answer, str) and answer.strip():
            print_lg(f'AI answered question "{label_org}": "{answer}"')
            return answer.strip()
    except Exception as e:
        print_lg("Failed to get AI answer!", e)
    return None


def resolve_answer(
    label_org: str,
    field_type: str,
    options: list[str] | None,
    work_location: str,
    question_cache: QuestionCache,
    job_description: str | None = None,
    prev_answer: str | None = None,
) -> tuple[str | None, str]:
    custom = resolve_custom_answer(label_org, field_type)
    if custom is not None and custom != "":
        if field_type in ("select", "radio") and options:
            matched = match_option_in_list(custom, options)
            if matched:
                print_lg(f'[custom] "{label_org}" -> "{matched}"')
                return matched, "custom"
        elif field_type not in ("select", "radio"):
            print_lg(f'[custom] "{label_org}" -> "{custom}"')
            return custom, "custom"

    cached = question_cache.find_answer(label_org, field_type, options)
    if cached:
        answer, _ = cached
        print_lg(f'[cache hit] "{label_org}" -> "{answer}"')
        return answer, "cache"

    keyword = resolve_keyword_answer(label_org, field_type, work_location)
    if keyword is not None and keyword != "":
        if field_type in ("select", "radio") and options:
            matched = match_option_in_list(keyword, options)
            if matched:
                print_lg(f'[keyword] "{label_org}" -> "{matched}"')
                return matched, "keyword"
        elif field_type not in ("select", "radio"):
            print_lg(f'[keyword] "{label_org}" -> "{keyword}"')
            return keyword, "keyword"

    if field_type in ("text", "textarea"):
        ai_answer = resolve_ai_answer(label_org, field_type, job_description)
        if ai_answer:
            print_lg(f'[ai] "{label_org}" -> "{ai_answer}"')
            return ai_answer, "ai"

    if prev_answer and str(prev_answer).strip() not in ("", "Select an option"):
        return str(prev_answer), "existing"

    return None, "unanswered"
