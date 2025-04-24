import React from 'react';

export default function AILogPanel({ logs, envInfo, showLog }) {
  if (!showLog) return null;
  return (
    <div style={{ background: '#f6f6f6', marginTop: 24, borderRadius: 6, padding: 12, fontSize: 13 }}>
      <div style={{ marginBottom: 8 }}>【调试日志】</div>
      <div style={{ maxHeight: 180, overflow: 'auto', fontFamily: 'monospace' }}>
        {logs.length === 0 ? <div>暂无日志</div> : logs.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      <div style={{ marginTop: 8, color: '#888' }}>【环境信息】API: {envInfo.apiBase} | Host: {envInfo.hostname} | {envInfo.protocol} | {envInfo.browser}</div>
    </div>
  );
}
