const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * 这个文件配置React开发服务器的代理
 * 当前端应用运行在开发模式时，它将自动代理API请求到正确的后端
 */
module.exports = function(app) {
  console.log('设置API代理 -> http://localhost:8016');
  
  // 代理所有/api路径的请求到后端服务器
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8016',
      changeOrigin: true,
      secure: false, // 不验证SSL证书
      pathRewrite: {
        '^/api': '/api', // 保持路径不变
      },
      // 日志记录
      logLevel: 'debug',
      onProxyReq: (proxyReq, req) => {
        console.log(`代理请求: ${req.method} ${req.url} -> http://localhost:8016${req.url}`);
      },
    })
  );
  
  // 代理WebSocket连接
  app.use(
    '/ws',
    createProxyMiddleware({
      target: 'ws://localhost:8016',
      ws: true,
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
    })
  );
};
