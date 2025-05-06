import axios from 'axios';

/**
 * 直接API客户端
 * 完全绕过所有现有配置，强制使用本地连接
 */

// 创建一个新的axios实例，固定使用localhost
const directClient = axios.create({
  baseURL: 'http://localhost:8016/api',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
});

// 日志请求和响应
directClient.interceptors.request.use(config => {
  console.log(`直接请求: ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

directClient.interceptors.response.use(
  response => {
    console.log(`请求成功: ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  error => {
    console.error(`请求失败: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error.message);
    return Promise.reject(error);
  }
);

// 标准API调用
export const getConfig = async () => {
  try {
    const response = await directClient.get('/config');
    console.log('获取配置成功:', response.data);
    return response.data;
  } catch (error) {
    console.error('获取配置失败:', error);
    return { model: 'qwen2.5-omni-7b' }; // 默认配置
  }
};

// 与AI聊天
export const chatWithAI = async (payload, onStream) => {
  try {
    console.log('发起聊天请求:', JSON.stringify(payload));
    
    // 使用直接客户端发送请求
    const response = await directClient.post('/chat', payload, {
      responseType: 'text',
      transformResponse: [(data) => data],
    });
    
    // 处理响应数据
    const data = response.data;
    if (!data) {
      throw new Error('响应无数据');
    }
    
    // 处理流数据
    const parts = data.split(/\n\n/);
    for (let part of parts) {
      part = part.trim();
      if (!part) continue;
      
      if (part.startsWith('data: ')) {
        const content = part.substring(6).trim();
        
        // 处理结束标记
        if (content === '[DONE]') {
          console.log('收到流结束标记');
          continue;
        }
        
        try {
          const parsedData = JSON.parse(content);
          console.log('解析流数据:', parsedData);
          onStream(parsedData);
        } catch (error) {
          console.error('解析流数据失败:', error);
        }
      } else {
        try {
          const parsedData = JSON.parse(part);
          console.log('解析数据:', parsedData);
          onStream(parsedData);
        } catch (error) {
          console.error('解析无前缀数据失败:', error);
        }
      }
    }
    
    console.log('流处理完成');
  } catch (error) {
    console.error('聊天请求失败:', error);
    throw error;
  }
};

// 上传文件
export const uploadVideo = async (formData) => {
  return directClient.post('/upload_video', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export default {
  getConfig,
  chatWithAI,
  uploadVideo,
  client: directClient
};
