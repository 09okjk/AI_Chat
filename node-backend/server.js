const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const morgan = require('morgan');
const fs = require('fs');
const https = require('https');
const path = require('path');
const config = require('./config');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

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

// 配置获取接口
app.get('/api/config', (req, res) => {
  res.json({
    model: config.model || 'qwen-omni-turbo',
    // 可以在这里添加其他需要暴露给前端的配置
  });
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
      model: req.body.model || config.model || 'qwen-omni-turbo',
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

// 声明存储活跃通话的Map
const activeVoiceCalls = new Map();

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

// WebSocket服务器设置
const wss = new WebSocket.Server({ server });

// WebSocket连接处理
wss.on('connection', (ws) => {
  // 为每个连接生成唯一ID
  const connectionId = uuidv4();
  console.log(`新的WebSocket连接: ${connectionId}`);
  
  // 初始化连接状态
  let callState = {
    id: connectionId,
    isActive: false,
    model: null,
    audioQueue: [],
    audioBuffers: [],
    currentModelRequest: null,
    lastMessageTime: Date.now()
  };
  
  // 将连接存储在活跃通话Map中
  activeVoiceCalls.set(connectionId, {
    ws,
    state: callState,
    lastPing: Date.now()
  });
  
  // 向客户端发送连接ID
  ws.send(JSON.stringify({
    type: 'connection_established',
    connectionId: connectionId,
    timestamp: Date.now()
  }));
  
  // 心跳检测
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    }
  }, 30000);
  
  // 消息处理
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      const call = activeVoiceCalls.get(connectionId);
      
      if (!call) {
        console.error(`找不到连接ID: ${connectionId}`);
        return;
      }
      
      // 更新最后消息时间
      call.lastPing = Date.now();
      call.state.lastMessageTime = Date.now();
      
      // 根据消息类型处理
      switch (data.type) {
        case 'start_call':
          // 开始通话
          await handleStartCall(ws, call.state, data);
          break;
          
        case 'audio_chunk':
          // 处理音频块
          await handleAudioChunk(ws, call.state, data);
          break;
          
        case 'end_call':
          // 结束通话
          handleEndCall(ws, connectionId);
          break;
          
        case 'pong':
          // 心跳响应
          call.lastPing = Date.now();
          break;
          
        default:
          console.warn(`未知的消息类型: ${data.type}`);
      }
    } catch (error) {
      console.error('处理WebSocket消息时出错:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          error: '处理消息时出错',
          message: error.message
        }));
      }
    }
  });
  
  // 关闭连接处理
  ws.on('close', () => {
    clearInterval(pingInterval);
    handleEndCall(ws, connectionId);
    console.log(`WebSocket连接关闭: ${connectionId}`);
  });
  
  // 错误处理
  ws.on('error', (error) => {
    console.error(`WebSocket错误 (${connectionId}):`, error);
    clearInterval(pingInterval);
    handleEndCall(ws, connectionId);
  });
});

// 开始通话处理函数
async function handleStartCall(ws, callState, data) {
  // 如果已经有活跃通话，先结束
  if (callState.isActive) {
    await handleEndCurrentModelRequest(callState);
  }
  
  // 更新通话状态
  callState.isActive = true;
  callState.model = data.model || config.model || 'qwen-omni-turbo';
  callState.audioQueue = [];
  callState.audioBuffers = [];
  
  // 通知客户端通话已开始
  ws.send(JSON.stringify({
    type: 'call_started',
    model: callState.model,
    timestamp: Date.now()
  }));
  
  console.log(`通话已开始: ${callState.id}, 模型: ${callState.model}`);
}

// 处理音频块
async function handleAudioChunk(ws, callState, data) {
  if (!callState.isActive) {
    console.warn(`收到音频块但通话未激活: ${callState.id}`);
    return;
  }
  
  // 将音频块添加到队列
  callState.audioBuffers.push(data.audio);
  
  // 如果积累了足够的音频数据或超过时间阈值，则发送到模型
  if (callState.audioBuffers.length >= 5 || (Date.now() - callState.lastMessageTime) > 300) {
    await processAudioAndGetAIResponse(ws, callState);
  }
}

// 处理音频并获取AI响应
async function processAudioAndGetAIResponse(ws, callState) {
  // 如果没有音频数据，则返回
  if (callState.audioBuffers.length === 0) return;
  
  // 合并音频数据
  const audioBase64 = callState.audioBuffers.join('');
  callState.audioBuffers = []; // 清空缓冲区
  
  // 构造请求负载
  const payload = {
    model: callState.model,
    messages: [{
      role: 'user',
      content: [
        {
          type: "input_audio",
          input_audio: {
            data: audioBase64,
            format: 'wav'
          }
        },
        { 
          type: "text", 
          text: "请帮我理解这段音频并进行回复"
        }
      ]
    }],
    modalities: ['text', 'audio'],
    audio: { voice: 'male', format: 'wav' },
    stream: true,
    stream_options: { include_usage: true }
  };

  try {
    // 保存当前请求，以便需要时可以取消
    const controller = new AbortController();
    callState.currentModelRequest = controller;
    
    // 发送请求到AI模型
    const response = await axios({
      method: 'post',
      url: `${config.base_url}/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`
      },
      data: payload,
      responseType: 'stream',
      signal: controller.signal
    });
    
    // 处理响应流
    response.data.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      console.log(`[${new Date().toISOString()}] 收到通话响应chunk: ${chunkStr}`);
      
      try {
        // 将数据发送到客户端
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'ai_response',
            data: chunkStr,
            timestamp: Date.now()
          }));
        }
      } catch (err) {
        console.error('发送AI响应到客户端时出错:', err);
      }
    });
    
    response.data.on('end', () => {
      console.log(`通话响应流结束: ${callState.id}`);
      callState.currentModelRequest = null;
    });
    
    response.data.on('error', (err) => {
      console.error(`通话响应流错误: ${callState.id}`, err);
      callState.currentModelRequest = null;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          error: '模型响应错误',
          message: err.message
        }));
      }
    });
  } catch (error) {
    console.error('处理AI模型请求时出错:', error);
    callState.currentModelRequest = null;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        error: '请求处理错误',
        message: error.message
      }));
    }
  }
}

// 结束通话
function handleEndCall(ws, connectionId) {
  const call = activeVoiceCalls.get(connectionId);
  if (call) {
    // 取消正在进行的模型请求
    handleEndCurrentModelRequest(call.state);
    
    // 通知客户端通话已结束
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'call_ended',
        timestamp: Date.now()
      }));
    }
    
    // 从活跃通话Map中移除
    activeVoiceCalls.delete(connectionId);
    console.log(`通话已结束: ${connectionId}`);
  }
}

// 结束当前模型请求
async function handleEndCurrentModelRequest(callState) {
  if (callState.currentModelRequest) {
    try {
      callState.currentModelRequest.abort();
    } catch (error) {
      console.error('取消模型请求时出错:', error);
    }
    callState.currentModelRequest = null;
  }
  callState.isActive = false;
  callState.audioQueue = [];
  callState.audioBuffers = [];
}

// 定期清理过期连接
setInterval(() => {
  const now = Date.now();
  for (const [connectionId, call] of activeVoiceCalls.entries()) {
    // 如果超过2分钟没有活动，则清理连接
    if (now - call.lastPing > 120000) {
      console.log(`清理过期连接: ${connectionId}`);
      handleEndCall(call.ws, connectionId);
    }
  }
}, 60000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 ${useSSL ? 'https' : 'http'}://0.0.0.0:${PORT}`);
});
