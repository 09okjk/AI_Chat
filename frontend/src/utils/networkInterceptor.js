/**
 * 网络请求拦截器
 * 用于拦截和修改所有网络请求，确保使用正确的协议和地址
 */

// 原始的fetch和XMLHttpRequest
const originalFetch = window.fetch;
const originalXhrOpen = XMLHttpRequest.prototype.open;

// 修复URL的函数
const fixUrl = (url) => {
  console.log('正在检查URL:', url);
  
  // 如果不是URL字符串，直接返回
  if (typeof url !== 'string') return url;
  
  // 如果是绝对URL
  if (url.startsWith('http')) {
    // 1. 将HTTPS改为HTTP
    let fixedUrl = url;
    if (url.startsWith('https://')) {
      fixedUrl = url.replace('https://', 'http://');
      console.log('将HTTPS改为HTTP:', fixedUrl);
    }
    
    // 2. 替换硬编码的IP地址
    if (fixedUrl.includes('192.168.18.197')) {
      fixedUrl = fixedUrl.replace('192.168.18.197', 'localhost');
      console.log('替换硬编码IP地址:', fixedUrl);
    }
    
    return fixedUrl;
  }
  
  return url;
};

// 初始化网络拦截器
export const initNetworkInterceptor = () => {
  console.log('初始化网络请求拦截器');
  
  // 拦截fetch
  window.fetch = function(url, options) {
    const fixedUrl = fixUrl(url);
    console.log(`拦截fetch请求: ${url} -> ${fixedUrl}`);
    return originalFetch.call(this, fixedUrl, options);
  };
  
  // 拦截XMLHttpRequest
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    const fixedUrl = fixUrl(url);
    console.log(`拦截XHR请求: ${url} -> ${fixedUrl}`);
    return originalXhrOpen.call(this, method, fixedUrl, async, user, password);
  };
  
  console.log('网络请求拦截器已启用');
};

export default {
  initNetworkInterceptor,
};
