import React from 'react';

export default function VoiceCallLayout({
  children
}) {
  return (
    <div style={{ maxWidth: 700, margin: '40px auto', background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #e9e9e9', padding: '36px 32px' }}>
      {children}
    </div>
  );
}
