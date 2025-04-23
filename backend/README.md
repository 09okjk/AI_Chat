# AI Chat 后端（FastAPI）

## 功能
- 读取 config.yaml 配置百炼API Key
- 提供 /api/chat 文字/语音对话接口，流式转发百炼API响应
- 提供 /api/upload_video 视频上传接口（可扩展AI分析）
- 支持跨域，方便前端开发

## 快速开始

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务（默认端口8000）
uvicorn app:app --reload
```

## 配置
请在 `config.yaml` 中填写百炼API Key：
```yaml
api_key: "sk-xxx-your-bailian-api-key"
base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1"
```

## 接口说明
- POST /api/chat
  - 请求体：
    - model, messages, modalities, audio（参考案例.md）
  - 返回：流式响应，兼容前端流式处理

- POST /api/upload_video
  - 请求体：视频流/文件
  - 返回：{"status": "received"}

## 健康检查
- GET /api/ping
