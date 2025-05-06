import React, { useState, useEffect, useRef } from 'react';
import { Button, Card, Space, Typography, Badge, message } from 'antd';
import { PhoneOutlined, AudioOutlined, AudioMutedOutlined, LoadingOutlined } from '@ant-design/icons';
import useRealTimeVoiceCall from '../../hooks/useRealTimeVoiceCall';
import './RealTimeVoiceCall.css';

const { Title, Text, Paragraph } = Typography;

/**
 * 实时语音通话组件
 */
export default function RealTimeVoiceCall({ showLog = false }) {
  // 日志状态
  const [logs, setLogs] = useState([]);
  
  // 使用自定义钩子
  const voiceCall = useRealTimeVoiceCall(appendLog);
  
  // 显示详细日志
  function appendLog(msg, data) {
    let safeData = '';
    if (data !== undefined) {
      try {
        safeData = `: ${JSON.stringify(data)}`;
      } catch (e) {
        if (typeof data === 'object') {
          safeData = `: [object ${data.constructor && data.constructor.name ? data.constructor.name : 'Object'}]`;
        } else {
          safeData = `: [Unserializable data]`;
        }
      }
    }
    setLogs(logs => [...logs, `[${new Date().toLocaleTimeString()}] ${msg}${safeData}`]);
  }
  
  // 清空日志
  function clearLogs() {
    setLogs([]);
  }

  return (
    <div className="real-time-voice-call">
      <Card
        title={
          <Space>
            <PhoneOutlined />
            <span>AI实时语音通话</span>
            {voiceCall.isConnected && (
              <Badge status={voiceCall.isCallActive ? "processing" : "success"} text={voiceCall.isCallActive ? "通话中" : "已连接"} />
            )}
            {!voiceCall.isConnected && (
              <Badge status="error" text="未连接" />
            )}
          </Space>
        }
        extra={
          voiceCall.isCallActive ? (
            <Space>
              <Text type="secondary">{voiceCall.formatDuration(voiceCall.callDuration)}</Text>
              <Button 
                danger 
                type="primary" 
                icon={<AudioMutedOutlined />} 
                onClick={voiceCall.endCall}
              >
                结束通话
              </Button>
            </Space>
          ) : (
            <Button 
              type="primary" 
              icon={<AudioOutlined />} 
              loading={voiceCall.loading}
              disabled={!voiceCall.isConnected}
              onClick={voiceCall.startCall}
            >
              开始通话
            </Button>
          )
        }
      >
        <div className="call-content">
          {voiceCall.loading && !voiceCall.transcript && (
            <div className="ai-thinking">
              <LoadingOutlined spin /> <span>AI正在处理...</span>
            </div>
          )}
          
          {voiceCall.transcript ? (
            <div className="call-transcript">
              <Paragraph>{voiceCall.transcript}</Paragraph>
            </div>
          ) : (
            <div className="call-placeholder">
              {voiceCall.isCallActive ? (
                <Paragraph type="secondary">开始说话，AI将实时回应...</Paragraph>
              ) : (
                <Paragraph type="secondary">点击"开始通话"按钮开始与AI对话</Paragraph>
              )}
            </div>
          )}
        </div>
        
        {showLog && (
          <div className="call-logs">
            <div className="log-header">
              <Title level={5}>调试日志</Title>
              <Button size="small" onClick={clearLogs}>清空</Button>
            </div>
            <div className="log-content">
              {logs.map((log, index) => (
                <div key={index} className="log-item">{log}</div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
