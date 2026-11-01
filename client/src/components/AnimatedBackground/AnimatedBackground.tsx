import React, { useEffect, useRef } from 'react';
import './AnimatedBackground.css';

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Particle nodes for subtle 3D spatial depth
    const particleCount = Math.min(45, Math.floor((width * height) / 28000));
    const particles: Array<{
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      color: string;
    }> = [];

    const colors = ['#00d4ff', '#00f59b', '#38bdf8', '#818cf8'];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        size: Math.random() * 1.8 + 0.8,
        alpha: Math.random() * 0.45 + 0.15,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = mouseX;
    let targetMouseY = mouseY;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    const render = () => {
      // Smooth mouse lerp
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // Render subtle connections & particle nodes
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // 3D parallax offset driven by mouse position and particle depth (z)
        const parallaxX = (mouseX - width / 2) * (0.015 * p.z);
        const parallaxY = (mouseY - height / 2) * (0.015 * p.z);

        p.x += p.vx;
        p.y += p.vy;

        // Wrap around boundaries
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const drawX = p.x + parallaxX;
        const drawY = p.y + parallaxY;

        ctx.beginPath();
        ctx.arc(drawX, drawY, p.size * p.z, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fill();

        // Connect nearby nodes
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.hypot(dx, dy);

          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(drawX, drawY);
            ctx.lineTo(p2.x + parallaxX, p2.y + parallaxY);
            ctx.strokeStyle = '#00d4ff';
            ctx.globalAlpha = (1 - dist / 120) * 0.08;
            ctx.shadowBlur = 0;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="animated-3d-bg" aria-hidden="true">
      <div className="ambient-mesh-glow" />
      <canvas ref={canvasRef} className="constellation-3d-canvas" />
      <div className="vignette-overlay" />
    </div>
  );
}
export default AnimatedBackground;
