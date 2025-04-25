import { useEffect, useRef, useState } from 'react';

// 序列播放 PCM 音频函数 - 可靠实现
export function playPcmChunk(base64Str, sampleRate = 24000) {
  if (!base64Str || typeof base64Str !== 'string') {
    console.error('音频数据无效:', base64Str);
    return null;
  }
  
  // 打印前20个字符以供调试
  console.log('尝试播放音频数据:', { 
    length: base64Str.length, 
    preview: base64Str.substring(0, 20) + '...' 
  });
  
  // 处理可能的数据格式问题
  let cleanBase64 = base64Str;
  // 刪除可能的base64数据头部，如 "data:audio/wav;base64,"
  if (cleanBase64.indexOf(',') !== -1) {
    cleanBase64 = cleanBase64.split(',')[1];
  }
  
  // 确保AudioContext只被创建一次
  if (!window._pcmAudioCtx) {
    window._pcmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    console.log('初始化AudioContext, 采样率:', window._pcmAudioCtx.sampleRate);
  }
  
  try {
    const audioCtx = window._pcmAudioCtx;
    
    // 解码base64为二进制数据
    let binary;
    try {
      binary = atob(cleanBase64);
      console.log('解码base64成功, 长度:', binary.length);
    } catch (e) {
      console.error('base64解码失败:', e);
      return null;
    }
    
    if (binary.length === 0) {
      console.warn('解码后的二进制数据长度为0');
      return null;
    }
    
    const buf = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < binary.length; i++) {
      view[i] = binary.charCodeAt(i);
    }
    
    // Int16转换为Float32音频数据
    const pcm16 = new Int16Array(buf);
    if (pcm16.length === 0) {
      console.warn('PCM数据长度为0');
      return null;
    }
    
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
    
    // 按区域不同设置数据长度
    let audioLengthMs = (float32.length / sampleRate * 1000) || 200; // 默认至少200ms
    console.log('音频长度:', { 
      samples: float32.length, 
      durationMs: audioLengthMs.toFixed(0),
      sampleRate
    });
    
    try {
      source.start();
      console.log('音频播放已启动');
    } catch (e) {
      console.error('音频启动失败:', e);
      return null;
    }
    
    return { 
      source, 
      durationMs: audioLengthMs
    };
  } catch (err) {
    console.error('PCM播放中发生错误:', err);
    return null;
  }
}

// 序列PCM播放器钩子 - 改进版
export function usePcmAudioPlayer(pendingPcmChunks, setPendingPcmChunks) {
  // 播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  // 当前播放的音频源
  const currentSourceRef = useRef(null);
  // 上次播放完成的时间
  const lastPlayEndTimeRef = useRef(0);
  // 调试信息
  const statsRef = useRef({
    totalChunks: 0,
    playedChunks: 0,
    startTime: null,
    errors: 0
  });
  
  useEffect(() => {
    console.log('音频片段数量变化:', pendingPcmChunks.length);
    
    // 当没有待播放的音频且当前没有在播放时，重置状态
    if (pendingPcmChunks.length === 0 && !currentSourceRef.current) {
      if (isPlaying) {
        setIsPlaying(false);
        console.log('音频播放完成，没有待处理片段');
        
        // 打印统计信息
        if (statsRef.current.playedChunks > 0) {
          const totalTime = Date.now() - (statsRef.current.startTime || Date.now());
          console.log('音频播放统计:', {
            totalChunks: statsRef.current.totalChunks,
            playedChunks: statsRef.current.playedChunks,
            errors: statsRef.current.errors,
            totalTimeMs: totalTime,
            averageChunkDuration: totalTime / statsRef.current.playedChunks
          });
        }
      }
      return;
    }
    
    // 如果当前没有正在播放的音频且有待播放内容，则开始播放序列
    if (!currentSourceRef.current && pendingPcmChunks.length > 0 && !isPlaying) {
      setIsPlaying(true);
      
      // 记录开始时间
      if (!statsRef.current.startTime) {
        statsRef.current.startTime = Date.now();
      }
      
      console.log('初始化音频播放器...');
      
      // 递归播放函数
      const playNextInQueue = () => {
        // 当没有待播放内容时结束
        if (pendingPcmChunks.length === 0) {
          setIsPlaying(false);
          currentSourceRef.current = null;
          console.log('队列播放完成');
          return;
        }
        
        // 获取下一个待播放的片段
        const nextChunk = pendingPcmChunks[0];
        statsRef.current.totalChunks++;
        
        // 移除队列中的该片段
        setPendingPcmChunks(chunks => chunks.slice(1));
        
        // 打印调试日志
        console.log(`开始播放片段 #${statsRef.current.totalChunks}: 长度=${nextChunk?.length || 0}`);
        
        // 记录开始播放时间
        const playStartTime = Date.now();
        
        try {
          // 调用播放函数并获取结果
          const result = playPcmChunk(nextChunk, 24000);
          
          if (result && result.source) {
            // 保存当前正在播放的源
            currentSourceRef.current = result.source;
            statsRef.current.playedChunks++;
            
            // 使用返回的持续时间，或根据长度估算
            const duration = result.durationMs || Math.max(200, nextChunk.length * 0.03);
            
            // 在音频播放完成后播放下一个
            setTimeout(() => {
              const actualDuration = Date.now() - playStartTime;
              console.log(`片段 #${statsRef.current.playedChunks} 播放完成: 预计=${duration.toFixed(0)}ms, 实际=${actualDuration}ms`);
              
              // 重置当前源
              currentSourceRef.current = null;
              
              // 添加小间隔然后继续播放下一个
              setTimeout(playNextInQueue, 30);
            }, duration);
          } else {
            // 播放失败，记录并继续下一个
            console.warn(`片段 #${statsRef.current.totalChunks} 播放失败`);
            statsRef.current.errors++;
            currentSourceRef.current = null;
            setTimeout(playNextInQueue, 100);
          }
        } catch (error) {
          // 处理异常
          console.error('播放异常:', error);
          statsRef.current.errors++;
          currentSourceRef.current = null;
          setTimeout(playNextInQueue, 100);
        }
      };
      
      // 开始播放序列
      playNextInQueue();
    }
    
    // 清理函数
    return () => {
      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.stop();
          console.log('停止当前音频播放');
        } catch (e) { 
          console.error('停止播放错误:', e);
        }
        currentSourceRef.current = null;
      }
    };
  }, [pendingPcmChunks, setPendingPcmChunks, isPlaying]);
  
  // 返回播放器对象
  return { 
    isPlaying, 
    stats: {
      totalChunks: statsRef.current?.totalChunks || 0,
      playedChunks: statsRef.current?.playedChunks || 0,
      errors: statsRef.current?.errors || 0
    }
  };
}
