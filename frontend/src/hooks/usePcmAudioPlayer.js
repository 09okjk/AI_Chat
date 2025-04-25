import { useEffect, useRef, useState } from 'react';

// 初始化Web Audio Context
function getAudioContext() {
  if (!window._pcmAudioCtx) {
    window._pcmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    console.log('初始化AudioContext, 采样率:', window._pcmAudioCtx.sampleRate);
  }
  return window._pcmAudioCtx;
}

// 自适应播放PCM音频块 - 优化版本
export function playPcmChunk(base64Str, sampleRate = 24000) {
  if (!base64Str) return null;
  try {
    const audioCtx = getAudioContext();
    
    // 解码base64为ArrayBuffer
    const binary = atob(base64Str);
    const buf = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
    
    // int16 PCM -> Float32 [-1,1]
    const pcm16 = new Int16Array(buf);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
    
    // 创建音频缓冲区
    const audioBuffer = audioCtx.createBuffer(1, float32.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32);
    
    // 创建源节点并连接
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    
    // 创建增益节点以便控制音量
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 1.0; // 默认音量
    
    // 连接音频处理链
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // 启动播放
    source.start(0);
    
    // 返回源节点，以便可以在外部停止播放如果需要
    return source;
  } catch (err) {
    console.error('播放PCM音频失败:', err);
    return null;
  }
}

// 增强的流式PCM播放器 - 自适应缓冲及平滑过渡
export function usePcmAudioPlayer(pendingPcmChunks, setPendingPcmChunks) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bufferHealth, setBufferHealth] = useState('empty'); // 'empty', 'low', 'good', 'high'
  const lastPlayTimeRef = useRef(0);
  const playbackStatsRef = useRef({
    totalChunks: 0,
    chunksPlayed: 0,
    playbackStarted: null,
    lastChunkSize: 0
  });
  
  // 自适应间隔计算
  const calculateOptimalInterval = (chunkCount, lastInterval) => {
    if (chunkCount === 0) return 500; // 默认值
    if (chunkCount < 3) return 450;   // 缓冲较少，稍快播放
    if (chunkCount < 10) return 350;  // 适中缓冲，正常速度
    return 250;                       // 大量缓冲，加快播放
  };
  
  // 更新缓冲健康状态
  const updateBufferHealth = (count) => {
    if (count === 0) return setBufferHealth('empty');
    if (count < 5) return setBufferHealth('low');
    if (count < 20) return setBufferHealth('good');
    return setBufferHealth('high');
  };

  useEffect(() => {
    // 如果没有待播放的块，不启动计时器
    if (pendingPcmChunks.length === 0) {
      if (isPlaying) {
        setIsPlaying(false);
        console.log('PCM播放队列为空，停止播放');
      }
      return;
    }
    
    // 第一次收到内容时记录开始时间
    if (!isPlaying) {
      setIsPlaying(true);
      playbackStatsRef.current.playbackStarted = Date.now();
      console.log('开始PCM流式播放');
    }
    
    // 更新缓冲区健康状态
    updateBufferHealth(pendingPcmChunks.length);
    
    // 计算最佳播放间隔
    const optimalInterval = calculateOptimalInterval(
      pendingPcmChunks.length, 
      Date.now() - lastPlayTimeRef.current
    );
    
    // 创建播放计时器
    const timer = setInterval(() => {
      // 记录本次播放时间
      lastPlayTimeRef.current = Date.now();
      
      setPendingPcmChunks(chunks => {
        if (chunks.length === 0) return [];
        
        // 确定批次大小 - 自适应
        let batchSize = 1; // 默认每次播放一个
        if (chunks.length > 20) batchSize = 3;  // 缓冲大时播放更多
        if (chunks.length > 40) batchSize = 5;  // 缓冲极大时批量播放
        
        // 限制批次大小不超过总数
        batchSize = Math.min(batchSize, chunks.length);
        
        // 获取批次并播放
        const batchToPlay = chunks.slice(0, batchSize);
        const batch = batchToPlay.join('');
        
        // 播放音频
        if (batch) {
          // 更新统计信息
          playbackStatsRef.current.chunksPlayed += batchSize;
          playbackStatsRef.current.lastChunkSize = batch.length;
          playbackStatsRef.current.totalChunks += batchSize;
          
          // 实际播放
          playPcmChunk(batch, 24000);
          
          // 调试信息
          if (chunks.length % 10 === 0 || chunks.length < 5) {
            console.log(`PCM播放: 剩余${chunks.length - batchSize}块, 已播放${playbackStatsRef.current.chunksPlayed}块, 播放时长${((Date.now() - playbackStatsRef.current.playbackStarted)/1000).toFixed(1)}秒`);
          }
        }
        
        // 返回剩余的chunks
        return chunks.slice(batchSize);
      });
    }, optimalInterval);
    
    return () => clearInterval(timer);
  }, [pendingPcmChunks, setPendingPcmChunks, isPlaying]);
  
  // 返回播放状态，方便UI显示
  return { isPlaying, bufferHealth };
}
