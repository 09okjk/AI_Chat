// Base64转音频播放
export function playBase64Audio(base64Str) {
  const audioData = atob(base64Str);
  const buffer = new Uint8Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    buffer[i] = audioData.charCodeAt(i);
  }
  const blob = new Blob([buffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
}
