# Local Worker

The desktop app starts each Python bot directly with `child_process.spawn`
and streams live status back to the UI.

Recommended layout:

```bash
worker/apps
worker/platforms
worker/shared
```

Current bot entry points:

```bash
python3 worker/apps/run_ai_bot.py
python3 worker/apps/seek_bot.py
python3 worker/apps/generic_assist_bot.py
python3 worker/apps/seek_extract_job.py --url "https://au.seek.com/job/12345678"
```

The old polling-based `worker.local_agent` flow has been removed.

Primary code layout:

```bash
worker/platforms
worker/shared
worker/apps
```

Compatibility wrappers are still kept for:

```bash
python3 worker/run_ai_bot.py
python3 worker/run_seek_bot.py
python3 worker/run_generic_assist_bot.py
python3 worker/extract_seek_job.py --url "https://au.seek.com/job/12345678"
python3 worker/runAiBot.py
python3 worker/runLinkedinBot.py
python3 worker/runSeekBot.py
python3 worker/runGenericAssistBot.py
```

Notes:

```bash
worker/modules
worker/config
```

These are compatibility layers kept to avoid breaking the existing runtime while
the codebase finishes migrating to the new structure.
