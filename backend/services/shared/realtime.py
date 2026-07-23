import asyncio
import json


class SSEBroadcaster:
    def __init__(self):
        self.listeners: set[asyncio.Queue] = set()
        self.loop: asyncio.AbstractEventLoop | None = None

    def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue(maxsize=100)
        self.listeners.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self.listeners.discard(queue)

    async def broadcast(self, event_type: str, data: dict) -> None:
        message = f"event: {event_type}\ndata: {json.dumps(data, default=str)}\n\n"
        for queue in list(self.listeners):
            if queue.full():
                # Keep the latest realtime state without allowing stalled clients
                # to retain an unbounded event backlog.
                queue.get_nowait()
            queue.put_nowait(message)


broadcaster = SSEBroadcaster()


def broadcast_sync(event_type: str, data: dict) -> None:
    loop = broadcaster.loop
    if loop is None or loop.is_closed():
        return
    asyncio.run_coroutine_threadsafe(broadcaster.broadcast(event_type, data), loop)
