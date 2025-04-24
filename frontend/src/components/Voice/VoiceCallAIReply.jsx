import React from 'react';
import { Typography, Button, Spin, message } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';

export default function VoiceCallAIReply({ transcript, aiThinking, aiAudio, onPlayAudio }) {
  return (
    <Typography.Paragraph style={{ marginTop: 24 }}>
      <strong>AI回复：</strong> <span style={{ whiteSpace: 'pre-wrap' }}>{transcript}</span>
      {aiThinking && <Spin size="small" style={{ marginLeft: 8 }} />}
      {transcript && <Button size="small" style={{ marginLeft: 8 }} onClick={() => {navigator.clipboard.writeText(transcript); message.success('已复制AI回复');}}>复制</Button>}
      {aiAudio && (
        <Button icon={<PlayCircleOutlined />} size="small" style={{ marginLeft: 8 }} onClick={onPlayAudio}>
          播放AI语音
        </Button>
      )}
    </Typography.Paragraph>
  );
}
