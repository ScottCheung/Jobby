import asyncio
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from services.shared import deepseek


class BlockingAsyncClient:
    def __init__(self) -> None:
        self.started = asyncio.Event()
        self.exited = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        self.exited = True

    async def post(self, *args, **kwargs):
        self.started.set()
        await asyncio.Event().wait()


class DeepSeekCancellationTests(unittest.IsolatedAsyncioTestCase):
    async def test_async_completion_closes_client_when_cancelled(self):
        client = BlockingAsyncClient()
        settings = SimpleNamespace(
            deepseek_api_key='test-key',
            deepseek_base_url='https://ai.example.test',
            deepseek_model='test-model',
        )
        with (
            patch.object(deepseek, 'get_settings', return_value=settings),
            patch.object(deepseek.httpx, 'AsyncClient', return_value=client),
        ):
            task = asyncio.create_task(
                deepseek._complete_async(
                    [{'role': 'user', 'content': 'test'}],
                    operation='test_cancel',
                )
            )
            await client.started.wait()
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task

        self.assertTrue(client.exited)


if __name__ == '__main__':
    unittest.main()
