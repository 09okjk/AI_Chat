import { useState, useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';
import { getConfig } from '../utils/api';
import { playPcmChunk, stopAllAudio } from './usePcmAudioPlayer';
import config from '../config';

// 获取WebSocket连接URL
const WS_BASE_URL = config.wsBaseUrl;
console.log('当前使用的WebSocket基础URL:', WS_BASE_URL);

/**
 * 实时语音通话钩子
 */
export default function useRealTimeVoiceCall(appendLog) {
  // 通话状态
  const [isConnected, setIsConnected] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [connectionId, setConnectionId] = useState(null);
  const [modelConfig, setModelConfig] = useState(null);
  const [callStartTime, setCallStartTime] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [audioInputQueue, setAudioInputQueue] = useState([]);

  // WebSocket 和音频相关参考
  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioProcessorRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // 获取配置信息
  useEffect(() => {
    async function fetchConfig() {
      try {
        const config = await getConfig();
        setModelConfig(config);
        appendLog && appendLog('已加载模型配置', config);
      } catch (error) {
        appendLog && appendLog('加载配置失败', error);
      }
    }
    fetchConfig();
  }, [appendLog]);

  // 初始化 WebSocket 连接
  const initWebSocket = useCallback(() => {
    // 如果已存在连接，先关闭
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // 创建新的 WebSocket 连接 - 直接连接根路径，与服务器配置一致
    const ws = new WebSocket(`${WS_BASE_URL}`);
    wsRef.current = ws;

    // 连接打开回调
    ws.onopen = () => {
      setIsConnected(true);
      appendLog && appendLog('WebSocket 连接已建立');

      // 设置心跳检测
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      }, 30000);
    };

    // 接收消息回调
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        appendLog && appendLog('收到WebSocket消息', message);

        switch (message.type) {
          case 'connection_established':
            setConnectionId(message.connectionId);
            appendLog && appendLog('已获取连接ID', message.connectionId);
            break;

          case 'call_started':
            setIsCallActive(true);
            setCallStartTime(Date.now());
            setTranscript('');
            
            // 开始计时
            durationIntervalRef.current = setInterval(() => {
              setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
            }, 1000);
            
            appendLog && appendLog('通话已开始', message);
            message.info && message.info('通话已连接');
            break;

          case 'call_ended':
            setIsCallActive(false);
            stopRecording();
            clearInterval(durationIntervalRef.current);
            appendLog && appendLog('通话已结束', message);
            message.info && message.info('通话已结束');
            break;

          case 'ai_response':
            handleAIResponse(message.data);
            break;

          case 'ping':
            // 心跳响应
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;

          case 'error':
            appendLog && appendLog('收到错误', message);
            message.error && message.error(message.message || '通话出错');
            break;

          default:
            appendLog && appendLog('未知的消息类型', message);
        }
      } catch (error) {
        appendLog && appendLog('处理WebSocket消息时出错', error);
      }
    };

    // 连接关闭回调
    ws.onclose = () => {
      setIsConnected(false);
      appendLog && appendLog('WebSocket 连接已关闭');
      clearInterval(pingIntervalRef.current);
      
      // 如果通话处于活跃状态，则尝试自动重连
      if (isCallActive) {
        setIsCallActive(false);
        stopRecording();
        message.error('通话连接已断开，正在尝试重连...');
        
        // 3秒后尝试重连
        reconnectTimeoutRef.current = setTimeout(() => {
          initWebSocket();
        }, 3000);
      }
    };

    // 连接错误回调
    ws.onerror = (error) => {
      appendLog && appendLog('WebSocket 连接错误', error);
      message.error('通话连接错误，请尝试刷新页面');
    };
  }, [appendLog, isCallActive, callStartTime]);

  // 组件挂载时初始化 WebSocket，卸载时清理资源
  useEffect(() => {
    initWebSocket();

    return () => {
      // 清理所有资源
      endCall();
      clearInterval(pingIntervalRef.current);
      clearInterval(durationIntervalRef.current);
      clearTimeout(reconnectTimeoutRef.current);
      
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [initWebSocket]);

  // 处理 AI 响应
  const handleAIResponse = useCallback((responseData) => {
    try {
      // 尝试解析 SSE 格式响应
      let data;
      if (responseData.startsWith('data: ')) {
        const jsonStr = responseData.substring(6).trim();
        if (jsonStr === '[DONE]') {
          setAiThinking(false);
          return;
        }
        data = JSON.parse(jsonStr);
      } else {
        data = JSON.parse(responseData);
      }

      setAiThinking(false);
      
      if (data.choices && Array.isArray(data.choices)) {
        for (const choice of data.choices) {
          if (choice.delta && choice.delta.audio) {
            if (typeof choice.delta.audio.data === 'string' && choice.delta.audio.data.length > 0) {
              // 实时播放音频
              playPcmChunk(choice.delta.audio.data, 24000);
              appendLog && appendLog('已播放AI音频片段');
            }
            
            if (typeof choice.delta.audio.transcript === 'string' && choice.delta.audio.transcript.length > 0) {
              setTranscript(t => t + choice.delta.audio.transcript);
              appendLog && appendLog('收到AI文本片段', choice.delta.audio.transcript);
            }
          }
          
          if (choice.delta && typeof choice.delta.text === 'string') {
            setTranscript(t => t + choice.delta.text);
            appendLog && appendLog('收到AI文本片段', choice.delta.text);
          }
        }
      }
      
      if (data.finish_reason === 'stop' || data.done === true) {
        appendLog && appendLog('AI响应完成');
      }
    } catch (error) {
      appendLog && appendLog('解析AI响应时出错', error);
    }
  }, [appendLog]);

  // 开始通话
  const startCall = useCallback(async () => {
    if (!isConnected || !connectionId) {
      message.error('WebSocket 未连接，请刷新页面重试');
      return;
    }

    if (isCallActive) {
      message.info('通话已在进行中');
      return;
    }

    setLoading(true);
    setAiThinking(true);

    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      mediaStreamRef.current = stream;
      
      // 初始化音频上下文
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000  // 使用与模型匹配的采样率
      });
      audioContextRef.current = audioContext;
      
      // 创建媒体流源节点
      const source = audioContext.createMediaStreamSource(stream);
      
      // 创建处理器节点
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;
      
      // 连接节点
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      // 设置音频处理回调
      processor.onaudioprocess = (e) => {
        if (!isCallActive) return;
        
        // 获取输入音频数据
        const inputData = e.inputBuffer.getChannelData(0);
        
        // 将 Float32 转换为 Int16
        const pcmBuffer = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          // 将 -1到1 的浮点值转换为 -32768到32767 的整数
          pcmBuffer[i] = Math.max(-32768, Math.min(32767, Math.floor(inputData[i] * 32767)));
        }
        
        // 将 Int16Array 转换为 ArrayBuffer
        const buffer = pcmBuffer.buffer;
        
        // 将 ArrayBuffer 转换为 Base64
        const binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = window.btoa(binary);
        
        // 发送音频数据到服务器
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'audio_chunk',
            audio: base64,
            timestamp: Date.now()
          }));
        }
      };
      
      // 通知服务器开始通话
      wsRef.current.send(JSON.stringify({
        type: 'start_call',
        model: modelConfig?.model || 'qwen-omni-turbo',
        timestamp: Date.now()
      }));
      
      appendLog && appendLog('已发送开始通话请求');
      
    } catch (error) {
      setLoading(false);
      setAiThinking(false);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        message.error('未获得麦克风权限，请检查浏览器设置');
      } else {
        message.error(`启动通话失败: ${error.message}`);
      }
      
      appendLog && appendLog('启动通话失败', error);
    }
  }, [isConnected, connectionId, isCallActive, modelConfig, appendLog]);

  // 结束通话
  const endCall = useCallback(() => {
    // 如果不在通话中，则直接返回
    if (!isCallActive) return;
    
    // 停止录音
    stopRecording();
    
    // 通知服务器结束通话
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'end_call',
        timestamp: Date.now()
      }));
    }
    
    setIsCallActive(false);
    setLoading(false);
    setAiThinking(false);
    clearInterval(durationIntervalRef.current);
    
    appendLog && appendLog('已发送结束通话请求');
  }, [isCallActive, appendLog]);

  // 停止录音
  const stopRecording = useCallback(() => {
    // 停止并清理媒体流
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // 断开并清理音频处理器
    if (audioProcessorRef.current && audioContextRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }
    
    // 关闭音频上下文
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    
    // 停止所有正在播放的音频
    stopAllAudio();
  }, []);

  // 格式化通话时长
  const formatDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    // 状态
    isConnected,
    isCallActive,
    loading,
    aiThinking,
    transcript,
    connectionId,
    callDuration,
    formatDuration,
    
    // 方法
    startCall,
    endCall
  };
}
