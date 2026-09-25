import React, { useState, useEffect } from 'react';
import { CyberIcon } from '../common/CyberIcon';
import './MaintenanceCountdown.css';

// Scheduled launch timestamp: Tomorrow, Sept 24, 2026 at 09:18:00 AM IST (+05:30)
export const TARGET_LAUNCH_TIME = new Date('2026-09-24T09:18:00+05:30').getTime();

interface MaintenanceCountdownProps {
  onUnlock: () => void;
}

export function MaintenanceCountdown({ onUnlock }: MaintenanceCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; isExpired: boolean }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false
  });
  const [istTime, setIstTime] = useState<string>('');

  useEffect(() => {
    const pad = (n: number) => n.toString().padStart(2, '0');

    const calculate = () => {
      const now = Date.now();
      const diff = TARGET_LAUNCH_TIME - now;

      // Update live IST clock string
      const d = new Date();
      const utc = d.getTime() + d.getTimezoneOffset() * 60000;
      const ist = new Date(utc + 3600000 * 5.5);
      setIstTime(`${pad(ist.getHours())}:${pad(ist.getMinutes())}:${pad(ist.getSeconds())} IST`);

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
        onUnlock();
        return;
      }

      const totalSec = Math.floor(diff / 1000);
      const hours = Math.floor(totalSec / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;

      setTimeLeft({ hours, minutes, seconds, isExpired: false });
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [onUnlock]);

  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <div className="maintenance-wrapper">
      {/* Ambient background glows */}
      <div className="maintenance-ambient-1" />
      <div className="maintenance-ambient-2" />
      <div className="maintenance-matrix-bg" />

      {/* Header Bar */}
      <header className="maintenance-header">
        <div className="maintenance-brand">
          <div className="maintenance-brand-mark" style={{ background: '#ffffff', padding: 2, overflow: 'hidden' }}>
            <img src="/logo.jpg" alt="MMI Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 7 }} />
          </div>
          <div>
            <div className="maintenance-brand-title">Market Minds</div>
            <div className="maintenance-brand-subtitle">TERMINAL 2.0 UPGRADE</div>
          </div>
        </div>

        <div className="maintenance-clock tabular-nums">
          LIVE: {istTime || 'SYNCHRONIZING...'}
        </div>
      </header>

      {/* Center Hype HUD Card */}
      <main className="maintenance-card">
        {/* Pulsing Status Beacon */}
        <div className="maintenance-badge">
          <span className="maintenance-badge-ping" />
          <span>SCHEDULED UPGRADE IN PROGRESS</span>
        </div>

        {/* Headlines */}
        <h1 className="maintenance-title">
          MMI WEBSITE IS <br />
          <span className="maintenance-highlight">UNDER MAINTENANCE</span>
        </h1>

        <div className="maintenance-subtitle">
          <CyberIcon name="spike" size={16} />
          <span>READY TO PUSH NEW CRAZY UPDATE</span>
          <CyberIcon name="spike" size={16} />
        </div>

        {/* Live Countdown Display */}
        <div className="countdown-grid">
          <div className="countdown-box">
            <span className="countdown-digits tabular-nums">{pad(timeLeft.hours)}</span>
            <span className="countdown-label">HOURS</span>
          </div>

          <div className="countdown-separator">:</div>

          <div className="countdown-box">
            <span className="countdown-digits tabular-nums">{pad(timeLeft.minutes)}</span>
            <span className="countdown-label">MINUTES</span>
          </div>

          <div className="countdown-separator">:</div>

          <div className="countdown-box">
            <span className="countdown-digits tabular-nums">{pad(timeLeft.seconds)}</span>
            <span className="countdown-label">SECONDS</span>
          </div>
        </div>

        {/* Teaser Bento Grid */}
        <div className="maintenance-teasers">
          <div className="teaser-card">
            <span className="teaser-icon">⚡</span>
            <div className="teaser-title">120 FPS Zero-Jitter Tape</div>
            <div className="teaser-desc">Ultra-fluid liquidity scanning with zero DOM freeze and real-time Day High/Low breaks.</div>
          </div>

          <div className="teaser-card">
            <span className="teaser-icon">🟩</span>
            <div className="teaser-title">Cyber Glass Bento Heatmap</div>
            <div className="teaser-desc">Finviz-grade multi-stop luminescence with volume-weighted sector clusters.</div>
          </div>

          <div className="teaser-card">
            <span className="teaser-icon">📡</span>
            <div className="teaser-title">Radar Alert Command Center</div>
            <div className="teaser-desc">Crisp unblurred overlay, audio breakout chimes, and instant 6-category filtering.</div>
          </div>

          <div className="teaser-card">
            <span className="teaser-icon">📊</span>
            <div className="teaser-title">Sector Breadth Telemetry</div>
            <div className="teaser-desc">Real-time advance/decline distribution, relative volume multipliers, and trend bias.</div>
          </div>
        </div>

        {/* Total Lockdown Status (Zero Bypass / Zero Backdoor) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '18px 24px',
          background: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.28)',
          borderRadius: 14,
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 12,
          color: '#fda4af',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
        }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <span>TOTAL SYSTEM LOCKDOWN · NOT EVEN ADMIN IS PERMITTED UNTIL 09:18 AM IST</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="maintenance-footer">
        <span>● TARGET LAUNCH: SEP 24, 2026 @ 09:18 AM IST</span>
        <span>•</span>
        <span>MARKET MINDS ARCHITECTURE</span>
      </footer>
    </div>
  );
}
