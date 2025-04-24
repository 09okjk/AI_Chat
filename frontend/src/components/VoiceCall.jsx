import React, { useState, useRef } from 'react';
import { Button, Spin, Typography, Progress, Modal, message } from 'antd';
import { AudioOutlined, PauseCircleOutlined, PlayCircleOutlined, RedoOutlined } from '@ant-design/icons';
import { chatWithAI } from '../utils/api';
import { playBase64Audio } from '../utils/audio';

const MAX_RECORD_SECONDS = 30; // 最长录音时长

const VoiceCall = () => {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [aiAudio, setAiAudio] = useState(null);
  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // 开始录音
  const startRecording = async (e) => {
    setTranscript('');
    setAudioUrl(null);
    setAiAudio(null);
    setIsCancelling(false);
    setRecordingTime(0);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      Modal.error({
        title: '浏览器不支持',
        content: '当前浏览器不支持语音录制，请使用最新版 Chrome、Edge 或 Firefox，并确保在 https 或 localhost 环境下访问。'
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new window.MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        clearInterval(timerRef.current);
        setRecording(false);
        setShowAudioModal(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioUrl(URL.createObjectURL(audioBlob));
      };
      mediaRecorder.start();
      setRecording(true);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => {
          if (t + 1 >= MAX_RECORD_SECONDS) {
            stopRecording();
            message.info('已达到最长录音时长');
            return t;
          }
          return t + 1;
        });
      }, 1000);
    } catch (err) {
      setRecording(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        Modal.error({ title: '未获得麦克风权限', content: '请检查浏览器和系统设置，允许访问麦克风。' });
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        Modal.error({ title: '未检测到麦克风设备', content: '请插入或启用麦克风。' });
      } else {
        Modal.error({ title: '麦克风访问失败', content: err.message });
      }
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (recording) {
      setRecording(false);
      clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }
  };

  // 取消录音（滑动取消）
  const cancelRecording = () => {
    setIsCancelling(true);
    setRecording(false);
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setAudioUrl(null);
    setShowAudioModal(false);
    message.info('已取消录音');
  };

  // 发送录音到后端
  const sendAudio = () => {
    setShowAudioModal(false);
    setLoading(true);
    setTranscript('');
    setAiAudio(null);
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Audio = reader.result.split(',')[1];
      await chatWithAI({
        messages: [{ role: 'user', content: '[语音输入]' }],
        model: 'qwen2.5-omni-7b',
        modalities: ['text', 'audio'],
        audio: { voice: 'Ethan', format: 'wav' },
        user_audio: base64Audio,
        stream: true
      }, (chunk) => {
        try {
          const data = JSON.parse(chunk);
          if (data.text) setTranscript(t => t + data.text);
          if (data.audio) {
            setAiAudio(data.audio);
            playBase64Audio(data.audio);
          }
        } catch {}
      });
      setLoading(false);
    };
    reader.readAsDataURL(audioBlob);
  };

  // 试听录音
  const playRecordedAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '24px auto', padding: 24, background: '#fff', borderRadius: 8 }}>
      <Typography.Title level={4}>实时语音对话</Typography.Title>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button
          type={recording ? 'default' : 'primary'}
          icon={<AudioOutlined />}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={recording ? cancelRecording : undefined}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          onTouchCancel={cancelRecording}
          disabled={loading}
          style={{ transition: 'all 0.2s', background: recording ? '#f5222d' : undefined, color: recording ? '#fff' : undefined }}
        >{recording ? (isCancelling ? '已取消' : '松开结束') : '按住说话'}</Button>
        {recording && <span style={{ color: '#f5222d', marginLeft: 8 }}>● 正在录音... {recordingTime}s</span>}
        {loading && <Spin style={{ marginLeft: 16 }} />}
      </div>
      <Typography.Paragraph style={{ marginTop: 24 }}>
        <strong>AI回复：</strong> {transcript}
        {aiAudio && (
          <Button icon={<PlayCircleOutlined />} size="small" style={{ marginLeft: 8 }} onClick={() => playBase64Audio(aiAudio)}>
            播放AI语音
          </Button>
        )}
      </Typography.Paragraph>
      <Modal
        open={showAudioModal}
        title="录音完成"
        onCancel={() => setShowAudioModal(false)}
        footer={[
          <Button key="retry" icon={<RedoOutlined />} onClick={() => { setShowAudioModal(false); setTimeout(() => startRecording(), 200); }}>重录</Button>,
          <Button key="play" icon={<PlayCircleOutlined />} onClick={playRecordedAudio} disabled={!audioUrl}>试听</Button>,
          <Button key="send" type="primary" icon={<PauseCircleOutlined />} onClick={sendAudio}>发送</Button>,
        ]}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <audio src={audioUrl} controls style={{ width: '100%' }} />
        </div>
      </Modal>
    </div>
  );
};

export default VoiceCall;
