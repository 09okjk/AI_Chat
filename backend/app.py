import yaml
import httpx
import asyncio
from fastapi import FastAPI, Request, Response
from starlette.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 自定义 SSE 响应类，专为流式输出设计
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

# 文字/语音对话接口（流式转发）
@app.post("/api/chat")
async def chat(request: Request):
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger('ai_chat')
    logger.info('收到 /api/chat 请求')
    data = await request.json()
    logger.info(f'请求内容: {data}')
    
    # 完全绕过 FastAPI 响应机制，直接使用 ASGI 接口
    async def app_endpoint(scope, receive, send):
        # 发送 HTTP 200 和头部
        await send({
            "type": "http.response.start",
            "status": 200,
            "headers": [
                (b"content-type", b"text/event-stream"),
                (b"cache-control", b"no-cache"),
                (b"connection", b"keep-alive"),
            ],
        })
        
        # 构造百炼API请求
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
        
        # 直接调用百炼并流式转发
        async with httpx.AsyncClient(timeout=60.0) as client:
            logger.info('开始直接流式转发...')
            r = await client.post(
                config["base_url"] + "/chat/completions",
                json=payload,
                headers=headers,
            )
            
            buffer = ""
            async for raw_chunk in r.aiter_raw():
                # 立即发送每个原始块，不做任何处理
                logger.info(f'【立即转发】收到 {len(raw_chunk)} 字节')
                await send({
                    "type": "http.response.body",
                    "body": raw_chunk,
                    "more_body": True
                })
                await asyncio.sleep(0)
                
        # 关闭响应
        await send({
            "type": "http.response.body",
            "body": b"",
            "more_body": False
        })
    
    return app_endpoint

# 视频上传接口（如需AI分析可扩展）
@app.post("/api/upload_video")
async def upload_video(request: Request):
    # 前端推送视频流，可存储或转发
    return {"status": "received"}

@app.get("/api/ping")
def ping():
    return {"status": "ok"}
