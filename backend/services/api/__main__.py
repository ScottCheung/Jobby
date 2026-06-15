import uvicorn

from services.shared.settings import get_settings


if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run("services.api.main:app", host=settings.api_host, port=settings.api_port, reload=settings.api_reload)
