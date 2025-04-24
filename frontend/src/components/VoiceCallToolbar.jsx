import React from 'react';
import { Button } from 'antd';

export default function VoiceCallToolbar({
  onSimulate, onTestAPI, showLog, onToggleLog
}) {
  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 18 }}>
      <Button size="small" onClick={onSimulate}>模拟AI回复</Button>
      <Button size="small" onClick={onTestAPI}>接口连通性测试</Button>
      <Button size="small" onClick={onToggleLog}>{showLog ? '隐藏日志' : '显示日志'}</Button>
    </div>
  );
}
