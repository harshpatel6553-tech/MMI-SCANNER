import { useState, useEffect } from 'react';
import './LoadingScreen.css';

interface LoadingScreenProps {
  onComplete: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [phase, setPhase] = useState<'typing' | 'chart' | 'fadeout'>('typing');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('chart'), 1500);
    const t2 = setTimeout(() => setPhase('fadeout'), 2500);
    const t3 = setTimeout(onComplete, 3200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div className={`loading-screen ${phase === 'fadeout' ? 'fade-out' : ''}`}>
      <div className="loading-grid" />
      <div className="loading-content">
        <img src="/logo.jpg" className="loading-logo-img" alt="Market Minds Investment Logo" />
        <div className={`loading-title ${phase !== 'typing' ? 'typed' : ''}`}>
          <span className="typing-text">MARKET MINDS INVESTMENT SCANNER</span>
          <span className="cursor" />
        </div>
        <div className={`loading-subtitle ${phase === 'chart' ? 'visible' : ''}`}>
          Premium Real-Time Scanner
        </div>
        <div className={`loading-chart ${phase === 'chart' ? 'visible' : ''}`}>
          <svg viewBox="0 0 400 80" className="chart-svg">
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#da7f63" />
                <stop offset="100%" stopColor="#dfb15b" />
              </linearGradient>
            </defs>
            <polyline
              className="chart-line"
              fill="none"
              stroke="url(#chartGrad)"
              strokeWidth="2"
              points="0,60 30,55 60,40 90,45 120,20 150,35 180,15 210,30 240,10 270,25 300,18 330,5 360,12 400,8"
            />
          </svg>
        </div>
        <div className={`loading-bar-track ${phase === 'chart' ? 'visible' : ''}`}>
          <div className="loading-bar-fill" />
        </div>
      </div>
    </div>
  );
}
