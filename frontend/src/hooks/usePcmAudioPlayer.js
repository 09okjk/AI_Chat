import { useEffect, useRef, useState } from 'react';

// 简单的PCM播放函数 - 一次只播放一个片段
export function playPcmChunk(base64Str, sampleRate = 24000) {
  if (!base64Str) return;
  
  // 确保AudioContext只被创建一次
  if (!window._pcmAudioCtx) {
    window._pcmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    console.log('初始化AudioContext, 采样率:', window._pcmAudioCtx.sampleRate);
  }
  
  try {
    const audioCtx = window._pcmAudioCtx;
    
    // 解码base64为二进制数据
    const binary = atob(base64Str);
    const buf = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < binary.length; i++) {
      view[i] = binary.charCodeAt(i);
    }
    
    // Int16转换为Float32音频数据
    const pcm16 = new Int16Array(buf);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }
    
    // 创建音频缓冲区
    const audioBuffer = audioCtx.createBuffer(1, float32.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32);
    
    // 创建音频源并播放
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.start();
    
    // 返回音频源，以便可以停止它
    return source;
  } catch (err) {
    console.error('PCM播放错误:', err);
    return null;
  }
}

// 简化版PCM播放器钩子 - 严格按顺序一次播放一个块
export function usePcmAudioPlayer(pendingPcmChunks, setPendingPcmChunks) {
  // 是否正在播放
  const [isPlaying, setIsPlaying] = useState(false);
  // 当前播放的音频源
  const currentSourceRef = useRef(null);
  // 上次播放完成的时间
  const lastPlayEndTimeRef = useRef(0);
  // 是否有待处理的音频片段
  const hasPendingChunks = pendingPcmChunks.length > 0;
  
  useEffect(() => {
    // 没有待播放内容时不执行任何操作
    if (!hasPendingChunks) {
      return;
    }
    
    // 如果当前没有正在播放的音频，且有待处理的音频片段，则开始播放
    if (!isPlaying && hasPendingChunks) {
      const playNextChunk = () => {
        if (pendingPcmChunks.length === 0) {
          setIsPlaying(false);
          return;
        }
        
        setIsPlaying(true);
        
        // 取出队列中的第一个音频片段
        const nextChunk = pendingPcmChunks[0];
        
        // 更新队列，移除已经取出的片段
        setPendingPcmChunks(chunks => chunks.slice(1));
        
        // 记录开始播放的时间
        const playStartTime = Date.now();
        
        // 播放音频片段
        const source = playPcmChunk(nextChunk, 24000);
        currentSourceRef.current = source;
        
        // 音频播放完成后的处理
        if (source) {
          // 当前音频片段的持续时间（毫秒）
          // 假设24000采样率，每个base64字符大约对应0.75个样本
          const estimatedDuration = Math.max(150, (nextChunk.length * 0.75 / 24000) * 1000);
          
          // 确保下一个音频在当前音频播放完成后播放
          setTimeout(() => {
            lastPlayEndTimeRef.current = Date.now();
            currentSourceRef.current = null;
            
            // 记录播放信息
            const actualDuration = Date.now() - playStartTime;
            console.log(`播放音频片段: 大小=${nextChunk.length}字节, 估计持续=${estimatedDuration.toFixed(0)}ms, 实际=${actualDuration}ms`);
            
            // 继续播放下一个片段
            setTimeout(playNextChunk, 50); // 添加50ms间隔确保平滑过渡
          }, estimatedDuration);
        } else {
          // 播放失败，继续下一个
          setTimeout(playNextChunk, 100);
        }
      };
      
      // 开始播放第一个音频片段
      playNextChunk();
    }
    
    // 清理函数
    return () => {
      // 停止当前正在播放的音频
      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.stop();
        } catch (e) {}
        currentSourceRef.current = null;
      }
    };
  }, [hasPendingChunks, isPlaying, pendingPcmChunks, setPendingPcmChunks]);
  
  return { isPlaying };
}
