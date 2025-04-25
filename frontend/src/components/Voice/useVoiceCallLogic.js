import { message, Modal } from 'antd';
import { chatWithAI } from '../../utils/api';
import { playPcmChunk } from '../../hooks/usePcmAudioPlayer';

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

  // AI接口调用 - 优化流式音频处理
  async function callAIWithAudio(base64Audio, extType) {
    // 清空现有状态
    setTranscript('');
    setAiAudio(null);
    setAiAudioChunks([]);
    setPendingPcmChunks([]);
    setAiThinking(true);
    setLoading(true);
    
    // 创建统计数据对象
    const stats = {
      audioChunksReceived: 0,
      textChunksReceived: 0,
      startTime: Date.now(),
      lastChunkTime: 0
    };
    
    // 音频消息构建
    const audioMsg = {
      type: "input_audio",
      input_audio: {
        data: base64Audio,
        format: extType
      }
    };
    
    // 文本提示准备
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
    
    // 开始请求
    appendLog('发送音频到AI', { voiceType: voice, format: extType });
    
    try {
      await chatWithAI({
        messages: [{ role: 'user', content: [audioMsg, textMsg] }],
        model: 'qwen2.5-omni-7b',
        modalities: ['text', 'audio'],
        audio: { voice, format: extType },
        stream: true
      }, (data) => {
        // 忽略空数据或[DONE]标记
        if (!data || data === '[DONE]') return;
        
        stats.lastChunkTime = Date.now();
        
        // 处理标准的选择格式
        if (data.choices && Array.isArray(data.choices)) {
          // 首次收到响应
          if (stats.audioChunksReceived === 0 && stats.textChunksReceived === 0) {
            appendLog('首次收到AI响应', { responseTime: Date.now() - stats.startTime });
          }
          
          for (const choice of data.choices) {
            // 处理音频增量
            if (choice.delta && choice.delta.audio) {
              // 处理音频数据
              if (typeof choice.delta.audio.data === 'string' && choice.delta.audio.data.length > 0) {
                stats.audioChunksReceived++;
                
                // 收集完整音频供稍后使用
                setAiAudioChunks(chunks => [...chunks, choice.delta.audio.data]);
                
                // 加入播放队列进行实时播放
                setPendingPcmChunks(chunks => [...chunks, choice.delta.audio.data]);
                
                // 定期记录统计信息
                if (stats.audioChunksReceived % 10 === 0) {
                  appendLog('AI音频流进度', { 
                    chunks: stats.audioChunksReceived,
                    elapsedMs: Date.now() - stats.startTime
                  });
                }
              }
              
              // 处理音频转写
              if (typeof choice.delta.audio.transcript === 'string' && choice.delta.audio.transcript.length > 0) {
                stats.textChunksReceived++;
                setTranscript(t => t + choice.delta.audio.transcript);
              }
            }
            
            // 处理纯文本增量
            if (choice.delta && choice.delta.content && typeof choice.delta.content === 'string') {
              stats.textChunksReceived++;
              setTranscript(t => t + choice.delta.content);
            } else if (choice.delta && typeof choice.delta.text === 'string') {
              // 兼容旧格式
              stats.textChunksReceived++;
              setTranscript(t => t + choice.delta.text);
            }
          }
        }
        
        // 处理非增量完整响应
        if (data.response) {
          // 保存完整音频以便后续播放
          if (typeof data.response.audio === 'string' && data.response.audio.length > 100) {
            setAiAudio(data.response.audio);
            appendLog('收到完整AI音频(response)');
          }
          
          // 保存完整转写文本
          if (typeof data.response.text === 'string' && data.response.text.length > 0) {
            setTranscript(data.response.text);
            appendLog('收到完整AI文本(response)');
          }
        }
        
        // 流结束处理
        if (data.finish_reason === 'stop' || data.done === true) {
          // 合并所有已收到的音频片段作为完整音频
          setAiAudioChunks(chunks => {
            if (chunks.length > 0) {
              const merged = chunks.join('');
              setAiAudio(merged);
              appendLog('流结束，合并所有音频片段', { totalChunks: chunks.length });
            }
            return [];
          });
          
          // 最终统计信息
          appendLog('AI回复完成', { 
            totalAudioChunks: stats.audioChunksReceived,
            totalTextChunks: stats.textChunksReceived,
            totalTimeMs: Date.now() - stats.startTime
          });
        }
      });
    } catch (e) {
      appendLog('AI流解析失败', e);
      setTranscript(t => t + '\n[音频处理出错，请重试]');
    } finally {
      setLoading(false);
      setAiThinking(false);
    }
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

  return {
    appendLog, toggleRecording, stopRecording, cancelRecording,
    sendAudio, callAIWithAudio, detectLang,
    playRecordedAudio, simulateAIReply, testAPI
  };
}
