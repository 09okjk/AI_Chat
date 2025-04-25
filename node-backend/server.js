const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const morgan = require('morgan');
const fs = require('fs');
const https = require('https');
const path = require('path');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 8016;

// 中间件
app.use(cors()); // 允许跨域请求
app.use(express.json({ limit: '50mb' })); // 处理JSON请求体
app.use(morgan('dev')); // 日志记录

// 文件上传配置
const upload = multer({ 
  dest: 'uploads/', 
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB 限制
});

// 健康检查接口
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok' });
});

// 视频上传接口
app.post('/api/upload_video', upload.single('video'), (req, res) => {
  console.log('收到视频上传请求');
  if (req.file) {
    console.log('文件信息:', req.file);
  }
  res.json({ status: 'received' });
});

// 核心聊天接口 - 流式转发
app.post('/api/chat', async (req, res) => {
  console.log('收到 /api/chat 请求');
  
  try {
    // 构造百炼API请求
    const payload = {
      model: req.body.model || config.model || 'qwen2.5-omni-7b',
      messages: req.body.messages,
      modalities: req.body.modalities || ['text'],
      audio: req.body.audio,
      stream: true,
      stream_options: { include_usage: true }
    };

    console.log('请求内容:', JSON.stringify(payload, null, 2));

    // 设置响应头，指定为SSE流
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲

    // 使用axios创建流式请求到百炼API
    const response = await axios({
      method: 'post',
      url: `${config.base_url}/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`
      },
      data: payload,
      responseType: 'stream' // 关键：使用流响应
    });

    // 直接转发流给客户端
    response.data.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      console.log(`[${new Date().toISOString()}] 收到chunk: ${chunkStr}`);
      res.write(chunkStr);
      // 立即发送，不等待缓冲区填满
      res.flush && res.flush();
    });

    response.data.on('end', () => {
      console.log('流结束');
      res.end();
    });

    response.data.on('error', (err) => {
      console.error('流错误:', err);
      res.end();
    });

  } catch (error) {
    console.error('处理请求时出错:', error);
    
    // 确保响应尚未发送
    if (!res.headersSent) {
      res.status(500).json({ 
        error: '服务器错误', 
        message: error.message 
      });
    } else {
      res.end();
    }
  }
});

// 启动服务器
let server;

// 检查是否存在SSL证书
const sslKeyPath = '../backend/server.key';
const sslCertPath = '../backend/server.crt';

const useSSL = fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath);

if (useSSL) {
  // 使用HTTPS启动
  const options = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath)
  };
  server = https.createServer(options, app);
  console.log('使用HTTPS模式启动');
} else {
  // 使用HTTP启动
  server = app.listen(PORT, () => {
    console.log(`服务器启动在 http://localhost:${PORT}`);
  });
  console.log('使用HTTP模式启动');
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 ${useSSL ? 'https' : 'http'}://0.0.0.0:${PORT}`);
});
