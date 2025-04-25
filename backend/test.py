import httpx
import asyncio
import time

async def test_bailian_stream():
    url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    headers = {
        "Authorization": "Bearer sk-16b04ce7a2fb4a2ba0061b8467beb218",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "qwen2.5-omni-7b",
        "messages": [{"role": "user", "content": "你好,请为我简单介绍一下北京"}],
        "stream": True
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as response:
            async for chunk in response.aiter_text():
                print(f"[{time.time()}] 收到 chunk: {repr(chunk)}")

asyncio.run(test_bailian_stream())