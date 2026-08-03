from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from urllib.parse import urlparse


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


class AppSettings(BaseSettings):
    # The extension receives the web app's public Supabase configuration at
    # build time. Load that same local development source here so the API can
    # verify its Bearer tokens; deployment environment variables still win.
    model_config = SettingsConfigDict(
        env_file=[
            REPOSITORY_ROOT / ".env",
            REPOSITORY_ROOT / "Apps" / "user" / ".env.local",
        ],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(
        default="postgresql+psycopg://auto_job:auto_job_password@localhost:55432/auto_job_applier",
        alias="DATABASE_URL",
    )
    api_host: str = Field(default="127.0.0.1", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    api_reload: bool = Field(default=False, alias="API_RELOAD")
    api_cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001",
        alias="API_CORS_ORIGINS",
    )
    default_admin_email: str = Field(default="scott5443003@gmail.com", alias="DEFAULT_ADMIN_EMAIL")
    default_admin_name: str = Field(default="Scott Admin", alias="DEFAULT_ADMIN_NAME")
    admin_emails: str = Field(default="scott5443003@gmail.com", alias="ADMIN_EMAILS")
    enable_api_local_worker: bool = Field(default=False, alias="ENABLE_API_LOCAL_WORKER")
    storage_provider: str = Field(default="s3", alias="STORAGE_PROVIDER")
    storage_bucket: str = Field(default="jobby-assets", alias="STORAGE_BUCKET")
    storage_public_base_url: str | None = Field(default=None, alias="STORAGE_PUBLIC_BASE_URL")
    storage_s3_endpoint: str | None = Field(default=None, alias="STORAGE_S3_ENDPOINT")
    storage_s3_region: str = Field(default="us-east-1", alias="STORAGE_S3_REGION")
    storage_s3_access_key_id: str | None = Field(default=None, alias="STORAGE_S3_ACCESS_KEY_ID")
    storage_s3_secret_access_key: str | None = Field(default=None, alias="STORAGE_S3_SECRET_ACCESS_KEY")
    supabase_url: str | None = Field(default=None, alias="SUPABASE_URL")
    supabase_anon_key: str | None = Field(default=None, alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: str | None = Field(default=None, alias="SUPABASE_SERVICE_ROLE_KEY")
    next_public_supabase_url: str | None = Field(default=None, alias="NEXT_PUBLIC_SUPABASE_URL")
    next_public_supabase_anon_key: str | None = Field(default=None, alias="NEXT_PUBLIC_SUPABASE_ANON_KEY")
    image_max_edge: int = Field(default=1280, alias="IMAGE_MAX_EDGE")
    image_webp_quality: int = Field(default=70, alias="IMAGE_WEBP_QUALITY")
    image_upload_max_bytes: int = Field(default=12 * 1024 * 1024, alias="IMAGE_UPLOAD_MAX_BYTES")
    resume_upload_max_bytes: int = Field(default=12 * 1024 * 1024, alias="RESUME_UPLOAD_MAX_BYTES")
    resume_debug_enabled: bool = Field(default=False, alias="RESUME_DEBUG_ENABLED")
    audio_upload_max_bytes: int = Field(default=8 * 1024 * 1024, alias="AUDIO_UPLOAD_MAX_BYTES")
    speech_to_text_enabled: bool = Field(default=True, alias="SPEECH_TO_TEXT_ENABLED")
    speech_to_text_model: str = Field(default="small.en", alias="SPEECH_TO_TEXT_MODEL")
    speech_to_text_device: str = Field(default="auto", alias="SPEECH_TO_TEXT_DEVICE")
    speech_to_text_compute_type: str = Field(default="int8", alias="SPEECH_TO_TEXT_COMPUTE_TYPE")
    speech_to_text_beam_size: int = Field(default=3, alias="SPEECH_TO_TEXT_BEAM_SIZE")
    speech_to_text_language: str = Field(default="en", alias="SPEECH_TO_TEXT_LANGUAGE")
    speech_to_text_vad_filter: bool = Field(default=True, alias="SPEECH_TO_TEXT_VAD_FILTER")
    deepseek_api_key: str | None = Field(default=None, alias="DEEPSEEK_API_KEY")
    deepseek_base_url: str = Field(default="https://api.deepseek.com", alias="DEEPSEEK_BASE_URL")
    deepseek_model: str = Field(default="deepseek-v4-flash", alias="DEEPSEEK_MODEL")

    @model_validator(mode="after")
    def inherit_web_supabase_config(self) -> "AppSettings":
        if not self.supabase_url:
            self.supabase_url = self.next_public_supabase_url
        if not self.supabase_anon_key:
            self.supabase_anon_key = self.next_public_supabase_anon_key
        return self

    @property
    def cors_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.api_cors_origins.split(",") if origin.strip()]
        expanded: list[str] = []
        seen: set[str] = set()

        for origin in origins:
            parsed = urlparse(origin)
            if parsed.scheme in {"http", "https"} and parsed.hostname in {"localhost", "127.0.0.1"}:
                for port in ("3000", "3001", "3002", "3010"):
                    candidate = f"{parsed.scheme}://{parsed.hostname}:{port}"
                    if candidate not in seen:
                        expanded.append(candidate)
                        seen.add(candidate)
                continue

            if origin not in seen:
                expanded.append(origin)
                seen.add(origin)

        return expanded

    @property
    def admin_email_list(self) -> list[str]:
        return [email.strip().lower() for email in self.admin_emails.split(",") if email.strip()]


@lru_cache
def get_settings() -> AppSettings:
    return AppSettings()
