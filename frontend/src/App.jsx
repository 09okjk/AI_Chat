import React from 'react';
import { Tabs, Layout } from 'antd';
import ChatBox from './components/ChatBox';
import VoiceCall from './components/Voice/VoiceCall';
import VideoCall from './components/VideoCall';
import 'antd/dist/reset.css';

const { Header, Content } = Layout;

function App() {
  // 使用items属性替代TabPane
  const tabItems = [
    {
      key: 'chat',
      label: '文字对话',
      children: <ChatBox />
    },
    {
      key: 'voice',
      label: '实时语音',
      children: <VoiceCall />
    },
    {
      key: 'video',
      label: '单向视频',
      children: <VideoCall />
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{ color: '#fff', fontSize: 24 }}>AI 智能助手</Header>
      <Content style={{ padding: '32px 0' }}>
        <Tabs 
          defaultActiveKey="chat" 
          items={tabItems}
          centered 
          style={{ maxWidth: 700, margin: '0 auto' }} 
        />
      </Content>
    </Layout>
  );
}

export default App;
