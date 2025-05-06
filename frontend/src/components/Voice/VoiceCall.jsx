import React from 'react';
import { playPcmChunk } from '../../hooks/usePcmAudioPlayer';
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
    sendAudio, playRecordedAudio, simulateAIReply, testAPI, stopAIReply
  } = logic;

  // 环境信息
  const envInfo = {
    apiBase: process.env.REACT_APP_API_BASE,
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    browser: navigator.userAgent,
  };

  return (
    <VoiceCallLayout>
      <h2 style={{ marginBottom: 28, textAlign: 'center', letterSpacing: 2, fontWeight: 700 }}>实时语音对话</h2>
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <VoiceCallAIReply
          transcript={transcript}
          aiThinking={aiThinking}
          aiAudio={aiAudio}
          onPlayAudio={() => playPcmChunk(aiAudio, 24000)}
        />
        {/* 停止按钮 - 仅在AI正在思考或返回有内容时显示 */}
        {(aiThinking || transcript) && (
          <button 
            onClick={stopAIReply}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              backgroundColor: '#ff4d4f',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500
            }}
          >
            停止AI回复
          </button>
        )}
      </div>
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
