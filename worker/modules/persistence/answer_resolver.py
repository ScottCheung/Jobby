import os

from config.custom_questions import custom_questions
from config.personals import (
    country,
    current_city,
    disability_status,
    first_name,
    gender,
    last_name,
    middle_name,
    phone_number,
    state,
    street,
    veteran_status,
    zipcode,
)
from config.questions import (
    confidence_level,
    cover_letter,
    default_resume_path,
    linkedIn,
    linkedin_headline,
    linkedin_summary,
    recent_employer,
    require_visa,
    us_citizenship,
    user_information_all,
    website,
    years_of_experience,
)
from config.secrets import ai_provider, use_AI
from modules.persistence.question_cache import QuestionCache, normalize_label, match_option_in_list
from modules.helpers import print_lg

# Set at runtime from runAiBot.py
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
        return require_visa
    return answer


def resolve_custom_answer(label_org: str, field_type: str) -> str | None:
    label = normalize_label(label_org)
    for rule in custom_questions:
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
            return default_resume_path
        return None

    if field_type == "select":
        if any(word in label for word in ["resume", "resumé", "cv"]):
            filename = os.path.basename(default_resume_path or "").strip()
            if filename:
                return filename
            return default_resume_path
        if "email" in label or "phone" in label:
            return None
        if "gender" in label or "sex" in label:
            return gender
        if "disability" in label:
            return disability_status
        if "proficiency" in label:
            return "Professional"
        if any(loc_word in label for loc_word in ["location", "city", "state", "country"]):
            if "country" in label:
                return country
            if "state" in label:
                return state
            if "city" in label:
                return current_city if current_city else work_location
            return work_location
        return answer_common_questions(label, "Yes")

    if field_type == "radio":
        if "citizenship" in label or "employment eligibility" in label:
            return us_citizenship
        if "veteran" in label or "protected" in label:
            return veteran_status
        if "disability" in label or "handicapped" in label:
            return disability_status
        return answer_common_questions(label, "Yes")

    if field_type == "text":
        if "experience" in label or "years" in label:
            return years_of_experience
        if "phone" in label or "mobile" in label:
            return phone_number
        if "street" in label:
            return street
        if "city" in label or "location" in label or "address" in label:
            return current_city if current_city else work_location
        if "signature" in label:
            return full_name
        if "name" in label:
            if "full" in label:
                return full_name
            if "first" in label and "last" not in label:
                return first_name
            if "middle" in label and "last" not in label:
                return middle_name
            if "last" in label and "first" not in label:
                return last_name
            if "employer" in label:
                return recent_employer
            return full_name
        if "notice" in label:
            if "month" in label:
                return notice_period_months
            if "week" in label:
                return notice_period_weeks
            return notice_period
        if "salary" in label or "compensation" in label or "ctc" in label or "pay" in label:
            if "current" in label or "present" in label:
                if "month" in label:
                    return current_ctc_monthly
                if "lakh" in label:
                    return current_ctc_lakhs
                return current_ctc
            if "month" in label:
                return desired_salary_monthly
            if "lakh" in label:
                return desired_salary_lakhs
            return desired_salary
        if "linkedin" in label:
            return linkedIn
        if "website" in label or "blog" in label or "portfolio" in label or "link" in label:
            return website
        if "scale of 1-10" in label:
            return confidence_level
        if "headline" in label:
            return linkedin_headline
        if ("hear" in label or "come across" in label) and "this" in label and ("job" in label or "position" in label):
            return "https://github.com/GodsScion/Auto_job_applier_linkedIn"
        if "state" in label or "province" in label:
            return state
        if "zip" in label or "postal" in label or "code" in label:
            return zipcode
        if "country" in label:
            return country
        return answer_common_questions(label, "")

    if field_type == "textarea":
        if "summary" in label:
            return linkedin_summary
        if "cover" in label:
            return cover_letter
        return ""

    return None


def resolve_ai_answer(
    label_org: str,
    field_type: str,
    job_description: str | None,
) -> str | None:
    if not use_AI or not aiClient or field_type not in ("text", "textarea"):
        return None

    try:
        if ai_provider.lower() == "openai":
            from modules.ai.openaiConnections import ai_answer_question
            answer = ai_answer_question(
                aiClient,
                label_org,
                question_type=field_type,
                job_description=job_description,
                user_information_all=user_information_all,
            )
        elif ai_provider.lower() == "deepseek":
            from modules.ai.deepseekConnections import deepseek_answer_question
            answer = deepseek_answer_question(
                aiClient,
                label_org,
                options=None,
                question_type=field_type,
                job_description=job_description,
                about_company=None,
                user_information_all=user_information_all,
            )
        elif ai_provider.lower() == "gemini":
            from modules.ai.geminiConnections import gemini_answer_question
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
