# User Console

Next.js user management app for Auto Job Applier.

## Local Development

```bash
cd Apps/user
npm install
npm run dev
```

Open:

```text
http://localhost:3001
```

For local development, the browser should call the API on the host machine:

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## Docker

From the repository root:

```bash
docker compose up --build
```

Open:

```text
http://localhost:3001
```

The browser calls the API through:

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```
