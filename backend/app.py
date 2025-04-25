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
    
    logger.info('准备直接使用 httpx 响应流')
    async def direct_stream_generator():
        async with httpx.AsyncClient(timeout=60.0) as client:
            # 获取上游响应
            logger.info('向百炼API发送请求')
            r = await client.post(
                config["base_url"] + "/chat/completions",
                json=payload,
                headers=headers,
            )
            logger.info(f'收到百炼API响应，状态码: {r.status_code}')
            logger.info(f'响应头: {dict(r.headers)}')
            
            # 直接转发流
            logger.info('开始流式输出...')
            count = 0
            async for chunk in r.aiter_text():
                count += 1
                now = time.time()
                logger.info(f'【流式转发】{now} 收到并立即转发 chunk #{count}: {repr(chunk)}')
                # 将每个 chunk 包装为 SSE 格式
                if chunk.strip():
                    yield f"data: {chunk}\n\n".encode("utf-8")
                    await asyncio.sleep(0)
            
            logger.info(f'流式输出完成，共 {count} 个 chunks')
            # 发送结束标记
            yield b"data: [DONE]\n\n"
    
    # 返回带有适当SSE头部的流式响应
    logger.info('返回 StreamingResponse')
    return StreamingResponse(
        direct_stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 为 Nginx 禁用缓冲
        }
    )

# 视频上传接口（如需AI分析可扩展）
@app.post("/api/upload_video")
async def upload_video(request: Request):
    # 前端推送视频流，可存储或转发
    return {"status": "received"}

@app.get("/api/ping")
def ping():
    return {"status": "ok"}
