import React, { useEffect, useRef } from 'react';
import './VoiceVisualizer.css';

export default function VoiceVisualizer({ isPlaying }) {
  const canvasRef = useRef();
  const animationRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let t = 0;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 音律动画（简单正弦柱状）
      for (let i = 0; i < 32; i++) {
        const barHeight = 30 + 20 * Math.abs(Math.sin(t / 10 + i));
        ctx.fillStyle = '#1890ff';
        ctx.fillRect(i * 7, canvas.height - barHeight, 5, barHeight);
      }
      t += isPlaying ? 1 : 0;
      animationRef.current = requestAnimationFrame(draw);
    }
    if (isPlaying) draw();
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying]);

  return (
    <canvas ref={canvasRef} width={224} height={60} style={{ width: 224, height: 60, background: '#f0f5ff', borderRadius: 8 }} />
  );
}
