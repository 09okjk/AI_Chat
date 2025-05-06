import axios from 'axios';
import config from '../config';

/**
 * 创建HTTP客户端
 * 确保所有API请求都使用正确的协议和地址
 */
const createHttpClient = () => {
  // 强制使用本地地址和HTTP协议
  const forceLocalUrl = 'http://localhost:8016/api';
  console.log('创建HTTP客户端，强制使用URL:', forceLocalUrl);
  
  // 创建axios实例
  const client = axios.create({
    baseURL: forceLocalUrl,
    timeout: 60000, // 增加超时时间到60秒
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate', // 禁用缓存
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
  
  // 请求拦截器
  client.interceptors.request.use(
    (config) => {
      // 强制使用HTTP协议
      if (config.url.startsWith('https://')) {
        config.url = config.url.replace('https://', 'http://');
        console.log('已修正URL协议:', config.url);
      }
      
      // 如果URL包含硬编码的IP地址，替换为当前主机名
      if (config.url.includes('192.168.18.197')) {
        const correctedUrl = config.url.replace('192.168.18.197', window.location.hostname);
        console.log('修正硬编码IP:', config.url, '->', correctedUrl);
        config.url = correctedUrl;
      }
      
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
  
  return client;
};

// 导出HTTP客户端实例
const httpClient = createHttpClient();
export default httpClient;
