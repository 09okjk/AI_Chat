/**
 * 全局配置文件
 * 集中管理应用程序配置，避免硬编码
 */

// API基础URL配置
export const getApiBaseUrl = () => {
  // 优先使用环境变量
  if (process.env.REACT_APP_API_BASE) return process.env.REACT_APP_API_BASE;
  
  // 使用当前主机（始终使用HTTP协议）
  const protocol = 'http:';
  const host = window.location.hostname;
  const port = '8016';
  
  return `${protocol}//${host}:${port}/api`;
};

// WebSocket基础URL配置
export const getWsBaseUrl = () => {
  // 优先使用环境变量
  if (process.env.REACT_APP_WS_BASE) return process.env.REACT_APP_WS_BASE;
  
  // 使用当前主机（始终使用ws协议）
  const protocol = 'ws:';
  const host = window.location.hostname;
  const port = '8016';
  
  return `${protocol}//${host}:${port}`;
};

// 默认配置
export default {
  apiBaseUrl: getApiBaseUrl(),
  wsBaseUrl: getWsBaseUrl(),
  defaultModel: 'qwen2.5-omni-7b',
  defaultVoice: 'Chelsie',
  audioSampleRate: 24000,
  maxRecordingTime: 30, // 秒
};
