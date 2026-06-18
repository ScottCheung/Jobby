from typing import Literal

from openai import OpenAI
from pyautogui import confirm

from shared_services.ai.prompts import *
from shared_services.runtime import get_runtime_value
from shared_services.utils.helpers import convert_to_json, critical_error_log, print_lg


def deepseek_create_client() -> OpenAI | None:
    try:
        print_lg("Creating DeepSeek client...")
        if not bool(get_runtime_value("use_AI", False)):
            raise ValueError("AI is not enabled.")
        base_url = str(get_runtime_value("llm_api_url", "")).rstrip("/")
        llm_api_key = str(get_runtime_value("llm_api_key", ""))
        client = OpenAI(base_url=base_url, api_key=llm_api_key)
        print_lg("---- SUCCESSFULLY CREATED DEEPSEEK CLIENT! ----")
        return client
    except Exception as e:
        error_message = "Error occurred while creating DeepSeek client. Make sure your API connection details are correct."
        critical_error_log(error_message, e)
        if bool(get_runtime_value("showAiErrorAlerts", False)):
            confirm(f"{error_message}\n{str(e)}", "DeepSeek Connection Error", ["Pause AI error alerts", "Okay Continue"])
        return None


def deepseek_model_supports_temperature(model_name: str) -> bool:
    return model_name in ["deepseek-chat", "deepseek-reasoner"]


def deepseek_completion(client: OpenAI, messages: list[dict], response_format: dict = None, temperature: float = 0, stream: bool | None = None) -> dict | ValueError:
    if not client:
        raise ValueError("DeepSeek client is not available!")
    llm_model = str(get_runtime_value("llm_model", ""))
    if stream is None:
        stream = bool(get_runtime_value("stream_output", False))
    params = {"model": llm_model, "messages": messages, "stream": stream, "timeout": 30}
    if deepseek_model_supports_temperature(llm_model):
        params["temperature"] = temperature
    if response_format:
        params["response_format"] = response_format
    try:
        completion = client.chat.completions.create(**params)
        result = ""
        if stream:
            for chunk in completion:
                if chunk.model_extra and chunk.model_extra.get("error"):
                    raise ValueError(f'Error occurred with DeepSeek API: "{chunk.model_extra.get("error")}"')
                chunk_message = chunk.choices[0].delta.content
                if chunk_message is not None:
                    result += chunk_message
                print_lg(chunk_message, end="", flush=True)
        else:
            if completion.model_extra and completion.model_extra.get("error"):
                raise ValueError(f'Error occurred with DeepSeek API: "{completion.model_extra.get("error")}"')
            result = completion.choices[0].message.content
        if response_format:
            result = convert_to_json(result)
        return result
    except Exception as e:
        raise ValueError(f"DeepSeek API error: {str(e)}")


def deepseek_extract_skills(client: OpenAI, job_description: str, stream: bool | None = None) -> dict | ValueError:
    try:
        prompt = deepseek_extract_skills_prompt.format(job_description)
        messages = [{"role": "user", "content": prompt}]
        result = deepseek_completion(client=client, messages=messages, response_format={"type": "json_object"}, stream=stream)
        if isinstance(result, str):
            result = convert_to_json(result)
        return result
    except Exception as e:
        critical_error_log("Error occurred while extracting skills with DeepSeek!", e)
        return {"error": str(e)}


def deepseek_answer_question(
    client: OpenAI,
    question: str,
    options: list[str] | None = None,
    question_type: Literal["text", "textarea", "single_select", "multiple_select"] = "text",
    job_description: str = None,
    about_company: str = None,
    user_information_all: str = None,
    stream: bool | None = None,
) -> dict | ValueError:
    try:
        user_info = user_information_all or ""
        prompt = ai_answer_prompt.format(user_info, question)
        if options and question_type in ["single_select", "multiple_select"]:
            options_str = "OPTIONS:\n" + "\n".join([f"- {option}" for option in options])
            prompt += f"\n\n{options_str}"
        if job_description:
            prompt += f"\n\nJOB DESCRIPTION:\n{job_description}"
        if about_company:
            prompt += f"\n\nABOUT COMPANY:\n{about_company}"
        return deepseek_completion(client=client, messages=[{"role": "user", "content": prompt}], temperature=0.1, stream=stream)
    except Exception as e:
        critical_error_log("Error occurred while answering question with DeepSeek!", e)
        return {"error": str(e)}
