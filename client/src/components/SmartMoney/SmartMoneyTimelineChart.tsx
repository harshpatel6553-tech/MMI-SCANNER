import React, { useState, useMemo } from 'react';
import { Clock, TrendingUp, TrendingDown, Activity, Zap, Shield, HelpCircle } from 'lucide-react';
import { audioAlerts } from '../../utils/audioAlerts';

export interface IntradayFlowPoint {
  time: string;           // '09:15', '09:30', ... '15:30'
  timeInMinutes: number;  // 555, 570, ... 930
  inflowCr: number;       // Cumulative Buys (Cr)
  outflowCr: number;      // Cumulative Sells (Cr)
  netDeltaCr: number;     // Cumulative Net Delta (Cr)
  fiiNetCr: number;       // Cumulative FII Flow (Cr)
  diiNetCr: number;       // Cumulative DII Flow (Cr)
  intervalVelocityCr: number; // Flow added in this 15-min interval
  cumulativeTurnoverCr: number;
  phase: string;          // Session phase label
  isProjected: boolean;   // True if future in active session
}

export interface MarketSessionInfo {
  isMarketOpen: boolean;
  sessionStart: string;   // '09:15'
  sessionEnd: string;     // '15:30'
  currentTimeIST: string;
  sessionProgressPct: number;
  sessionStatus: 'PRE_OPEN' | 'LIVE_SESSION' | 'CLOSING_POWER_HOUR' | 'MARKET_CLOSED';
  sessionStatusLabel: string;
  timeRemainingMinutes: number;
}

interface SmartMoneyTimelineChartProps {
  timeline: IntradayFlowPoint[];
  marketSession?: MarketSessionInfo;
  isCompact?: boolean;
}

export const SmartMoneyTimelineChart: React.FC<SmartMoneyTimelineChartProps> = ({
  timeline,
  marketSession,
  isCompact = false,
}) => {
  const [activeMetric, setActiveMetric] = useState<'FLOW' | 'FII_DII' | 'VELOCITY'>('FLOW');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const formatCr = (val: number) => {
    const abs = Math.abs(val);
    if (abs >= 1000) return `₹${(val / 1000).toFixed(2)}K Cr`;
    return `₹${val.toFixed(2)} Cr`;
  };

  // Safe timeline with fallback
  const safeTimeline = useMemo(() => {
    if (timeline && timeline.length > 0) return timeline;
    return [];
  }, [timeline]);

  // Max scale calculation for SVG coordinates
  const { maxVal, minVal, chartPoints } = useMemo(() => {
    if (safeTimeline.length === 0) {
      return { maxVal: 35000, minVal: -35000, chartPoints: [] };
    }

    let max = 0;
    let min = 0;

    safeTimeline.forEach(p => {
      if (activeMetric === 'FLOW') {
        max = Math.max(max, p.inflowCr, Math.abs(p.netDeltaCr));
        min = Math.min(min, -p.outflowCr, p.netDeltaCr);
      } else if (activeMetric === 'FII_DII') {
        max = Math.max(max, Math.abs(p.fiiNetCr), Math.abs(p.diiNetCr));
        min = Math.min(min, -Math.abs(p.fiiNetCr), -Math.abs(p.diiNetCr));
      } else {
        max = Math.max(max, Math.abs(p.intervalVelocityCr));
        min = Math.min(min, -Math.abs(p.intervalVelocityCr));
      }
    });

    // Provide headroom
    const buffer = (max - min) * 0.12 || 5000;
    const finalMax = Math.max(max + buffer, 2000);
    const finalMin = Math.min(min - buffer, -2000);

    const width = 1000;
    const height = isCompact ? 180 : 300;
    const paddingX = 45;
    const paddingY = 25;
    const usableWidth = width - (paddingX * 2);
    const usableHeight = height - (paddingY * 2);

    const getY = (val: number) => {
      const range = finalMax - finalMin || 1;
      const normalized = (val - finalMin) / range;
      return height - paddingY - (normalized * usableHeight);
    };

    const points = safeTimeline.map((p, idx) => {
      const x = paddingX + (idx / (safeTimeline.length - 1)) * usableWidth;
      return {
        x,
        yInflow: getY(p.inflowCr),
        yOutflow: getY(-p.outflowCr),
        yNet: getY(p.netDeltaCr),
        yFii: getY(p.fiiNetCr),
        yDii: getY(p.diiNetCr),
        yVelocity: getY(p.intervalVelocityCr),
        zeroY: getY(0),
        data: p,
        index: idx
      };
    });

    return { maxVal: finalMax, minVal: finalMin, chartPoints: points };
  }, [safeTimeline, activeMetric, isCompact]);

  // Phase aggregation metrics
  const phaseStats = useMemo(() => {
    if (safeTimeline.length === 0) return null;

    const morning = safeTimeline.find(p => p.time === '10:30') || safeTimeline[5];
    const midday = safeTimeline.find(p => p.time === '13:00') || safeTimeline[15];
    const closing = safeTimeline[safeTimeline.length - 1];

    let peakVel = safeTimeline[0];
    safeTimeline.forEach(p => {
      if (Math.abs(p.intervalVelocityCr) > Math.abs(peakVel.intervalVelocityCr)) {
        peakVel = p;
      }
    });

    return {
      morningNet: morning?.netDeltaCr ?? 0,
      middayNet: midday?.netDeltaCr ?? 0,
      closingNet: closing?.netDeltaCr ?? 0,
      peakVelocity: peakVel?.intervalVelocityCr ?? 0,
      peakVelocityTime: peakVel?.time ?? '14:30',
    };
  }, [safeTimeline]);

  if (safeTimeline.length === 0) {
    return null;
  }

  // Active point under crosshair or last point
  const currentHovered = hoveredIndex !== null && chartPoints[hoveredIndex]
    ? chartPoints[hoveredIndex]
    : chartPoints[chartPoints.length - 1];

  const zeroY = chartPoints[0]?.zeroY ?? (isCompact ? 90 : 150);

  // SVG Path generation
  const buildPath = (key: 'yInflow' | 'yOutflow' | 'yNet' | 'yFii' | 'yDii') => {
    if (chartPoints.length === 0) return '';
    return chartPoints.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x} ${pt[key]}` : `${acc} L ${pt.x} ${pt[key]}`;
    }, '');
  };

  const buildAreaPath = (key: 'yInflow' | 'yOutflow') => {
    if (chartPoints.length === 0) return '';
    const linePath = buildPath(key);
    const lastX = chartPoints[chartPoints.length - 1].x;
    const firstX = chartPoints[0].x;
    return `${linePath} L ${lastX} ${zeroY} L ${firstX} ${zeroY} Z`;
  };

  return (
    <div className={`sm-timeline-wrapper ${isCompact ? 'compact-mode' : ''}`}>
      {/* ── Header: Session Live Monitor & View Switchers ─────── */}
      <div className="sm-timeline-header">
        <div className="sm-timeline-left">
          <div className="sm-timeline-beacon-wrap">
            <div className={`sm-timeline-beacon ${marketSession?.isMarketOpen ? 'live-pulse' : 'closed-glow'}`} />
            <div>
              <div className="sm-timeline-title">
                REAL-TIME INTRADAY FLOW TELEMETRY (09:15 — 15:30 IST)
              </div>
              <div className="sm-timeline-sub">
                {marketSession?.sessionStatusLabel || '09:15 - 15:30 IST Cash & Derivatives Capital Deployment'}
              </div>
            </div>
          </div>
        </div>

        {/* View Switcher Chips */}
        {!isCompact && (
          <div className="sm-view-chips">
            <button
              className={`sm-chip ${activeMetric === 'FLOW' ? 'active' : ''}`}
              onClick={() => {
                audioAlerts.playHapticClick();
                setActiveMetric('FLOW');
              }}
            >
              <Activity size={12} />
              <span>Inflow vs Outflow</span>
            </button>

            <button
              className={`sm-chip ${activeMetric === 'FII_DII' ? 'active' : ''}`}
              onClick={() => {
                audioAlerts.playHapticClick();
                setActiveMetric('FII_DII');
              }}
            >
              <Shield size={12} />
              <span>FII vs DII Battle</span>
            </button>

            <button
              className={`sm-chip ${activeMetric === 'VELOCITY' ? 'active' : ''}`}
              onClick={() => {
                audioAlerts.playHapticClick();
                setActiveMetric('VELOCITY');
              }}
            >
              <Zap size={12} />
              <span>15m Velocity</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Session Progress Track ──────────────────────────── */}
      <div className="sm-session-track-bar">
        <div className="sm-session-labels">
          <span className="sm-time-tag">09:15 AM (OPEN)</span>
          <span className="sm-time-center">
            {marketSession?.isMarketOpen ? '● LIVE TRADING SESSION' : '● FINAL SESSION ARCHIVED'}
            {marketSession?.currentTimeIST ? ` • CURRENT: ${marketSession.currentTimeIST}` : ''}
          </span>
          <span className="sm-time-tag">03:30 PM (CLOSE)</span>
        </div>
        <div className="sm-progress-line">
          <div
            className="sm-progress-fill"
            style={{ width: `${marketSession?.sessionProgressPct ?? 100}%` }}
          />
          <div
            className="sm-progress-marker"
            style={{ left: `${marketSession?.sessionProgressPct ?? 100}%` }}
          >
            <div className="sm-marker-ping" />
          </div>
        </div>
      </div>

      {/* ── Interactive Multi-Layer SVG Flow Canvas ─────────── */}
      <div className="sm-chart-container" style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
        <svg
          viewBox={`0 0 1000 ${isCompact ? 180 : 300}`}
          preserveAspectRatio="none"
          className="sm-timeline-svg"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            {/* Inflow Area Gradient (Green) */}
            <linearGradient id="smInflowAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00D6A3" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#00D6A3" stopOpacity="0.0" />
            </linearGradient>

            {/* Outflow Area Gradient (Red) */}
            <linearGradient id="smOutflowAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF4268" stopOpacity="0.0" />
              <stop offset="100%" stopColor="#FF4268" stopOpacity="0.4" />
            </linearGradient>

            {/* Net Delta Line Gradient (Cyan to Gold) */}
            <linearGradient id="smNetLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#28CFFF" />
              <stop offset="100%" stopColor="#00D6A3" />
            </linearGradient>

            {/* FII Line Gradient */}
            <linearGradient id="smFiiLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FF4268" />
              <stop offset="100%" stopColor="#FF859B" />
            </linearGradient>

            {/* Glow Filter */}
            <filter id="smLineGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid Background Horizontal Lines */}
          <line x1="45" y1={zeroY} x2="955" y2={zeroY} stroke="#243249" strokeWidth="1.5" strokeDasharray="4 4" />
          <line x1="45" y1="25" x2="955" y2="25" stroke="rgba(36, 50, 73, 0.4)" strokeWidth="1" strokeDasharray="2 4" />
          <line x1="45" y1={isCompact ? 155 : 275} x2="955" y2={isCompact ? 155 : 275} stroke="rgba(36, 50, 73, 0.4)" strokeWidth="1" strokeDasharray="2 4" />

          {/* Key Time Vertical Grid Lines */}
          {chartPoints.map((pt, i) => {
            // Show lines on selected hourly intervals
            if (['09:15', '10:30', '12:00', '13:30', '14:30', '15:30'].includes(pt.data.time)) {
              return (
                <g key={`vgrid-${pt.data.time}`}>
                  <line
                    x1={pt.x}
                    y1="20"
                    x2={pt.x}
                    y2={isCompact ? 160 : 280}
                    stroke="rgba(36, 50, 73, 0.45)"
                    strokeWidth="1"
                  />
                  <text
                    x={pt.x}
                    y={isCompact ? 175 : 295}
                    textAnchor="middle"
                    fill="#64748B"
                    fontSize="10"
                    fontFamily="var(--font-mono, monospace)"
                    fontWeight="600"
                  >
                    {pt.data.time}
                  </text>
                </g>
              );
            }
            return null;
          })}

          {/* MODE 1: Inflow vs Outflow Dual Area + Net Line */}
          {activeMetric === 'FLOW' && (
            <>
              {/* Inflow Area (Above Zero) */}
              <path d={buildAreaPath('yInflow')} fill="url(#smInflowAreaGrad)" />
              <path d={buildPath('yInflow')} fill="none" stroke="#00D6A3" strokeWidth="1.8" />

              {/* Outflow Area (Below Zero) */}
              <path d={buildAreaPath('yOutflow')} fill="url(#smOutflowAreaGrad)" />
              <path d={buildPath('yOutflow')} fill="none" stroke="#FF4268" strokeWidth="1.8" />

              {/* Net Institutional Delta Line (Glowing Cyan) */}
              <path
                d={buildPath('yNet')}
                fill="none"
                stroke="url(#smNetLineGrad)"
                strokeWidth="2.8"
                filter="url(#smLineGlow)"
              />
            </>
          )}

          {/* MODE 2: FII vs DII Institutional Battle */}
          {activeMetric === 'FII_DII' && (
            <>
              {/* FII Net Trajectory */}
              <path
                d={buildPath('yFii')}
                fill="none"
                stroke="#FF4268"
                strokeWidth="2.5"
                filter="url(#smLineGlow)"
              />
              {/* DII Net Trajectory */}
              <path
                d={buildPath('yDii')}
                fill="none"
                stroke="#28CFFF"
                strokeWidth="2.5"
                filter="url(#smLineGlow)"
              />
            </>
          )}

          {/* MODE 3: 15-Minute Flow Velocity Bars */}
          {activeMetric === 'VELOCITY' && (
            <>
              {chartPoints.map((pt) => {
                const isPos = pt.data.intervalVelocityCr >= 0;
                const barH = Math.max(2, Math.abs(pt.zeroY - pt.yVelocity));
                const barY = isPos ? pt.yVelocity : pt.zeroY;
                return (
                  <rect
                    key={`vel-${pt.data.time}`}
                    x={pt.x - 7}
                    y={barY}
                    width="14"
                    height={barH}
                    fill={isPos ? '#00D6A3' : '#FF4268'}
                    rx="2"
                    opacity="0.85"
                  />
                );
              })}
            </>
          )}

          {/* Interactive Hover Columns (Invisible hover hitboxes) */}
          {chartPoints.map((pt, idx) => (
            <rect
              key={`hit-${pt.data.time}`}
              x={pt.x - 16}
              y="0"
              width="32"
              height={isCompact ? 180 : 300}
              fill="transparent"
              style={{ cursor: 'crosshair' }}
              onMouseEnter={() => {
                setHoveredIndex(idx);
                audioAlerts.playHapticClick();
              }}
            />
          ))}

          {/* Crosshair & Active Node Indicator */}
          {currentHovered && (
            <g pointerEvents="none">
              {/* Vertical Crosshair Line */}
              <line
                x1={currentHovered.x}
                y1="15"
                x2={currentHovered.x}
                y2={isCompact ? 160 : 280}
                stroke="#28CFFF"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.8"
              />

              {/* Inflow Dot */}
              {activeMetric === 'FLOW' && (
                <>
                  <circle cx={currentHovered.x} cy={currentHovered.yInflow} r="4" fill="#00D6A3" stroke="#070B12" strokeWidth="2" />
                  <circle cx={currentHovered.x} cy={currentHovered.yOutflow} r="4" fill="#FF4268" stroke="#070B12" strokeWidth="2" />
                  <circle cx={currentHovered.x} cy={currentHovered.yNet} r="6" fill="#28CFFF" stroke="#070B12" strokeWidth="2.5" />
                </>
              )}

              {activeMetric === 'FII_DII' && (
                <>
                  <circle cx={currentHovered.x} cy={currentHovered.yFii} r="5" fill="#FF4268" stroke="#070B12" strokeWidth="2" />
                  <circle cx={currentHovered.x} cy={currentHovered.yDii} r="5" fill="#28CFFF" stroke="#070B12" strokeWidth="2" />
                </>
              )}
            </g>
          )}
        </svg>

        {/* ── Floating Institutional Crosshair Inspector Card ── */}
        {currentHovered && (
          <div
            className="sm-inspector-card"
            style={{
              position: 'absolute',
              top: 12,
              right: 18,
              pointerEvents: 'none',
              background: 'rgba(11, 18, 32, 0.94)',
              border: '1px solid #243249',
              borderRadius: 10,
              padding: '10px 14px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 260,
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#F1F5FC', fontFamily: 'var(--font-mono)' }}>
                {currentHovered.data.time} IST
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: currentHovered.data.netDeltaCr >= 0 ? 'rgba(0, 214, 163, 0.15)' : 'rgba(255, 66, 104, 0.15)',
                  color: currentHovered.data.netDeltaCr >= 0 ? '#00D6A3' : '#FF4268',
                }}
              >
                {currentHovered.data.netDeltaCr >= 0 ? 'NET ACCUMULATION' : 'NET DISTRIBUTION'}
              </span>
            </div>

            <div style={{ fontSize: 11, color: '#9BAAC0', fontStyle: 'italic', marginBottom: 4 }}>
              {currentHovered.data.phase}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <div>
                <span style={{ color: '#64748B' }}>Net Delta: </span>
                <span style={{ fontWeight: 700, color: currentHovered.data.netDeltaCr >= 0 ? '#00D6A3' : '#FF4268' }}>
                  {currentHovered.data.netDeltaCr >= 0 ? '+' : ''}{formatCr(currentHovered.data.netDeltaCr)}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>15m Velocity: </span>
                <span style={{ fontWeight: 700, color: currentHovered.data.intervalVelocityCr >= 0 ? '#00D6A3' : '#FF4268' }}>
                  {currentHovered.data.intervalVelocityCr >= 0 ? '+' : ''}{formatCr(currentHovered.data.intervalVelocityCr)}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Buys: </span>
                <span style={{ color: '#00D6A3', fontWeight: 600 }}>+{formatCr(currentHovered.data.inflowCr)}</span>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Sells: </span>
                <span style={{ color: '#FF4268', fontWeight: 600 }}>-{formatCr(currentHovered.data.outflowCr)}</span>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>FII Net: </span>
                <span style={{ color: currentHovered.data.fiiNetCr >= 0 ? '#00D6A3' : '#FF4268' }}>
                  {currentHovered.data.fiiNetCr >= 0 ? '+' : ''}{formatCr(currentHovered.data.fiiNetCr)}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>DII Net: </span>
                <span style={{ color: currentHovered.data.diiNetCr >= 0 ? '#00D6A3' : '#FF4268' }}>
                  {currentHovered.data.diiNetCr >= 0 ? '+' : ''}{formatCr(currentHovered.data.diiNetCr)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 4 Institutional Session Phase Metric Cards ──────── */}
      {!isCompact && phaseStats && (
        <div className="sm-phase-summary-grid">
          <div className="sm-phase-box">
            <span className="sm-phase-box-title">Opening Surge (09:15 - 10:30)</span>
            <span className={`sm-phase-box-val ${phaseStats.morningNet >= 0 ? 'up' : 'down'}`}>
              {phaseStats.morningNet >= 0 ? '+' : ''}{formatCr(phaseStats.morningNet)}
            </span>
            <span className="sm-phase-box-sub">Initial Gap & Trend Buildup</span>
          </div>

          <div className="sm-phase-box">
            <span className="sm-phase-box-title">Midday Flow (10:30 - 13:00)</span>
            <span className={`sm-phase-box-val ${phaseStats.middayNet >= 0 ? 'up' : 'down'}`}>
              {phaseStats.middayNet >= 0 ? '+' : ''}{formatCr(phaseStats.middayNet)}
            </span>
            <span className="sm-phase-box-sub">Sector Rotation & Consolidation</span>
          </div>

          <div className="sm-phase-box">
            <span className="sm-phase-box-title">Power Hour Tape (13:00 - 15:30)</span>
            <span className={`sm-phase-box-val ${phaseStats.closingNet >= 0 ? 'up' : 'down'}`}>
              {phaseStats.closingNet >= 0 ? '+' : ''}{formatCr(phaseStats.closingNet)}
            </span>
            <span className="sm-phase-box-sub">Final Institutional MOC Blocks</span>
          </div>

          <div className="sm-phase-box">
            <span className="sm-phase-box-title">Peak 15m Flow Velocity</span>
            <span className={`sm-phase-box-val ${phaseStats.peakVelocity >= 0 ? 'up' : 'down'}`}>
              {phaseStats.peakVelocity >= 0 ? '+' : ''}{formatCr(phaseStats.peakVelocity)}
            </span>
            <span className="sm-phase-box-sub">Detected at {phaseStats.peakVelocityTime} IST</span>
          </div>
        </div>
      )}
    </div>
  );
};
