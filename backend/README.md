# Docker Quick Start

This compose setup starts:

- PostgreSQL
- FastAPI backend
- Next.js user console
- MinIO object storage for local images and future uploads

## Start Everything

```bash
docker compose up --build
```

Then open:

```text
User console: http://localhost:3000
API health:   http://localhost:8000/health
PostgreSQL:   localhost:55432
MinIO API:    http://localhost:9000
MinIO UI:     http://localhost:9001
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

## Object Storage

Local Docker uses the S3-compatible MinIO service and automatically creates the `jobby-assets` bucket. Its default development credentials are `minioadmin` / `minioadmin`; change them before exposing the stack outside a local machine.

Production can use Supabase Storage without application code changes. With Supabase S3 access keys, set:

```text
STORAGE_PROVIDER=s3
STORAGE_BUCKET=jobby-assets
STORAGE_S3_ENDPOINT=https://your-project.storage.supabase.co/storage/v1/s3
STORAGE_S3_REGION=ap-southeast-2
STORAGE_S3_ACCESS_KEY_ID=your-s3-access-key
STORAGE_S3_SECRET_ACCESS_KEY=your-s3-secret-key
STORAGE_PUBLIC_BASE_URL=https://your-project.supabase.co/storage/v1/object/public
```

Create a public `jobby-assets` bucket in Supabase Storage. The browser uploads through the API, which validates ownership, image type, and file size. The database stores a provider-neutral storage key alongside the legacy URL, so moving later to S3, R2, or B2 only requires a storage-provider migration and URL refresh.

The `supabase` REST provider also remains available for deployments that use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` instead of S3 credentials.
