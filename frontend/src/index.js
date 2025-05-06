import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initNetworkInterceptor } from './utils/networkInterceptor';

// 初始化网络拦截器，修复所有网络请求
initNetworkInterceptor();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
