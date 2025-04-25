import React, { useEffect, useRef } from 'react';

// 简单的canvas波浪动画（可根据实际PCM动态调整）
export default function AIAudioWave({ playing }) {
  const canvasRef = useRef();
  const animIdRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let t = 0;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.strokeStyle = '#1890ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += 4) {
        const amp = playing ? 16 : 4;
        const y = canvas.height / 2 + Math.sin((x + t) / 16) * amp * Math.sin((t + x) / 32);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
      t += playing ? 2 : 0.5;
      animIdRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animIdRef.current);
  }, [playing]);

  return <canvas ref={canvasRef} width={180} height={40} style={{ background: 'transparent', display: 'block' }} />;
}
