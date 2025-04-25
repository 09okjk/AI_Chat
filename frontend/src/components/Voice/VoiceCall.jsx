import React, { useState } from 'react';
import { playPcmChunk } from '../../hooks/usePcmAudioPlayer';
import AIAudioWave from './AIAudioWave';
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
  const [aiPlaying, setAiPlaying] = useState(false);
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
      {/* AI语音波浪动画与控制 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '16px 0' }}>
        <AIAudioWave playing={aiPlaying} />
        <VoiceCallAIReply
          transcript={transcript}
          aiThinking={aiThinking}
          aiAudio={aiAudio}
          onPlayAudio={async () => {
            setAiPlaying(true);
            await playPcmChunk(aiAudio, 24000);
            setTimeout(() => setAiPlaying(false), 1000); // 简单假定1s后动画结束
          }}
        />
        {/* 停止AI语音播放按钮 */}
        <button
          style={{ marginLeft: 4, padding: '4px 10px', background: '#ff7875', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
          onClick={() => {
            if (window._pcmAudioCtx) {
              window._pcmAudioCtx.close();
              window._pcmAudioCtx = null;
              window._pcmPlayCursor = 0;
            }
            setAiPlaying(false);
          }}
          disabled={!aiPlaying}
        >停止播放</button>
        {/* 下载AI语音按钮 */}
        <button
          style={{ marginLeft: 4, padding: '4px 10px', background: '#52c41a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
          disabled={!aiAudio}
          onClick={() => {
            if (!aiAudio) return;
            // base64 PCM转wav封装
            function pcmToWav(base64, sampleRate=24000) {
              const binary = atob(base64);
              const buf = new ArrayBuffer(binary.length);
              const view = new Uint8Array(buf);
              for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
              // wav头
              const wavHeader = (len, sampleRate) => {
                const header = new ArrayBuffer(44);
                const dv = new DataView(header);
                dv.setUint32(0, 0x52494646, false); // "RIFF"
                dv.setUint32(4, 36 + len, true);
                dv.setUint32(8, 0x57415645, false); // "WAVE"
                dv.setUint32(12, 0x666d7420, false); // "fmt "
                dv.setUint32(16, 16, true);
                dv.setUint16(20, 1, true);
                dv.setUint16(22, 1, true);
                dv.setUint32(24, sampleRate, true);
                dv.setUint32(28, sampleRate * 2, true);
                dv.setUint16(32, 2, true);
                dv.setUint16(34, 16, true);
                dv.setUint32(36, 0x64617461, false); // "data"
                dv.setUint32(40, len, true);
                return header;
              };
              const wav = new Uint8Array(44 + buf.byteLength);
              wav.set(new Uint8Array(wavHeader(buf.byteLength, sampleRate)), 0);
              wav.set(view, 44);
              return new Blob([wav], { type: 'audio/wav' });
            }
            const wavBlob = pcmToWav(aiAudio, 24000);
            const url = URL.createObjectURL(wavBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ai_reply.wav';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >下载AI语音</button>
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
