import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://192.168.18.197:8016/api';

export const chatWithAI = async (payload, onStream) => {
  try {
    console.log('[api.js] chatWithAI 请求发起:', payload);
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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
