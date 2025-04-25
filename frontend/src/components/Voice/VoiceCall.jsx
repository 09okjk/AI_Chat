import React, { useState } from 'react';
import { playPcmChunk, stopPCMPlayback } from '../../hooks/usePcmAudioPlayer';
import VoiceVisualizer from './VoiceVisualizer';
import VoiceCallLayout from './VoiceCallLayout';
import VoiceCallControls from './VoiceCallControls';
import AudioDropUpload from '../AudioDropUpload';
import VoiceCallToolbar from './VoiceCallToolbar';
import VoiceCallAIReply from './VoiceCallAIReply';
import VoiceCallModal from './VoiceCallModal';
import AILogPanel from '../AILogPanel';
import useVoiceCallState from './useVoiceCallState';
import useVoiceCallLogic from './useVoiceCallLogic';

const VoiceCall = () => {
  // 统一管理所有状态
  const state = useVoiceCallState('Chelsie');
  const logic = useVoiceCallLogic(state);
  const [isPlaying, setIsPlaying] = useState(false);
  const [aiAudioBuffer, setAiAudioBuffer] = useState([]); // 用于保存AI完整音频

  const {
    VOICES, voice, setVoice,
    logs,
    recording, setRecording,
    transcript, setTranscript,
    recordingTime, setRecordingTime,
    audioUrl, setAudioUrl,
    showAudioModal, setShowAudioModal,
    isCancelling, setIsCancelling,
    aiAudio, setAiAudio,
    aiThinking, setAiThinking,
    showLog, setShowLog,
    timerRef, mediaRecorderRef, audioChunksRef, mediaStreamRef
  } = state;
  const {
    toggleRecording, stopRecording, cancelRecording,
    sendAudio, playRecordedAudio, simulateAIReply, testAPI
  } = logic;

  // 环境信息
  const envInfo = {
    apiBase: process.env.REACT_APP_API_BASE,
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    browser: navigator.userAgent,
  };

  // 停止AI语音播放
  const handleStopPlayback = () => {
    stopPCMPlayback();
    setIsPlaying(false);
  };

  // 下载AI完整语音
  const handleDownloadAIAudio = () => {
    if (!aiAudioBuffer.length) return;
    // 合并base64，转为blob
    const mergedBase64 = aiAudioBuffer.join('');
    const byteString = atob(mergedBase64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai_reply.wav';
    a.click();
    URL.revokeObjectURL(url);
  };

  // AI语音播放时收集buffer
  const handleAIChunk = (chunk) => {
    setAiAudioBuffer(prev => [...prev, chunk]);
  };

  return (
    <VoiceCallLayout>
      <h2 style={{ marginBottom: 28, textAlign: 'center', letterSpacing: 2, fontWeight: 700 }}>实时语音对话</h2>
      {/* 音律动画 */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <VoiceVisualizer isPlaying={isPlaying} />
      </div>
      {/* 播放/停止/下载按钮 */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        {isPlaying ? (
          <button onClick={handleStopPlayback} style={{ marginRight: 8 }}>停止播放</button>
        ) : null}
        {aiAudioBuffer.length > 0 && (
          <button onClick={handleDownloadAIAudio}>下载AI语音</button>
        )}
      </div>
      <VoiceCallControls
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
        voice={voice}
        setVoice={setVoice}
        VOICES={VOICES}
        onUpload={sendAudio}
      />
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <AudioDropUpload onUpload={sendAudio} />
      </div>
      <VoiceCallToolbar
        onSimulate={simulateAIReply}
        onTestAPI={testAPI}
        showLog={showLog}
        onToggleLog={() => setShowLog(s => !s)}
      />
      <div style={{ borderTop: '1px solid #f0f0f0', margin: '18px 0 28px 0' }} />
      <VoiceCallAIReply
        transcript={transcript}
        aiThinking={aiThinking}
        aiAudio={aiAudio}
        onPlayAudio={() => playPcmChunk(aiAudio, 24000)}
      />
      <VoiceCallModal
        open={showAudioModal}
        audioUrl={audioUrl}
        onCancel={() => setShowAudioModal(false)}
        onRetry={() => { setShowAudioModal(false); setTimeout(() => toggleRecording(), 200); }}
        onPlay={playRecordedAudio}
        onSend={ () => sendAudio( audioUrl )}
      />
      <div style={{ marginTop: 36 }}>
        <AILogPanel logs={logs} envInfo={envInfo} showLog={showLog} />
      </div>
    </VoiceCallLayout>
  );
};

export default VoiceCall;
