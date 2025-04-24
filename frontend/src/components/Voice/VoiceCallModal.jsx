import React from 'react';
import { Modal, Button } from 'antd';
import { RedoOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';

export default function VoiceCallModal({
  open,
  audioUrl,
  onCancel,
  onRetry,
  onPlay,
  onSend
}) {
  return (
    <Modal
      open={open}
      title="录音完成"
      onCancel={onCancel}
      footer={[
        <Button key="retry" icon={<RedoOutlined />} onClick={onRetry}>重录</Button>,
        <Button key="play" icon={<PlayCircleOutlined />} onClick={onPlay} disabled={!audioUrl}>试听</Button>,
        <Button key="send" type="primary" icon={<PauseCircleOutlined />} onClick={() => onSend()}>发送</Button>,
      ]}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <audio src={audioUrl} controls style={{ width: '100%' }} />
      </div>
    </Modal>
  );
}
