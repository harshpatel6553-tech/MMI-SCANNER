import React from 'react';
import { motion } from 'framer-motion';

interface MarketBreadthRadarProps {
  advancers: number;
  decliners: number;
  unchanged: number;
  total: number;
  adRatio: number;
  size?: number;
}

export function MarketBreadthRadar({
  advancers,
  decliners,
  unchanged,
  total,
  adRatio,
  size = 72
}: MarketBreadthRadarProps) {
  const isBull = advancers >= decliners;
  const bullPct = total > 0 ? (advancers / total) * 100 : 50;

  return (
    <div 
      className="market-breadth-radar-shell"
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle, rgba(16, 26, 43, 0.9) 0%, rgba(7, 11, 18, 0.98) 100%)',
        border: '1px solid rgba(40, 207, 255, 0.25)',
        boxShadow: 'inset 0 0 14px rgba(40, 207, 255, 0.1), 0 4px 12px rgba(0, 0, 0, 0.6)',
        overflow: 'hidden'
      }}
    >
      {/* Concentric Radar Rings */}
      <div 
        style={{
          position: 'absolute',
          width: '70%',
          height: '70%',
          borderRadius: '50%',
          border: '1px dashed rgba(255, 255, 255, 0.1)'
        }}
      />
      <div 
        style={{
          position: 'absolute',
          width: '40%',
          height: '40%',
          borderRadius: '50%',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      />

      {/* Crosshairs */}
      <div 
        style={{
          position: 'absolute',
          width: '100%',
          height: '1px',
          background: 'rgba(255, 255, 255, 0.06)'
        }}
      />
      <div 
        style={{
          position: 'absolute',
          height: '100%',
          width: '1px',
          background: 'rgba(255, 255, 255, 0.06)'
        }}
      />

      {/* Rotating Radar Sweep Cone */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: 'conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(40, 207, 255, 0.28) 360deg)',
          pointerEvents: 'none'
        }}
      />

      {/* Center Dynamic Telemetry Value */}
      <div 
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1
        }}
      >
        <span 
          className="tabular-nums font-mono" 
          style={{ 
            fontSize: 11, 
            fontWeight: 800, 
            color: isBull ? 'var(--up)' : 'var(--down)',
            letterSpacing: '-0.02em'
          }}
        >
          {adRatio === Infinity ? 'INF' : adRatio.toFixed(2)}
        </span>
        <span 
          style={{ 
            fontSize: 8, 
            fontWeight: 700, 
            letterSpacing: '0.06em', 
            color: 'var(--text-3)',
            marginTop: 2
          }}
        >
          RATIO
        </span>
      </div>
    </div>
  );
}
