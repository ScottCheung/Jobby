import google.generativeai as genai
from pyautogui import confirm
from typing import Literal

from shared_services.ai.prompts import *
from shared_services.runtime import get_runtime_value
from shared_services.utils.helpers import print_lg, critical_error_log, convert_to_json


def gemini_get_models_list():
    try:
        print_lg("Getting Gemini models list...")
        models = [m.name for m in genai.list_models() if "generateContent" in m.supported_generation_methods]
        print_lg("Available models:")
        for model in models:
            print_lg(f"- {model}")
        return models
    except Exception as e:
        critical_error_log("Error occurred while getting Gemini models list!", e)
        return ["error", e]


def gemini_create_client():
    try:
        print_lg("Configuring Gemini client...")
        llm_api_key = str(get_runtime_value("llm_api_key", ""))
        llm_model = str(get_runtime_value("llm_model", ""))
        if not llm_api_key or "YOUR_API_KEY" in llm_api_key:
            raise ValueError("Gemini API key is not set.")

        genai.configure(api_key=llm_api_key)
        models = gemini_get_models_list()
        if "error" in models:
            raise ValueError(models[1])
        if not any(llm_model in m for m in models):
            raise ValueError(f"Model `{llm_model}` is not found or not available for content generation!")

        model = genai.GenerativeModel(llm_model)
        print_lg("---- SUCCESSFULLY CONFIGURED GEMINI CLIENT! ----")
        print_lg(f"Using Model: {llm_model}")
        print_lg("---------------------------------------------")
        return model
    except Exception as e:
        error_message = "Error occurred while configuring Gemini client. Make sure your API key and model name are correct."
        critical_error_log(error_message, e)
        if bool(get_runtime_value("showAiErrorAlerts", False)):
            confirm(f"{error_message}\n{str(e)}", "Gemini Connection Error", ["Pause AI error alerts", "Okay Continue"])
        return None


def gemini_completion(model, prompt: str, is_json: bool = False) -> dict | str:
    if not model:
        raise ValueError("Gemini client is not available!")

    try:
        safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
        print_lg("Calling Gemini API for completion...")
        response = model.generate_content(prompt, safety_settings=safety_settings)
        if not response.parts:
            raise ValueError("The response from the Gemini API was empty.")
        result = response.text
        if is_json:
            if result.startswith("```json"):
                result = result[7:]
            if result.endswith("```"):
                result = result[:-3]
            return convert_to_json(result)
        return result
    except Exception as e:
        critical_error_log("Error occurred while getting Gemini completion!", e)
        return {"error": str(e)}


def gemini_extract_skills(model, job_description: str) -> list[str] | None:
    try:
        print_lg("Extracting skills from job description using Gemini...")
        prompt = extract_skills_prompt.format(job_description) + "\n\nImportant: Respond with only the JSON object, without any markdown formatting or other text."
        return gemini_completion(model, prompt, is_json=True)
    except Exception as e:
        critical_error_log("Error occurred while extracting skills with Gemini!", e)
        return {"error": str(e)}


def gemini_answer_question(
    model,
    question: str,
    options: list[str] | None = None,
    question_type: Literal["text", "textarea", "single_select", "multiple_select"] = "text",
    job_description: str = None,
    about_company: str = None,
    user_information_all: str = None,
) -> str:
    try:
        print_lg(f"Answering question using Gemini AI: {question}")
        user_info = user_information_all or ""
        prompt = ai_answer_prompt.format(user_info, question)

        if options and question_type in ["single_select", "multiple_select"]:
            options_str = "OPTIONS:\n" + "\n".join([f"- {option}" for option in options])
            prompt += f"\n\n{options_str}"
        if job_description:
            prompt += f"\n\nJOB DESCRIPTION:\n{job_description}"
        if about_company:
            prompt += f"\n\nABOUT COMPANY:\n{about_company}"

        return gemini_completion(model, prompt)
    except Exception as e:
        critical_error_log("Error occurred while answering question with Gemini!", e)
        return {"error": str(e)}
