import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://192.168.18.197:8016/api';

export const chatWithAI = async (payload, onStream) => {
  try {
    // 安全日志打印，避免 circular structure 错误
    let safePayload = '';
    try {
      safePayload = JSON.stringify(payload);
    } catch (e) {
      if (typeof payload === 'object') {
        safePayload = `[object ${payload.constructor && payload.constructor.name ? payload.constructor.name : 'Object'}]`;
      } else {
        safePayload = '[Unserializable payload]';
      }
    }
    console.log('[api.js] chatWithAI 请求发起:', safePayload);
    // 深拷贝并剔除循环引用对象，防止 circular structure 错误
    function safeCopy(obj, seen = new WeakSet()) {
      if (obj === null || typeof obj !== 'object') return obj;
      if (seen.has(obj)) return undefined;
      seen.add(obj);
      if (Array.isArray(obj)) {
        return obj.map(item => safeCopy(item, seen));
      }
      const result = {};
      for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        const val = obj[key];
        // 过滤 DOM、React 事件、FiberNode、stateNode 等
        if ((val && typeof val === 'object' && (
          val instanceof HTMLElement ||
          (typeof val.type === 'string' && val.type.startsWith('on')) ||
          key === '__reactFiber' ||
          key === 'stateNode' ||
          key === '_owner' ||
          key === 'target' ||
          key === 'currentTarget'))
        ) {
          continue;
        }
        result[key] = safeCopy(val, seen);
      }
      return result;
    }
    const safePayloadForPost = safeCopy(payload);
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(safePayloadForPost),
    });
    console.log('[api.js] chatWithAI 响应:', response);
    if (!response.body) {
      console.error('[api.js] chatWithAI 响应无 body');
      throw new Error('No response body');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let buffer = '';
    
    // 记录开始时间，用于调试
    const startTime = Date.now();
    let chunkCount = 0;
    
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        chunkCount++;
        const chunkTime = Date.now() - startTime;
        console.log(`[${chunkTime}ms] 前端收到chunk #${chunkCount}, 大小: ${value.length} 字节`);
        
        buffer += chunk;
        // 使用正则表达式处理SSE格式 (data: ...)
        const parts = buffer.split(/\n\n/);
        buffer = parts.pop() || ''; // 保留最后一部分，可能不完整
        
        for (let part of parts) {
          part = part.trim();
          if (!part) continue;
          
          // 解析data:前缀的行
          if (part.startsWith('data: ')) {
            let dataContent = part.substring(6).trim();
            
            // 处理特殊标记 [DONE]
            if (dataContent === '[DONE]') {
              console.log('[api.js] 收到流结束标记 [DONE]');
              continue;
            }
            
            try {
              const data = JSON.parse(dataContent);
              console.log('[api.js] 解析成功:', data);
              onStream(data);
            } catch (error) {
              console.error('[api.js] JSON解析错误:', error, dataContent);
            }
          } else {
            // 尝试作为普通JSON解析
            try {
              const data = JSON.parse(part);
              console.log('[api.js] 解析无前缀JSON:', data);
              onStream(data);
            } catch (error) {
              console.error('[api.js] 无前缀解析错误:', error, part);
            }
          }
        }
      }
    }
    console.log('[api.js] 流读取完成');
  } catch (error) {
    console.error('[api.js] chatWithAI error:', error);
    throw error;
  }
};

export const uploadVideo = async (formData) => {
  return axios.post(`${API_BASE}/upload_video`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// 全局配置缓存
let configCache = null;

// 从后端获取配置
export const getConfig = async () => {
  // 如果已经有缓存配置，直接返回
  if (configCache) {
    return configCache;
  }
  
  try {
    const response = await axios.get(`${API_BASE}/config`);
    configCache = response.data;
    console.log('[api.js] 已获取后端配置:', configCache);
    return configCache;
  } catch (error) {
    console.error('[api.js] 获取配置失败:', error);
    // 返回默认配置
    return { model: 'qwen2.5-omni-7b' };
  }
};
