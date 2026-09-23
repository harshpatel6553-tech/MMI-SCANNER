import React from 'react';
import './CyberIcon.css';

export type CyberIconName =
  | 'overview'
  | 'table'
  | 'heatmap'
  | 'sectors'
  | 'charts'
  | 'technical'
  | 'watchlist'
  | 'livenews'
  | 'results'
  | 'promoter'
  | 'papertrading'
  | 'admin'
  | 'bull'
  | 'bear'
  | 'pulse_up'
  | 'pulse_down'
  | 'spike';

interface CyberIconProps {
  name: CyberIconName;
  size?: number;
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const CyberIcon: React.FC<CyberIconProps> = ({
  name,
  size = 18,
  active = false,
  className = '',
  style = {},
}) => {
  const renderIcon = () => {
    switch (name) {
      case 'overview':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon"
            style={{ filter: active ? 'drop-shadow(0 0 8px rgba(0, 245, 155, 0.6))' : 'drop-shadow(0 0 4px rgba(0, 245, 155, 0.25))' }}
          >
            <defs>
              <linearGradient id="grad-ov-1" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#00f59b" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#00f59b" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="grad-ov-2" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#00d4ff" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="grad-ov-3" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="1" />
              </linearGradient>
            </defs>
            {/* Base telemetry line */}
            <line x1="2" y1="21" x2="22" y2="21" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
            
            {/* Dynamic Volume / Telemetry Bars */}
            <rect x="3.5" y="11" width="3.5" height="8" rx="1.5" fill="url(#grad-ov-1)" className="cyber-anim-bar-1" />
            <rect x="10" y="5" width="4" height="14" rx="1.5" fill="url(#grad-ov-2)" className="cyber-anim-bar-2" />
            <rect x="17" y="8" width="3.5" height="11" rx="1.5" fill="url(#grad-ov-3)" className="cyber-anim-bar-3" />
            
            {/* Pulse Horizon Line */}
            <path
              d="M 2 13 L 8 13 L 12 7 L 15 15 L 18 10 L 22 10"
              stroke="#00f59b"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Glowing apex dot */}
            <circle cx="18" cy="10" r="2" fill="#00f59b" />
          </svg>
        );

      case 'table':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon"
            style={{ filter: active ? 'drop-shadow(0 0 8px rgba(0, 212, 255, 0.6))' : 'drop-shadow(0 0 4px rgba(0, 212, 255, 0.25))' }}
          >
            <defs>
              <linearGradient id="grad-tbl-border" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#00d4ff" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
            </defs>
            {/* Outer Terminal Matrix Frame */}
            <rect x="2.5" y="3.5" width="19" height="17" rx="3" stroke="url(#grad-tbl-border)" strokeWidth="1.5" fill="rgba(6, 182, 212, 0.05)" />
            {/* Top Table Header Bar */}
            <line x1="2.5" y1="8.5" x2="21.5" y2="8.5" stroke="#00d4ff" strokeWidth="1.2" opacity="0.6" />
            {/* Vertical column divider */}
            <line x1="9" y1="3.5" x2="9" y2="20.5" stroke="#00d4ff" strokeWidth="1" opacity="0.3" />
            {/* Row entries */}
            <line x1="4.5" y1="12.5" x2="7.5" y2="12.5" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="11" y1="12.5" x2="19.5" y2="12.5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            <line x1="4.5" y1="16.5" x2="7.5" y2="16.5" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="11" y1="16.5" x2="17.5" y2="16.5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            {/* Scanline beam */}
            <line x1="3" y1="8" x2="21" y2="8" stroke="#00f59b" strokeWidth="1.5" className="cyber-anim-scanline" />
          </svg>
        );

      case 'heatmap':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon"
            style={{ filter: active ? 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))' : 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.3))' }}
          >
            {/* Treemap Quad Matrix */}
            {/* Major top-left block */}
            <rect x="3" y="3" width="10.5" height="11" rx="2" fill="#10b981" className="cyber-anim-tile-1" />
            {/* Top-right block */}
            <rect x="15" y="3" width="6" height="6.5" rx="1.5" fill="#00f59b" className="cyber-anim-tile-2" />
            {/* Mid-right block */}
            <rect x="15" y="11" width="6" height="10" rx="1.5" fill="#047857" className="cyber-anim-tile-3" />
            {/* Bottom-left block */}
            <rect x="3" y="15.5" width="10.5" height="5.5" rx="1.5" fill="#059669" className="cyber-anim-tile-4" />
          </svg>
        );

      case 'sectors':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon"
            style={{ filter: active ? 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.6))' : 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.3))' }}
          >
            <g className="cyber-anim-rotate">
              {/* Sector 1: Top Right Wedge (Accent Amber) */}
              <path
                d="M 12 12 L 12 3 A 9 9 0 0 1 21 12 Z"
                fill="#f59e0b"
                stroke="#111827"
                strokeWidth="1.5"
              />
              {/* Sector 2: Bottom & Left Arc (Emerald) */}
              <path
                d="M 12 12 L 21 12 A 9 9 0 0 1 3 12 Z"
                fill="#10b981"
                stroke="#111827"
                strokeWidth="1.5"
              />
              {/* Sector 3: Top Left Wedge (Cyan) */}
              <path
                d="M 12 12 L 3 12 A 9 9 0 0 1 12 3 Z"
                fill="#00d4ff"
                stroke="#111827"
                strokeWidth="1.5"
              />
              {/* Center aperture donut hole */}
              <circle cx="12" cy="12" r="3.5" fill="#070a12" stroke="#334155" strokeWidth="1" />
            </g>
          </svg>
        );

      case 'charts':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon"
            style={{ filter: active ? 'drop-shadow(0 0 8px rgba(0, 245, 155, 0.6))' : 'drop-shadow(0 0 4px rgba(0, 245, 155, 0.3))' }}
          >
            {/* Candlestick 1: Bullish Green */}
            <line x1="6" y1="5" x2="6" y2="18" stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" />
            <rect x="4.5" y="8" width="3" height="7" rx="0.75" fill="#10b981" />

            {/* Candlestick 2: Retracement */}
            <line x1="12" y1="8" x2="12" y2="19" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" />
            <rect x="10.5" y="11" width="3" height="5" rx="0.75" fill="#ef4444" />

            {/* Candlestick 3: Breakout High */}
            <line x1="18" y1="3" x2="18" y2="15" stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" />
            <rect x="16.5" y="5" width="3" height="7" rx="0.75" fill="#00f59b" />

            {/* Trend Ray */}
            <path
              d="M 3 17 L 9 13 L 13 15 L 21 4"
              stroke="#00d4ff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Target Beacon Dot */}
            <circle cx="21" cy="4" r="2.2" fill="#00f59b" stroke="#00d4ff" strokeWidth="1" />
          </svg>
        );

      case 'technical':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon"
            style={{ filter: active ? 'drop-shadow(0 0 9px rgba(245, 158, 11, 0.75))' : 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.35))' }}
          >
            <defs>
              <linearGradient id="grad-tech-bolt" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>
            {/* High-voltage quant lightning */}
            <path
              d="M 13 2 L 4 13.5 L 11.5 13.5 L 9.5 22 L 20 9.5 L 13.5 9.5 Z"
              fill="url(#grad-tech-bolt)"
              stroke="#fbbf24"
              strokeWidth="0.75"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'watchlist':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon cyber-anim-shimmer"
            style={{ filter: active ? 'drop-shadow(0 0 9px rgba(251, 191, 36, 0.75))' : 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.3))' }}
          >
            <defs>
              <linearGradient id="grad-star" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>
            {/* 4-Pointed High-Tech Stellar Beacon */}
            <path
              d="M 12 2 C 12 7.5 16.5 12 22 12 C 16.5 12 12 16.5 12 22 C 12 16.5 7.5 12 2 12 C 7.5 12 12 7.5 12 2 Z"
              fill="url(#grad-star)"
              stroke="#fbbf24"
              strokeWidth="0.75"
            />
            {/* Central optical flare */}
            <circle cx="12" cy="12" r="2.5" fill="#ffffff" opacity="0.9" />
          </svg>
        );

      case 'livenews':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon"
            style={{ filter: active ? 'drop-shadow(0 0 8px rgba(244, 63, 94, 0.65))' : 'drop-shadow(0 0 4px rgba(244, 63, 94, 0.3))' }}
          >
            <defs>
              <linearGradient id="grad-news" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#e11d48" />
                <stop offset="100%" stopColor="#fb7185" />
              </linearGradient>
            </defs>
            {/* Center transmission beacon core */}
            <circle cx="12" cy="17" r="2.5" fill="#fb7185" />
            <line x1="12" y1="17" x2="12" y2="21" stroke="#fb7185" strokeWidth="2" strokeLinecap="round" />
            {/* Radiating Broadcast Wave 1 */}
            <path
              d="M 7.5 12.5 A 6.5 6.5 0 0 1 16.5 12.5"
              stroke="#f43f5e"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="cyber-anim-wave-1"
            />
            {/* Radiating Broadcast Wave 2 */}
            <path
              d="M 4 8.5 A 11.5 11.5 0 0 1 20 8.5"
              stroke="url(#grad-news)"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="cyber-anim-wave-2"
            />
          </svg>
        );

      case 'results':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon"
            style={{ filter: active ? 'drop-shadow(0 0 8px rgba(129, 140, 248, 0.6))' : 'drop-shadow(0 0 4px rgba(129, 140, 248, 0.3))' }}
          >
            <defs>
              <linearGradient id="grad-res" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            {/* Folded Document Outline */}
            <path
              d="M 5 3.5 C 5 2.67 5.67 2 6.5 2 L 14.5 2 L 19 6.5 L 19 20.5 C 19 21.33 18.33 22 17.5 22 L 6.5 22 C 5.67 22 5 21.33 5 20.5 Z"
              stroke="url(#grad-res)"
              strokeWidth="1.5"
              fill="rgba(99, 102, 241, 0.08)"
            />
            <path d="M 14 2 L 14 7 L 19 7" stroke="#818cf8" strokeWidth="1.5" />
            {/* Embedded Financial Growth Graph */}
            <line x1="8" y1="17" x2="8" y2="14" stroke="#00f59b" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="17" x2="12" y2="11" stroke="#00f59b" strokeWidth="2" strokeLinecap="round" />
            <line x1="16" y1="17" x2="16" y2="9" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );

      case 'promoter':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon"
            style={{ filter: active ? 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.65))' : 'drop-shadow(0 0 4px rgba(56, 189, 248, 0.3))' }}
          >
            <defs>
              <linearGradient id="grad-shield" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
            </defs>
            {/* Cyber Shield Perimeter */}
            <path
              d="M 12 2.5 L 20 6 C 20 13 16 19.5 12 21.5 C 8 19.5 4 13 4 6 Z"
              stroke="url(#grad-shield)"
              strokeWidth="1.6"
              fill="rgba(56, 189, 248, 0.08)"
              strokeLinejoin="round"
            />
            {/* Target Reticle / Perimeter Sensor */}
            <circle cx="12" cy="11.5" r="3.5" stroke="#38bdf8" strokeWidth="1.2" opacity="0.8" />
            <circle cx="12" cy="11.5" r="1.5" fill="#00f59b" />
          </svg>
        );

      case 'papertrading':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon"
            style={{ filter: active ? 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.65))' : 'drop-shadow(0 0 4px rgba(168, 85, 247, 0.3))' }}
          >
            <defs>
              <linearGradient id="grad-paper" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#9333ea" />
              </linearGradient>
            </defs>
            {/* Simulation Terminal Bracket HUD */}
            <path
              d="M 7 4 L 3.5 4 C 2.67 4 2 4.67 2 5.5 L 2 18.5 C 2 19.33 2.67 20 3.5 20 L 7 20"
              stroke="url(#grad-paper)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M 17 4 L 20.5 4 C 21.33 4 22 4.67 22 5.5 L 22 18.5 C 22 19.33 21.33 20 20.5 20 L 17 20"
              stroke="url(#grad-paper)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Interactive Command Prompt `>_` */}
            <path
              d="M 6.5 9 L 10.5 12 L 6.5 15"
              stroke="#00f59b"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line x1="12.5" y1="15" x2="16.5" y2="15" stroke="#00f59b" strokeWidth="2" strokeLinecap="round" className="cyber-anim-blink" />
          </svg>
        );

      case 'admin':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon cyber-anim-gear"
            style={{ filter: active ? 'drop-shadow(0 0 8px rgba(148, 163, 184, 0.6))' : 'drop-shadow(0 0 3px rgba(148, 163, 184, 0.25))' }}
          >
            {/* Hex Reactor / Cybernetic Gear */}
            <path
              d="M 12 15 A 3 3 0 1 0 12 9 A 3 3 0 0 0 12 15 Z"
              stroke="#38bdf8"
              strokeWidth="1.5"
              fill="rgba(56, 189, 248, 0.15)"
            />
            <path
              d="M 19.4 15 A 1.65 1.65 0 0 0 19.73 16.82 L 19.86 16.95 A 2 2 0 1 1 17 19.83 L 16.87 19.7 A 1.65 1.65 0 0 0 15.05 19.37 A 1.65 1.65 0 0 0 14.18 20.73 L 14.18 21 A 2 2 0 1 1 10.18 21 L 10.18 20.73 A 1.65 1.65 0 0 0 9.31 19.37 A 1.65 1.65 0 0 0 7.49 19.7 L 7.36 19.83 A 2 2 0 1 1 4.53 17 L 4.66 16.87 A 1.65 1.65 0 0 0 4.99 15.05 A 1.65 1.65 0 0 0 3.63 14.18 L 3.36 14.18 A 2 2 0 1 1 3.36 10.18 L 3.63 10.18 A 1.65 1.65 0 0 0 4.99 9.31 A 1.65 1.65 0 0 0 4.66 7.49 L 4.53 7.36 A 2 2 0 1 1 7.36 4.53 L 7.49 4.66 A 1.65 1.65 0 0 0 9.31 4.99 A 1.65 1.65 0 0 0 10.18 3.63 L 10.18 3.36 A 2 2 0 1 1 14.18 3.36 L 14.18 3.63 A 1.65 1.65 0 0 0 15.05 4.99 A 1.65 1.65 0 0 0 16.87 4.66 L 17 4.53 A 2 2 0 1 1 19.83 7.36 L 19.7 7.49 A 1.65 1.65 0 0 0 19.37 9.31 A 1.65 1.65 0 0 0 20.73 10.18 L 21 10.18 A 2 2 0 1 1 21 14.18 L 20.73 14.18 A 1.65 1.65 0 0 0 19.4 15 Z"
              stroke="#94a3b8"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'bull':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon"
            style={{ filter: 'drop-shadow(0 0 6px rgba(0, 245, 155, 0.65))' }}
          >
            {/* Bull Horns & Head Geometric Vector */}
            <path
              d="M 3 5 C 6 8 8 11 8 15 C 8 18 10 20 12 20 C 14 20 16 18 16 15 C 16 11 18 8 21 5 C 19 9 17 11 15 12 C 15 15 14 17 12 17 C 10 17 9 15 9 12 C 7 11 5 9 3 5 Z"
              fill="#00f59b"
            />
            {/* Glowing Bull Eyes */}
            <circle cx="10" cy="14" r="1.2" fill="#020b08" />
            <circle cx="14" cy="14" r="1.2" fill="#020b08" />
          </svg>
        );

      case 'bear':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon"
            style={{ filter: 'drop-shadow(0 0 6px rgba(244, 63, 94, 0.65))' }}
          >
            {/* Bear Claws / Head Geometric Vector */}
            <path
              d="M 5 6 C 5 4 7 4 8 5 C 9 6 10 7 12 7 C 14 7 15 6 16 5 C 17 4 19 4 19 6 C 19 9 18 12 17 15 C 15 19 13 20 12 20 C 11 20 9 19 7 15 C 6 12 5 9 5 6 Z"
              fill="#f43f5e"
            />
            {/* Downward Slanted Aggressive Eyes */}
            <line x1="9" y1="12" x2="10.5" y2="13" stroke="#020b08" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="15" y1="12" x2="13.5" y2="13" stroke="#020b08" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );

      case 'pulse_up':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon"
            style={{ filter: 'drop-shadow(0 0 8px rgba(0, 245, 155, 0.7))' }}
          >
            <circle cx="12" cy="12" r="10" stroke="#00f59b" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.4" />
            <path
              d="M 12 5 L 18 11 L 14 11 L 14 19 L 10 19 L 10 11 L 6 11 Z"
              fill="#00f59b"
            />
          </svg>
        );

      case 'pulse_down':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon"
            style={{ filter: 'drop-shadow(0 0 8px rgba(244, 63, 94, 0.7))' }}
          >
            <circle cx="12" cy="12" r="10" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.4" />
            <path
              d="M 12 19 L 6 13 L 10 13 L 10 5 L 14 5 L 14 13 L 18 13 Z"
              fill="#f43f5e"
            />
          </svg>
        );

      case 'spike':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="cyber-icon"
            style={{ filter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.7))' }}
          >
            <path
              d="M 13 2 L 4 13.5 L 11.5 13.5 L 9.5 22 L 20 9.5 L 13.5 9.5 Z"
              fill="#f59e0b"
            />
          </svg>
        );

      default:
        return null;
    }
  };

  return (
    <span
      className={`cyber-icon-wrapper ${active ? 'active' : ''} ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        ...style,
      }}
    >
      {renderIcon()}
    </span>
  );
};
