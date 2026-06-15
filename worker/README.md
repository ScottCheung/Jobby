# Local Worker Agent

The Docker stack runs PostgreSQL, the FastAPI API, and the Next.js user console.
The LinkedIn auto-apply browser worker should still run on the host machine because it needs the host Chrome session, browser profile, and manual confirmation dialogs.

Start the stack first:

```bash
docker compose up -d --build
```

Then keep this host agent running in a local terminal:

```bash
python3 -m worker.local_agent
```

When the user console calls `Start Auto Apply`, the API creates a pending automation run.
The host agent picks that run up and starts:

```bash
python3 worker/runAiBot.py
```

If the user console calls `Stop Auto Apply`, the API marks the run as `cancel_requested`.
The host agent sees that state, terminates the Python worker, and writes the final status back to the database.

Optional environment variables:

```bash
AUTO_JOB_API_BASE_URL=http://127.0.0.1:8000
AUTO_JOB_AGENT_POLL_SECONDS=2
```
