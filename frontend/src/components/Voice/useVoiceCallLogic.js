import React from 'react';
import { message, Modal } from 'antd';
import { chatWithAI } from '../../utils/api';
import { playPcmChunk, stopAllAudio } from '../../hooks/usePcmAudioPlayer';

export default function useVoiceCallLogic(state) {
  const {
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
  } = state;

  // 日志追加
  function appendLog(msg, data) {
    let safeData = '';
    if (data !== undefined) {
      try {
        safeData = `: ${JSON.stringify(data)}`;
      } catch (e) {
        if (typeof data === 'object') {
          safeData = `: [object ${data.constructor && data.constructor.name ? data.constructor.name : 'Object'}]`;
        } else {
          safeData = `: [Unserializable data]`;
        }
      }
    }
    setLogs(logs => [...logs, `[${new Date().toLocaleTimeString()}] ${msg}${safeData}`]);
  }

  // 切换录音（点击一次开始，再次点击结束）
  async function toggleRecording() {
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
            if (t + 1 >= 30) {
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
  }

  // 停止录音
  function stopRecording() {
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
  }

  // 取消录音
  function cancelRecording() {
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
  }

  // 发送音频
  function sendAudio(audioUrlOrBase64 = null, extType = 'wav') {
    setShowAudioModal(false);
    setLoading(true);
    setAiThinking(true);
    setTranscript('');
    setAiAudio(null);
    setAiAudioChunks([]);
    appendLog('发送音频到AI');

    if (audioUrlOrBase64) {
      // 如果传的是 audioUrl (Blob URL)，先 fetch 转为 Blob
      if (audioUrlOrBase64.startsWith('blob:')) {
        appendLog('音频是 Blob URL，转换为 Blob');
        fetch(audioUrlOrBase64)
          .then(res => res.blob())
          .then(blob => {
            const reader = new FileReader();
            reader.onload = function () {
              const base64Body = reader.result.split(',')[1];
              const fullBase64 = `data:audio/wav;base64,${base64Body}`;
              callAIWithAudio(fullBase64, 'wav');
            };
            reader.readAsDataURL(blob);
          });
        return;
      }
      // 如果传的是 base64，直接上传
      if (audioUrlOrBase64.startsWith('data:audio/')) {
        callAIWithAudio(audioUrlOrBase64, extType);
        return;
      }
    }

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
    const reader = new FileReader();
    reader.onload = function () {
      const base64Body = reader.result.split(',')[1];
      const fullBase64 = `data:audio/wav;base64,${base64Body}`;
      callAIWithAudio(fullBase64, 'wav');
    };
    reader.readAsDataURL(audioBlob);
  }

  // 语种检测
  function detectLang(text) {
    if (!text) return null;
    const zhReg = /[\u4e00-\u9fa5]/;
    const enReg = /[a-zA-Z]/;
    if (zhReg.test(text)) return 'zh';
    if (enReg.test(text)) return 'en';
    return null;
  }

  // 队列定义
  const audioInputQueue = React.useRef([]);
  const decodeWorkerRunning = React.useRef(false);

  // 动态缓冲区方案：优先保证播放平滑，动态判断队列长度
  React.useEffect(() => {
    if (decodeWorkerRunning.current) return;
    decodeWorkerRunning.current = true;
    let cancelled = false;
    const chunkBuffer = { current: [] };
    const MIN_BUFFER = 8;  // 播放前至少缓冲8个片段（可根据体验调整）
    const MAX_MERGE = 12;  // 单次最多合并播放12个片段
    const MIN_MERGE = 4;   // 单次最少合并4个片段
    async function decodeWorker() {
      while (!cancelled) {
        // 1. 如果缓冲区足够，合并一批片段播放
        if (audioInputQueue.current.length >= MIN_BUFFER) {
          let mergeCount = Math.min(audioInputQueue.current.length, MAX_MERGE);
          for (let i = 0; i < mergeCount; i++) {
            chunkBuffer.current.push(audioInputQueue.current.shift());
          }
          const merged = chunkBuffer.current.join('');
          try {
            await playPcmChunk(merged, 24000);
            appendLog(`动态缓冲区合并${mergeCount}段已播放`);
          } catch (e) {
            appendLog('动态缓冲区合并片段播放失败', e);
          }
          chunkBuffer.current = [];
        }
        // 2. 如果缓冲区有少量片段但未达到MIN_BUFFER，等待一会儿再判断
        else if (audioInputQueue.current.length >= MIN_MERGE) {
          // 等待50ms看是否能补齐到MIN_BUFFER
          await new Promise(r => setTimeout(r, 50));
        }
        // 3. 如果队列空或只剩1~3个片段，等一会儿后直接播放剩余片段，避免尾部丢失
        else if (audioInputQueue.current.length > 0) {
          // 等待100ms，若还未补齐，则直接播放剩余片段
          await new Promise(r => setTimeout(r, 100));
          if (audioInputQueue.current.length > 0) {
            while (audioInputQueue.current.length > 0) {
              chunkBuffer.current.push(audioInputQueue.current.shift());
            }
            const merged = chunkBuffer.current.join('');
            try {
              await playPcmChunk(merged, 24000);
              appendLog('动态缓冲区末尾残留片段已播放');
            } catch (e) {
              appendLog('动态缓冲区末尾残留片段播放失败', e);
            }
            chunkBuffer.current = [];
          }
        } else {
          // 队列完全空，短暂休眠
          await new Promise(r => setTimeout(r, 10));
        }
      }
    }
    decodeWorker();
    return () => { cancelled = true; decodeWorkerRunning.current = false; };
  }, []);



  // AI接口调用
  async function callAIWithAudio(base64Audio, extType) {
    const audioMsg = {
      type: "input_audio",
      input_audio: {
        data: base64Audio,
        format: extType
      }
    };
    let queryText = transcript;
    if (!queryText) queryText = '';
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
        if (data.choices && Array.isArray(data.choices)) {
          for (const choice of data.choices) {
            if (choice.delta && choice.delta.audio) {
              if (typeof choice.delta.audio.data === 'string' && choice.delta.audio.data.length > 0) {
                audioInputQueue.current.push(choice.delta.audio.data);
                appendLog('AI音频片已入解析队列');
              }
              if (typeof choice.delta.audio.transcript === 'string' && choice.delta.audio.transcript.length > 0) {
                setTranscript(t => t + choice.delta.audio.transcript);
                appendLog('AI文本片', choice.delta.audio.transcript);
              }
            }
            if (choice.delta && typeof choice.delta.text === 'string') {
              setTranscript(t => t + choice.delta.text);
              appendLog('AI文本片', choice.delta.text);
            }
          }
        }
        if (data.response && typeof data.response.audio === 'string' && data.response.audio.length > 100) {
          setAiAudio(data.response.audio); // 只保存完整音频，供试听用，不自动播放
          appendLog('AI音频已保存(response)');
        }
        if (data.finish_reason === 'stop' || data.done === true) {
          setAiAudioChunks([]); // 播放完毕，清空片段
        }
      } catch (e) {
        appendLog('AI流解析失败', e);
      }
      setLoading(false);
      setAiThinking(false);
    });
  }

  // 试听录音
  function playRecordedAudio() {
    if (audioUrl) {
      const audio = new window.Audio(audioUrl);
      audio.play();
    }
  }

  // 模拟AI回复
  function simulateAIReply() {
    setTranscript('这是模拟的AI文本回复。');
    setAiAudio(null);
    setAiAudioChunks([]);
    setPendingPcmChunks([]);
  }

  // 接口连通性测试
  function testAPI() {
    appendLog('接口连通性测试', { apiBase: process.env.REACT_APP_API_BASE });
    message.success('接口连通性测试成功！');
  }
  
  // 停止AI回复 - 清空队列并停止音频播放
  function stopAIReply() {
    // 清空音频输入队列
    if (audioInputQueue.current && audioInputQueue.current.length > 0) {
      appendLog(`清空音频队列，清除${audioInputQueue.current.length}个片段`);
      audioInputQueue.current = [];
    }
    
    // 停止所有正在播放的音频
    stopAllAudio();
    appendLog('已停止AI音频回复');
    message.success('已停止AI回复');
    
    // 重置状态
    setAiThinking(false);
    setLoading(false);
  }

  return {
    appendLog, toggleRecording, stopRecording, cancelRecording,
    sendAudio, callAIWithAudio, detectLang,
    playRecordedAudio, simulateAIReply, testAPI, stopAIReply
  };
}
