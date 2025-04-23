import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000/api';

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
  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    if (value) {
      onStream(decoder.decode(value));
    }
  }
};

export const uploadVideo = async (formData) => {
  return axios.post(`${API_BASE}/upload_video`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
