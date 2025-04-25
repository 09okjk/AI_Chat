import yaml
import httpx
import asyncio
from fastapi import FastAPI, Request, Response
from starlette.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 定义一些常量和工具函数
def add_cors_headers(headers):
    """Add CORS headers to a dictionary."""
    headers["Access-Control-Allow-Origin"] = "*"
    headers["Access-Control-Allow-Methods"] = "*"
    headers["Access-Control-Allow-Headers"] = "*"
    return headers

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
    
        # 构造百炼API请求体（与之前相同）
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
    
    import time
    
    # 使用二进制模式直接转发
    async def binary_generator():
        logger.info('开始使用二进制模式流式转发...')
        async with httpx.AsyncClient(timeout=60.0) as client:
            # 设置不要解码响应体
            r = await client.post(
                config["base_url"] + "/chat/completions",
                json=payload,
                headers=headers,
            )
            
            last_time = time.time()
            chunk_count = 0
            
            # 使用二进制模式读取数据
            async for chunk in r.aiter_raw():
                now = time.time()
                elapsed = now - last_time
                chunk_count += 1
                
                logger.info(f'[二进制] #{chunk_count} 收到 {len(chunk)} 字节，距离上次 {elapsed:.3f} 秒')
                yield chunk  # 直接输出原始二进制数据，不做任何处理
                
                # 确保立即发送
                await asyncio.sleep(0)
                last_time = now
        
        logger.info('流式传输完成')
    
    # 设置关键的流式响应头部
    response_headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"  # 特别为 Nginx 设置，禁用缓冲
    }
    
    # 使用CORS头部
    response_headers = add_cors_headers(response_headers)
    
    return StreamingResponse(
        binary_generator(), 
        headers=response_headers,
        media_type="text/event-stream"
    )

# 视频上传接口（如需AI分析可扩展）
@app.post("/api/upload_video")
async def upload_video(request: Request):
    # 前端推送视频流，可存储或转发
    return {"status": "received"}

@app.get("/api/ping")
def ping():
    return {"status": "ok"}
