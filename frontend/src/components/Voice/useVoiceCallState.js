import { useState, useRef } from 'react';
import { usePcmAudioPlayer } from '../../hooks/usePcmAudioPlayer';

export default function useVoiceCallState(defaultVoice = 'Chelsie') {
  const VOICES = ["Ethan", "Chelsie"];
  const [voice, setVoice] = useState(defaultVoice);
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
  usePcmAudioPlayer(pendingPcmChunks, setPendingPcmChunks);
  return {
    VOICES, voice, setVoice,
    pendingPcmChunks, setPendingPcmChunks,
    logs, setLogs,
    recording, setRecording,
    loading, setLoading,
    transcript, setTranscript,
    recordingTime, setRecordingTime,
    audioUrl, setAudioUrl,
    showAudioModal, setShowAudioModal,
    isCancelling, setIsCancelling,
    aiAudio, setAiAudio,
    aiAudioChunks, setAiAudioChunks,
    aiThinking, setAiThinking,
    showLog, setShowLog,
    timerRef, mediaRecorderRef, audioChunksRef, mediaStreamRef
  };
}
