# Docker Quick Start

This compose setup starts:

- PostgreSQL
- FastAPI backend
- Next.js user console

## Start Everything

```bash
docker compose up --build
```

Then open:

```text
User console: http://localhost:3000
API health:   http://localhost:8000/health
PostgreSQL:   localhost:55432
```

## Database Connection

```text
Host: localhost
Port: 55432
Database: auto_job_applier
Username: auto_job
Password: auto_job_password
```

Connection string:

```text
postgresql://auto_job:auto_job_password@localhost:55432/auto_job_applier
```

## Optional Adminer

```bash
docker compose --profile tools up -d adminer
```

Open:

```text
http://localhost:8080
```

## Local Worker Note

The user console can show the auto-apply control, but the real browser automation worker is still best run on the host machine for now:

```bash
python3 ../worker/runAiBot.py
```

Running the LinkedIn browser automation inside Docker needs a separate browser container strategy for Chrome, login profiles, and anti-bot stability.
