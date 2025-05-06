import httpClient from './httpClient';

// 导出为方便其他模块使用
export const client = httpClient;

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
    
    // 深拷贝并剥除循环引用对象
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
        // 过滤 DOM、React 事件等
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
    
    // 使用 client 实例发送请求，使用 responseType: 'text' 来手动处理流
    const response = await client.post('/chat', safePayloadForPost, {
      responseType: 'text',
      // 解析响应过程中不要自动解析JSON
      transformResponse: [(data) => data],
      // 增加超时时间
      timeout: 60000,
    });
    
    console.log('[api.js] chatWithAI 收到响应');
    
    // 处理流数据
    const data = response.data;
    if (!data) {
      throw new Error('响应无数据');
    }
    
    // 分割流数据
    const parts = data.split(/\n\n/);
    for (let part of parts) {
      part = part.trim();
      if (!part) continue;
      
      // 处理不同格式的响应
      if (part.startsWith('data: ')) {
        let dataContent = part.substring(6).trim();
        
        // 流结束标记
        if (dataContent === '[DONE]') {
          console.log('[api.js] 收到流结束标记');
          continue;
        }
        
        try {
          const parsedData = JSON.parse(dataContent);
          console.log('[api.js] 解析数据:', parsedData);
          onStream(parsedData);
        } catch (error) {
          console.error('[api.js] 数据解析错误:', error);
        }
      } else {
        // 尝试直接作为JSON对象解析
        try {
          const parsedData = JSON.parse(part);
          console.log('[api.js] 解析无前缀数据:', parsedData);
          onStream(parsedData);
        } catch (error) {
          console.error('[api.js] 无前缀数据解析错误:', error);
        }
      }
    }
    
    console.log('[api.js] 流处理完成');
  } catch (error) {
    console.error('[api.js] chatWithAI 请求错误:', error);
    throw error;
  }
};

export const uploadVideo = async (formData) => {
  return client.post('/upload_video', formData, {
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
    // 使用 client 实例发送请求
    const response = await client.get('/config');
    configCache = response.data;
    console.log('[api.js] 已获取后端配置:', configCache);
    return configCache;
  } catch (error) {
    console.error('[api.js] 获取配置失败:', error);
    // 返回默认配置
    return { model: 'qwen2.5-omni-7b' };
  }
};
