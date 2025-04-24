import { useRef, useState } from 'react';
import { Modal, message } from 'antd';

const MAX_RECORD_SECONDS = 30;

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);

  // 切换录音
  const toggleRecording = async () => {
    if (recording) {
      stopRecording();
    } else {
      setRecordingTime(0);
      setAudioUrl(null);
      setIsCancelling(false);
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
    } catch (e) {}
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  // 取消录音
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

  return {
    recording,
    recordingTime,
    audioUrl,
    showAudioModal,
    isCancelling,
    timerRef,
    mediaRecorderRef,
    audioChunksRef,
    mediaStreamRef,
    toggleRecording,
    stopRecording,
    cancelRecording,
    setShowAudioModal,
    setAudioUrl,
    setRecordingTime,
    setIsCancelling,
  };
}
