def persistence_log(*messages: object) -> None:
    try:
        print(*messages)
    except Exception:
        pass
