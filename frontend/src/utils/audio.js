// Base64转音频播放，自动识别格式
export function playBase64Audio(base64Str) {
  if (!base64Str) return;
  let mime = 'audio/wav';
  let base64Body = base64Str;
  const prefixMatch = base64Str.match(/^data:(audio\/(wav|mp3|mpeg));base64,(.*)$/);
  if (prefixMatch) {
    mime = prefixMatch[1];
    base64Body = prefixMatch[3];
  }
  try {
    const audioData = atob(base64Body);
    const buffer = new Uint8Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      buffer[i] = audioData.charCodeAt(i);
    }
    const blob = new Blob([buffer], { type: mime });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
  } catch (e) {
    // 捕获解码错误
    alert('音频播放失败：数据格式有误或浏览器不支持。');
    console.error('playBase64Audio error:', e, base64Str);
  }
}
