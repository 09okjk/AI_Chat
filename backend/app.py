import yaml
import httpx
from fastapi import FastAPI, Request, Response
from starlette.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_config():
    with open("config.yaml", "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

config = get_config()

from fastapi import Response

class SSEResponse(Response):
    media_type = "text/event-stream"
    
    def __init__(self, generator, status_code=200):
        super().__init__(content=None, status_code=status_code)
        self.generator = generator
        
    async def __call__(self, scope, receive, send):
        await send({
            "type": "http.response.start",
            "status": self.status_code,
            "headers": [
                [b"content-type", b"text/event-stream"],
                [b"cache-control", b"no-cache"],
                [b"connection", b"keep-alive"],
                [b"transfer-encoding", b"chunked"],
            ],
        })
        
        async for chunk in self.generator:
            if not isinstance(chunk, bytes):
                chunk = chunk.encode("utf-8") if isinstance(chunk, str) else b""
            await send({"type": "http.response.body", "body": chunk, "more_body": True})
            await asyncio.sleep(0)
        
        await send({"type": "http.response.body", "body": b"", "more_body": False})

# 文字/语音对话接口（流式转发）
@app.post("/api/chat")
async def chat(request: Request):
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger('ai_chat')
    logger.info('收到 /api/chat 请求')
    data = await request.json()
    logger.info(f'请求内容: {data}')
    # 构造百炼API请求体（messages 已支持官方音频输入格式，无需 user_audio 字段）
    payload = {
        "model": data.get("model", config.get("model", "qwen2.5-omni-7b")),
        "messages": data["messages"],
        "modalities": data.get("modalities", ["text"]),
        "audio": data.get("audio"),
        "stream": True,
        "stream_options": {"include_usage": True}
    }
    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json"
    }
    import asyncio
    import time
    async def event_generator():
        logger.info('开始流式输出...')
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                config["base_url"] + "/chat/completions",
                json=payload,
                headers=headers,
            )
            buffer = ""
            async for chunk in r.aiter_text():
                logger.info(f'【验证流式】{time.time()} 收到 chunk: {repr(chunk)}')
                # 立即为每个chunk生成输出，不等待完整行
                yield f"data: {chunk}\n\n".encode("utf-8")
                await asyncio.sleep(0)
                
                # 原来的行处理逻辑还保留，但不必须
                buffer += chunk
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()
                    if line:
                        logger.info(f'输出 JSON 行: {line}')
                        # 注意：我们已在上面yield过这些数据了
                
        logger.info('流式输出完成')
        yield "data: [DONE]\r\n\r\n".encode("utf-8")
    logger.info('准备返回 StreamingResponse')
    # 推荐使用 application/json，如果上游是SSE则可改为 text/event-stream
    # return StreamingResponse(event_generator(), media_type="text/event-stream")
    return SSEResponse(event_generator())

# 视频上传接口（如需AI分析可扩展）
@app.post("/api/upload_video")
async def upload_video(request: Request):
    # 前端推送视频流，可存储或转发
    return {"status": "received"}

@app.get("/api/ping")
def ping():
    return {"status": "ok"}
