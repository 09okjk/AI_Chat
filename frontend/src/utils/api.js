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
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        console.log('[api.js] chatWithAI 收到流 chunk:', buffer);
        // 处理多条data: ...
        let lines = buffer.split(/\r?\n/);
        // 保证最后一个未完整data: 保留到下次
        buffer = lines.pop();
        for (let line of lines) {
          console.log('[api.js] chatWithAI 处理行:', line);
          line = line.trim();
          // 兼容 data: ... 或纯 JSON 行
          if (line.startsWith('data:')) {
            line = line.replace(/^data:/, '').trim();
          }
          if (!line) continue;
          try {
            const data = JSON.parse(line);
            onStream(data);
          } catch (error) {
            console.error('[api.js] chatWithAI error:', error, line);
          }
        }
      }
    }
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
