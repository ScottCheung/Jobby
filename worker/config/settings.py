import os


run_in_background = False
stealth_mode = False
disable_extensions = True
safe_mode = False
showAiErrorAlerts = False

click_gap = 0.6
smooth_scroll = False
close_tabs = True

use_api_data_layer = True
api_base_url = os.getenv("AUTO_JOB_API_BASE_URL", "http://127.0.0.1:8000")
api_timeout_seconds = int(os.getenv("AUTO_JOB_API_TIMEOUT_SECONDS", "30"))
question_similarity_threshold = 0.85

worker_root = os.path.dirname(os.path.dirname(__file__))
data_folder_path = os.path.join(worker_root, "data")
logs_folder_path = os.path.join(worker_root, "logs")
generated_resume_path = os.path.join(worker_root, "all resumes")

file_name = os.path.join(data_folder_path, "applications_history.json")
failed_file_name = os.path.join(data_folder_path, "failed.json")
question_cache_file = os.path.join(data_folder_path, "question_cache.json")
applications_json_file = os.path.join(data_folder_path, "applications_history.json")
