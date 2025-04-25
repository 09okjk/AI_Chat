import { useEffect } from 'react';

// 播放裸PCM分片（24000Hz int16）
// 全局播放指针和播放节点列表，确保PCM片段串行播放和可中断
if (!window._pcmPlayCursor) window._pcmPlayCursor = 0;
if (!window._pcmSourceNodes) window._pcmSourceNodes = [];

export function playPcmChunk(base64Str, sampleRate = 24000) {
  if (!base64Str) return;
  const audioCtx = window._pcmAudioCtx || (window._pcmAudioCtx = new (window.AudioContext || window.webkitAudioContext)());
  // 解码base64为ArrayBuffer
  const binary = atob(base64Str);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  // int16 PCM -> Float32 [-1,1]
  const pcm16 = new Int16Array(buf);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
  const audioBuffer = audioCtx.createBuffer(1, float32.length, sampleRate);
  audioBuffer.getChannelData(0).set(float32);
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);

  // 串行排队播放，避免重叠
  if (!window._pcmPlayCursor || window._pcmPlayCursor < audioCtx.currentTime) {
    window._pcmPlayCursor = audioCtx.currentTime;
  }
  source.start(window._pcmPlayCursor);
  // 记录当前播放节点，便于stop时终止
  window._pcmSourceNodes.push(source);
  // 自动清理已播放节点
  source.onended = () => {
    window._pcmSourceNodes = window._pcmSourceNodes.filter(n => n !== source);
  };
  window._pcmPlayCursor += audioBuffer.duration;
}

// 停止所有未播放和正在播放的PCM音频
export function stopPCMPlayback() {
  if (window._pcmSourceNodes) {
    window._pcmSourceNodes.forEach(node => {
      try { node.stop && node.stop(); } catch(e) {}
    });
    window._pcmSourceNodes = [];
  }
  window._pcmPlayCursor = 0;
}



// 用于流式PCM自动拼接播放
export function usePcmAudioPlayer(pendingPcmChunks, setPendingPcmChunks) {
  useEffect(() => {
    if (pendingPcmChunks.length === 0) return;
    const timer = setInterval(() => {
      setPendingPcmChunks(chunks => {
        if (chunks.length === 0) return [];
        const batch = chunks.join('');
        playPcmChunk(batch, 24000);
        return [];
      });
    }, 400); // 每400ms播放一次
    return () => clearInterval(timer);
  }, [pendingPcmChunks, setPendingPcmChunks]);
}
