import React from 'react';
import { Tabs, Layout } from 'antd';
import ChatBox from './components/ChatBox';
import VoiceCall from './components/VoiceCall';
import VideoCall from './components/VideoCall';
import 'antd/dist/reset.css';

const { Header, Content } = Layout;

function App() {
  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{ color: '#fff', fontSize: 24 }}>AI 智能助手</Header>
      <Content style={{ padding: '32px 0' }}>
        <Tabs defaultActiveKey="chat" centered style={{ maxWidth: 700, margin: '0 auto' }}>
          <Tabs.TabPane tab="文字对话" key="chat">
            <ChatBox />
          </Tabs.TabPane>
          <Tabs.TabPane tab="实时语音" key="voice">
            <VoiceCall />
          </Tabs.TabPane>
          <Tabs.TabPane tab="单向视频" key="video">
            <VideoCall />
          </Tabs.TabPane>
        </Tabs>
      </Content>
    </Layout>
  );
}

export default App;
