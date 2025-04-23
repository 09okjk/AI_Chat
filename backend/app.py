import yaml
import httpx
from fastapi import FastAPI, Request, Response, StreamingResponse
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
    data = await request.json()
    # 构造百炼API请求体
    payload = {
        "model": data.get("model", "qwen2.5-omni-7b"),
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
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            config["base_url"] + "/chat/completions",
            json=payload,
            headers=headers,
            timeout=None
        )
        # 流式转发响应
        return StreamingResponse(r.aiter_bytes(), media_type="application/json")

# 视频上传接口（如需AI分析可扩展）
@app.post("/api/upload_video")
async def upload_video(request: Request):
    # 前端推送视频流，可存储或转发
    return {"status": "received"}

@app.get("/api/ping")
def ping():
    return {"status": "ok"}
