import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://192.168.18.197:8016/api';

export const chatWithAI = async (payload, onStream) => {
  // 使用fetch以支持流式响应
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.body) throw new Error('No response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let done = false;
  let buffer = '';
  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      // 处理多条data: ...
      let lines = buffer.split(/\r?\n/);
      // 保证最后一个未完整data: 保留到下次
      buffer = lines.pop();
      for (let line of lines) {
        line = line.trim();
        if (line.startsWith('data:')) {
          let jsonStr = line.replace(/^data:/, '').trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const data = JSON.parse(jsonStr);
            if (data.choices && data.choices[0]) {
              const delta = data.choices[0].delta;
              if (delta) {
                if (delta.text) {
                  onStream(delta.text);
                } else if (delta.audio && delta.audio.transcript) {
                  onStream(delta.audio.transcript);
                }
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  }
};

export const uploadVideo = async (formData) => {
  return axios.post(`${API_BASE}/upload_video`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
