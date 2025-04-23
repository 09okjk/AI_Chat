import React, { useState, useRef } from 'react';
import { Button, Spin, Typography } from 'antd';
import { AudioOutlined } from '@ant-design/icons';
import { chatWithAI } from '../utils/api';
import { playBase64Audio } from '../utils/audio';

const VoiceCall = () => {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // 简单语音识别（可换为更强的API）
  const startRecording = async () => {
    setTranscript('');
    setRecording(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new window.MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];
    mediaRecorder.ondataavailable = (e) => {
      audioChunksRef.current.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      setLoading(true);
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      // 发送音频给后端（此处为简化流程，实际可用更优方案）
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = reader.result.split(',')[1];
        // 这里假设后端支持音频base64输入，实际可扩展为音频转文字后再发给AI
        await chatWithAI({
          messages: [{ role: 'user', content: '[语音输入]' }],
          model: 'qwen2.5-omni-7b',
          modalities: ['text', 'audio'],
          audio: { voice: 'Ethan', format: 'wav' },
          user_audio: base64Audio,
          stream: true
        }, (chunk) => {
          // 假设chunk为json字符串，含text和audio
          try {
            const data = JSON.parse(chunk);
            if (data.text) setTranscript(t => t + data.text);
            if (data.audio) playBase64Audio(data.audio);
          } catch {}
        });
        setLoading(false);
      };
      reader.readAsDataURL(audioBlob);
    };
    mediaRecorder.start();
  };

  const stopRecording = () => {
    setRecording(false);
    mediaRecorderRef.current && mediaRecorderRef.current.stop();
  };

  return (
    <div style={{ maxWidth: 600, margin: '24px auto', padding: 24, background: '#fff', borderRadius: 8 }}>
      <Typography.Title level={4}>实时语音对话</Typography.Title>
      <Button
        type={recording ? 'default' : 'primary'}
        icon={<AudioOutlined />}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={loading}
        style={{ marginBottom: 16 }}
      >{recording ? '松开结束' : '按住说话'}</Button>
      {loading && <Spin style={{ marginLeft: 16 }} />}
      <Typography.Paragraph style={{ marginTop: 24 }}>
        <strong>AI回复：</strong> {transcript}
      </Typography.Paragraph>
    </div>
  );
};

export default VoiceCall;
