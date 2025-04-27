const fs = require('fs');
const yaml = require('js-yaml');

// 加载配置文件
function getConfig() {
  try {
    // 读取与Python后端相同的config.yaml文件
    const configPath = './config.yaml';
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents);
    
    // 确保必要的配置存在
    if (!config.api_key) {
      throw new Error('Missing api_key in config.yaml');
    }
    if (!config.base_url) {
      config.base_url = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    }
    if (!config.model) {
      config.model = 'qwen-omni-turbo';
    }
    
    return config;
  } catch (e) {
    console.error('Error loading config:', e);
    // 提供默认配置，实际使用时应当由用户提供API密钥
    return {
      base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      api_key: process.env.API_KEY || 'YOUR_API_KEY_HERE'
    };
  }
}

module.exports = getConfig();
