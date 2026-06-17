# Local Worker

The desktop app starts each Python bot directly with `child_process.spawn`
and streams live status back to the UI.

Current bot entry points:

```bash
python3 worker/runAiBot.py
python3 worker/runSeekBot.py
python3 worker/runGenericAssistBot.py
```

The old polling-based `worker.local_agent` flow has been removed.
