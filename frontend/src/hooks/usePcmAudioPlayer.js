import { useEffect } from 'react';

// 全局播放指针，确保PCM片段串行播放
if (!window._pcmPlayCursor) window._pcmPlayCursor = 0;
// 存储所有正在播放的audio source节点，便于停止
if (!window._activeSources) window._activeSources = new Set();

/**
 * 播放一个PCM片段
 */
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

  // 添加到活跃源列表，便于停止时管理
  window._activeSources.add(source);
  
  // 清理函数，播放结束后移除源
  source.onended = () => {
    window._activeSources.delete(source);
  };

  // 串行排队播放，避免重叠
  if (!window._pcmPlayCursor || window._pcmPlayCursor < audioCtx.currentTime) {
    window._pcmPlayCursor = audioCtx.currentTime;
  }
  source.start(window._pcmPlayCursor);
  window._pcmPlayCursor += audioBuffer.duration;
  
  return source; // 返回源对象，方便外部再次引用
}

/**
 * 停止所有正在播放的音频
 */
export function stopAllAudio() {
  // 停止所有活跃的音频源
  if (window._activeSources) {
    window._activeSources.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // 忽略可能的错误
      }
    });
    window._activeSources.clear();
  }
  
  // 重置播放指针，使下一个音频立即开始
  if (window._pcmAudioCtx) {
    window._pcmPlayCursor = window._pcmAudioCtx.currentTime;
  }
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
