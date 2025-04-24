import React, { useState, useRef } from 'react';
import { Button, Spin, Typography, Modal, message } from 'antd';
import { chatWithAI } from '../utils/api';
import { usePcmAudioPlayer } from '../hooks/usePcmAudioPlayer';
import VoiceRecorder from './VoiceRecorder';
import AudioUpload from './AudioUpload';
import AILogPanel from './AILogPanel';
import { PlayCircleOutlined, RedoOutlined, PauseCircleOutlined } from '@ant-design/icons';

const MAX_RECORD_SECONDS = 30;

const { Select } = require('antd');

const VoiceCall = () => {
  // 音色选择，开源版支持 Ethan 和 Chelsie
  const VOICES = ["Ethan", "Chelsie"];
  const [voice, setVoice] = useState("Ethan");
  // 需要的 React 状态和引用全部补齐（不要删除下面的任何一行）
  const [pendingPcmChunks, setPendingPcmChunks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [aiAudio, setAiAudio] = useState(null);
  const [aiAudioChunks, setAiAudioChunks] = useState([]);
  const [aiThinking, setAiThinking] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  // 流式PCM自动拼接播放（已抽离为hook）
  usePcmAudioPlayer(pendingPcmChunks, setPendingPcmChunks);

  // 环境信息
  const envInfo = {
    apiBase: process.env.REACT_APP_API_BASE,
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    browser: navigator.userAgent,
  };

  const appendLog = (msg, data) => {
    setLogs(logs => [...logs, `[${new Date().toLocaleTimeString()}] ${msg}` + (data !== undefined ? `: ${JSON.stringify(data)}` : '')]);
  };


  // 切换录音（点击一次开始，再次点击结束）
  const toggleRecording = async () => {
    if (recording) {
      stopRecording();
    } else {
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
        mediaStreamRef.current = stream;
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
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (!recording) return;
    setRecording(false);
    clearInterval(timerRef.current);
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } catch (e) {
      // 忽略多次 stop 报错
    }
    // 关闭麦克风
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  // 取消录音（滑动取消）
  const cancelRecording = () => {
    setIsCancelling(true);
    setRecording(false);
    clearInterval(timerRef.current);
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } catch (e) {}
    setAudioUrl(null);
    setShowAudioModal(false);
    message.info('已取消录音');
  };


  // 发送录音或上传音频到后端
  const sendAudio = (externalBase64 = null, extType = 'wav') => {
    setShowAudioModal(false);
    setLoading(true);
    setAiThinking(true);
    setTranscript('');
    setAiAudio(null);
    appendLog('发送音频到AI');
    if (externalBase64) {
      callAIWithAudio(externalBase64, extType);
      return;
    }
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
    const reader = new FileReader();
    reader.onload = function () {
      const base64Body = reader.result.split(',')[1];
      const fullBase64 = `data:audio/wav;base64,${base64Body}`;
      callAIWithAudio(fullBase64, 'wav');
    };
    reader.readAsDataURL(audioBlob);
  };

  // 统一调用AI接口
  // 简单语种检测（仅区分中/英）
  function detectLang(text) {
    if (!text) return null;
    const zhReg = /[\u4e00-\u9fa5]/;
    const enReg = /[a-zA-Z]/;
    if (zhReg.test(text)) return 'zh';
    if (enReg.test(text)) return 'en';
    return null;
  }

  const callAIWithAudio = async (base64Audio, extType) => {
    // 按官方格式组织payload
    const audioMsg = {
      type: "input_audio",
      input_audio: {
        data: base64Audio,
        format: extType
      }
    };
    // 自定义文本内容（优先用 transcript，否则自动语种检测，否则默认）
    let queryText = transcript;
    if (!queryText) {
      // 录音刚结束时 transcript 为空，尝试 fallback
      queryText = '';
    }
    let lang = detectLang(queryText);
    let prompt;
    if (lang === 'zh') {
      prompt = '请帮我识别这段中文语音内容';
    } else if (lang === 'en') {
      prompt = 'Please help me recognize this English audio.';
    } else {
      prompt = '请帮我识别音频内容';
    }
    const textMsg = { type: "text", text: queryText || prompt };
    await chatWithAI({
      messages: [{ role: 'user', content: [audioMsg, textMsg] }],
      model: 'qwen2.5-omni-7b',
      modalities: ['text', 'audio'],
      audio: { voice, format: extType },
      stream: true
    }, (data) => {
      appendLog('收到AI流', data);
      try {
        let text = '';
        // 边到边处理音频和文字分片
        if (data.choices && Array.isArray(data.choices)) {
          for (const choice of data.choices) {
            if (choice.delta && choice.delta.audio) {
              // 1. 播放每一片音频（优先用PCM播放，彻底兼容裸PCM分片）
              if (typeof choice.delta.audio.data === 'string' && choice.delta.audio.data.length > 0) {
                setAiAudioChunks(chunks => [...chunks, choice.delta.audio.data]);
                setPendingPcmChunks(chunks => [...chunks, choice.delta.audio.data]); // 收到就缓存
                appendLog('AI音频片已收集并缓存待播放');
              }
              // 2. 展示每一片文字
              if (typeof choice.delta.audio.transcript === 'string' && choice.delta.audio.transcript.length > 0) {
                setTranscript(t => t + choice.delta.audio.transcript);
                appendLog('AI文本片', choice.delta.audio.transcript);
              }
            }
            // 兼容旧结构的文本分片
            if (choice.delta && typeof choice.delta.text === 'string') {
              setTranscript(t => t + choice.delta.text);
              appendLog('AI文本片', choice.delta.text);
            }
          }
        }
        // 兼容 response.audio 形式（极少出现，保留）
        if (data.response && typeof data.response.audio === 'string' && data.response.audio.length > 100) {
          playPcmChunk(data.response.audio, 24000);
          setAiAudio(data.response.audio);
          appendLog('AI音频已播放(response)');
        }
      } catch (e) {
        appendLog('AI流解析失败', e);
      }
    });
    // 流式结束后，拼接所有分片为完整PCM
    setTimeout(() => {
      if (aiAudioChunks.length > 0) {
        const fullPcm = aiAudioChunks.join('');
        setAiAudio(fullPcm);
        setAiAudioChunks([]);
        appendLog('AI音频已拼接并可播放');
      }
      setLoading(false);
      setAiThinking(false);
    }, 200); // 等待分片全部收集完毕
  };

  // 一键模拟AI回复（用于测试）
  const simulateAIReply = () => {
    setTranscript('');
    setAiAudio(null);
    setAiThinking(true);
    setTimeout(() => {
      setTranscript('这是模拟的AI回复内容。');
      setAiThinking(false);
      appendLog('模拟AI文本回复');
    }, 1200);
    setTimeout(() => {
      setAiAudio(null);
      appendLog('模拟AI音频回复');
    }, 1800);
  };

  // 一键测试接口连通性
  const testAPI = async () => {
    appendLog('测试API连通性...');
    try {
      const res = await fetch(envInfo.apiBase + '/ping');
      const data = await res.json();
      message.success('API连通性正常: ' + JSON.stringify(data));
      appendLog('API连通性正常', data);
    } catch (e) {
      message.error('API连通性异常: ' + e.message);
      appendLog('API连通性异常', e.message);
    }
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
      {/* 顶部状态栏 */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        {recording && <span style={{ color: '#f5222d' }}>正在录音...</span>}
        {loading && <span style={{ color: '#1890ff' }}>AI正在思考...</span>}
        {aiThinking && !loading && <span style={{ color: '#1890ff' }}>AI正在输入...</span>}
      </div>
      <Typography.Title level={4}>实时语音对话</Typography.Title>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <VoiceRecorder
          recording={recording}
          setRecording={setRecording}
          setTranscript={setTranscript}
          setAudioUrl={setAudioUrl}
          setShowAudioModal={setShowAudioModal}
          setAiAudio={setAiAudio}
          setIsCancelling={setIsCancelling}
          setRecordingTime={setRecordingTime}
          timerRef={timerRef}
          mediaRecorderRef={mediaRecorderRef}
          audioChunksRef={audioChunksRef}
          mediaStreamRef={mediaStreamRef}
        />
        <Select
          value={voice}
          style={{ width: 120 }}
          onChange={setVoice}
          options={VOICES.map(v => ({ value: v, label: v }))}
        />
        <AudioUpload onUpload={sendAudio} />
        <Button size="small" onClick={simulateAIReply} style={{ marginLeft: 12 }}>模拟AI回复</Button>
        <Button size="small" onClick={testAPI}>接口连通性测试</Button>
        <Button size="small" onClick={() => setShowLog(s => !s)}>{showLog ? '隐藏日志' : '显示日志'}</Button>
      </div>
      <Typography.Paragraph style={{ marginTop: 24 }}>
        <strong>AI回复：</strong> <span style={{ whiteSpace: 'pre-wrap' }}>{transcript}</span>
        {aiThinking && <Spin size="small" style={{ marginLeft: 8 }} />}
        {transcript && <Button size="small" style={{ marginLeft: 8 }} onClick={() => {navigator.clipboard.writeText(transcript); message.success('已复制AI回复');}}>复制</Button>}
        {aiAudio && (
          <Button icon={<PlayCircleOutlined />} size="small" style={{ marginLeft: 8 }} onClick={() => playPcmChunk(aiAudio, 24000)}>
            播放AI语音
          </Button>
        )}
      </Typography.Paragraph>
      <Modal
        open={showAudioModal}
        title="录音完成"
        onCancel={() => setShowAudioModal(false)}
        footer={[
          <Button key="retry" icon={<RedoOutlined />} onClick={() => { setShowAudioModal(false); setTimeout(() => toggleRecording(), 200); }}>重录</Button>,
          <Button key="play" icon={<PlayCircleOutlined />} onClick={playRecordedAudio} disabled={!audioUrl}>试听</Button>,
          <Button key="send" type="primary" icon={<PauseCircleOutlined />} onClick={sendAudio}>发送</Button>,
        ]}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <audio src={audioUrl} controls style={{ width: '100%' }} />
        </div>
      </Modal>

      {/* 调试日志区和环境信息 */}
      <AILogPanel logs={logs} envInfo={envInfo} showLog={showLog} />
    </div>
  );
}

export default VoiceCall;
