FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements-api.txt /app/requirements-api.txt
RUN pip install --no-cache-dir -r /app/requirements-api.txt

COPY backend/alembic.ini /app/alembic.ini
COPY backend/migrations /app/migrations
COPY backend/services /app/services
COPY backend/scripts /app/scripts

COPY worker/linkedinBot/services/job_text_parser.py /app/linkedinBot/services/job_text_parser.py

EXPOSE 8000

CMD ["sh", "-c", "python -m alembic upgrade head && python -m services.api"]
