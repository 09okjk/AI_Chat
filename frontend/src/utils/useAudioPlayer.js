import { useRef } from 'react';

export default function useAudioPlayer() {
  const audioRef = useRef(null);

  const playBase64Audio = (base64Str, type = 'wav') => {
    if (!base64Str) return;
    const audioData = atob(base64Str.replace(/^data:audio\/(wav|mp3);base64,/, ''));
    const buffer = new Uint8Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      buffer[i] = audioData.charCodeAt(i);
    }
    const blob = new Blob([buffer], { type: `audio/${type}` });
    const url = URL.createObjectURL(blob);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
  };

  return { playBase64Audio };
}
