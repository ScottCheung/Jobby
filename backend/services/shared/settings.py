from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from urllib.parse import urlparse


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

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
    default_admin_email: str = Field(default="admin@example.local", alias="DEFAULT_ADMIN_EMAIL")
    default_admin_name: str = Field(default="Local Admin", alias="DEFAULT_ADMIN_NAME")
    enable_api_local_worker: bool = Field(default=False, alias="ENABLE_API_LOCAL_WORKER")

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


@lru_cache
def get_settings() -> AppSettings:
    return AppSettings()
