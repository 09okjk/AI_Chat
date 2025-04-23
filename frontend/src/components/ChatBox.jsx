import React, { useState, useRef } from 'react';
import { Input, Button, List, Typography, Spin } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { chatWithAI } from '../utils/api';

const { TextArea } = Input;

const ChatBox = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMsg = { role: 'user', content: input };
    setMessages([...messages, newMsg]);
    setInput('');
    setLoading(true);
    let aiMsg = { role: 'assistant', content: '' };
    setMessages(msgs => [...msgs, aiMsg]);
    await chatWithAI({
      messages: [...messages, newMsg],
      model: 'qwen2.5-omni-7b',
      modalities: ['text'],
      stream: true
    }, (chunk) => {
      aiMsg.content += chunk;
      setMessages(msgs => {
        const copy = [...msgs];
        copy[copy.length - 1] = { ...aiMsg };
        return copy;
      });
    });
    setLoading(false);
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
