from typing import Literal

from openai import OpenAI
from openai.types.chat import ChatCompletion, ChatCompletionChunk
from openai.types.model import Model
from pyautogui import confirm

from shared_services.ai.prompts import *
from shared_services.runtime import get_runtime_value
from shared_services.utils.helpers import convert_to_json, critical_error_log, print_lg


apiCheckInstructions = "OpenAI API configuration could not be loaded from the worker API."


def ai_error_alert(message: str, stackTrace: str, title: str = "AI Connection Error") -> None:
    if bool(get_runtime_value("showAiErrorAlerts", False)):
        confirm(f"{message}{stackTrace}\n", title, ["Pause AI error alerts", "Okay Continue"])
    critical_error_log(message, stackTrace)


def ai_check_error(response: ChatCompletion | ChatCompletionChunk) -> None:
    if response.model_extra.get("error"):
        raise ValueError(f'Error occurred with API: "{response.model_extra.get("error")}"')


def ai_create_openai_client() -> OpenAI:
    try:
        print_lg("Creating OpenAI client...")
        if not bool(get_runtime_value("use_AI", False)):
            raise ValueError("AI is not enabled.")
        client = OpenAI(
            base_url=str(get_runtime_value("llm_api_url", "")),
            api_key=str(get_runtime_value("llm_api_key", "")),
        )
        models = ai_get_models_list(client)
        if "error" in models:
            raise ValueError(models[1])
        if str(get_runtime_value("llm_model", "")) not in [model.id for model in models]:
            raise ValueError("Model not found.")
        print_lg("---- SUCCESSFULLY CREATED OPENAI CLIENT! ----")
        return client
    except Exception as e:
        ai_error_alert(f"Error occurred while creating OpenAI client. {apiCheckInstructions}", e)


def ai_close_openai_client(client: OpenAI) -> None:
    try:
        if client:
            client.close()
    except Exception as e:
        ai_error_alert("Error occurred while closing OpenAI client.", e)


def ai_get_models_list(client: OpenAI) -> list[Model | str]:
    try:
        if not client:
            raise ValueError("Client is not available!")
        models = client.models.list()
        ai_check_error(models)
        return models.data
    except Exception as e:
        critical_error_log("Error occurred while getting models list!", e)
        return ["error", e]


def model_supports_temperature(model_name: str) -> bool:
    return model_name in ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini"]


def ai_completion(client: OpenAI, messages: list[dict], response_format: dict = None, temperature: float = 0, stream: bool | None = None) -> dict | ValueError:
    if not client:
        raise ValueError("Client is not available!")
    llm_model = str(get_runtime_value("llm_model", ""))
    if stream is None:
        stream = bool(get_runtime_value("stream_output", False))
    params = {"model": llm_model, "messages": messages, "stream": stream}
    if model_supports_temperature(llm_model):
        params["temperature"] = temperature
    if response_format and str(get_runtime_value("llm_spec", "openai")) in ["openai", "openai-like"]:
        params["response_format"] = response_format
    completion = client.chat.completions.create(**params)
    result = ""
    if stream:
        for chunk in completion:
            ai_check_error(chunk)
            chunkMessage = chunk.choices[0].delta.content
            if chunkMessage is not None:
                result += chunkMessage
            print_lg(chunkMessage, end="", flush=True)
    else:
        ai_check_error(completion)
        result = completion.choices[0].message.content
    if response_format:
        result = convert_to_json(result)
    return result


def ai_extract_skills(client: OpenAI, job_description: str, stream: bool | None = None) -> dict | ValueError:
    prompt = extract_skills_prompt.format(job_description)
    return ai_completion(client, [{"role": "user", "content": prompt}], response_format=extract_skills_response_format, stream=stream)


def ai_answer_question(
    client: OpenAI,
    question: str,
    options: list[str] | None = None,
    question_type: Literal["text", "textarea", "single_select", "multiple_select"] = "text",
    job_description: str = None,
    about_company: str = None,
    user_information_all: str = None,
    stream: bool | None = None,
) -> dict | ValueError:
    prompt = ai_answer_prompt.format(user_information_all or "N/A", question)
    if job_description and job_description != "Unknown":
        prompt += f"\nJob Description:\n{job_description}"
    if about_company and about_company != "Unknown":
        prompt += f"\nAbout the Company:\n{about_company}"
    return ai_completion(client, [{"role": "user", "content": prompt}], stream=stream)
