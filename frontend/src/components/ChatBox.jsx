import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, List, Typography, Spin } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { chatWithAI, getConfig } from '../utils/directApiClient';

const { TextArea } = Input;

const ChatBox = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelConfig, setModelConfig] = useState(null);
  const chatEndRef = useRef(null);
  
  // 组件加载时获取配置
  useEffect(() => {
    async function fetchConfig() {
      try {
        const config = await getConfig();
        setModelConfig(config);
        console.log('ChatBox 已加载模型配置:', config);
      } catch (error) {
        console.error('加载配置失败:', error);
      }
    }
    fetchConfig();
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMsg = { role: 'user', content: input };
    setMessages([...messages, newMsg]);
    setInput('');
    setLoading(true);
    let aiMsg = { role: 'assistant', content: '' };
    setMessages(msgs => [...msgs, aiMsg]);
    
    try {
      await chatWithAI({
        messages: [...messages, newMsg],
        model: modelConfig?.model || 'qwen2.5-omni-7b', // 使用从后端获取的模型名称，有fallback
        modalities: ['text'],
        stream: true
      }, (data) => {
        // 如果收到[DONE]标记或者空数据，忽略
        if (data === '[DONE]' || !data) return;
        
        let text = '';
        
        // 处理标准 OpenAI 格式的流式响应
        if (data.choices && Array.isArray(data.choices)) {
          for (const choice of data.choices) {
            // 处理delta格式（流式标准）
            if (choice.delta && typeof choice.delta === 'object') {
              // 新的SSE格式中，内容在delta.content中
              if (typeof choice.delta.content === 'string') {
                text += choice.delta.content;
                console.log('[ChatBox] 收到delta.content:', choice.delta.content);
              }
              // 兼容旧格式
              else if (typeof choice.delta.text === 'string') {
                text += choice.delta.text;
              }
              // 处理语音转文字
              if (choice.delta.audio && typeof choice.delta.audio.transcript === 'string') {
                text += choice.delta.audio.transcript;
              }
            }
            // 处理message格式（非流式）
            else if (choice.message && typeof choice.message.content === 'string') {
              text += choice.message.content;
            }
          }
        }
        
        // 兼容其他API格式
        if (!text && typeof data.text === 'string') text = data.text;
        if (!text && data.response && typeof data.response.text === 'string') text = data.response.text;
        
        // 只有实际有内容时才更新UI，避免无效更新
        if (text) {
          aiMsg.content += text;
          setMessages(msgs => {
            const copy = [...msgs];
            copy[copy.length - 1] = { ...aiMsg };
            return copy;
          });
          // 滚动到底部
          setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        }
      });
    } catch (error) {
      console.error('聊天请求失败:', error);
      // 添加出错提示
      setMessages(msgs => {
        const copy = [...msgs];
        const lastMsg = copy[copy.length - 1];
        if (lastMsg.role === 'assistant' && !lastMsg.content) {
          copy[copy.length - 1] = { ...lastMsg, content: '请求失败，请稍后重试。' };
        }
        return copy;
      });
    } finally {
      setLoading(false);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24, background: '#fff', borderRadius: 8 }}>
      <List
        size="small"
        dataSource={messages}
        renderItem={item => (
          <List.Item>
            <Typography.Text strong={item.role === 'user'}>{item.role === 'user' ? '我' : 'AI'}：</Typography.Text> {item.content}
          </List.Item>
        )}
      />
      <div ref={chatEndRef} />
      <TextArea
        rows={2}
        value={input}
        onChange={e => setInput(e.target.value)}
        onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleSend(); } }}
        placeholder="请输入问题..."
        disabled={loading}
        style={{ marginTop: 16 }}
      />
      <Button
        type="primary"
        icon={<SendOutlined />}
        onClick={handleSend}
        loading={loading}
        style={{ marginTop: 8, float: 'right' }}
      >发送</Button>
      <div style={{ clear: 'both' }} />
      {loading && <Spin style={{ marginTop: 8 }} />}
    </div>
  );
};

export default ChatBox;
