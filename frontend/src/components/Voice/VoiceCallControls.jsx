import React from 'react';
import VoiceRecorder from './VoiceRecorder';
import { Select } from 'antd';
import AudioUpload from '../AudioUpload';

export default function VoiceCallControls({
  recording, setRecording, setTranscript, setAudioUrl, setShowAudioModal,
  setAiAudio, setIsCancelling, setRecordingTime, timerRef, mediaRecorderRef,
  audioChunksRef, mediaStreamRef, voice, setVoice, VOICES, onUpload
}) {
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
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
        style={{ width: 130, fontWeight: 500 }}
        onChange={setVoice}
        options={VOICES.map(v => ({ value: v, label: v }))}
      />
      <AudioUpload onUpload={onUpload} />
    </div>
  );
}
