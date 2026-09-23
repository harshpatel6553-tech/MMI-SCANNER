import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { CometCard } from '../ui/comet-card';
import { audioAlerts } from '../../utils/audioAlerts';
import { AnimatedEmoji } from '../common/AnimatedEmoji';

export function AdvanceDeclineWidget() {
  const { stats } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');

  const gainerPct = stats.total > 0 ? ((stats.gainers / stats.total) * 100) : 50;
  const loserPct = stats.total > 0 ? ((stats.losers / stats.total) * 100) : 50;
  const adRatio = stats.advanceDeclineRatio === Infinity ? '∞' : stats.advanceDeclineRatio.toFixed(2);
  
  const isBullish = stats.gainers > stats.losers;
  const isNeutral = stats.gainers === stats.losers;

  return (
    <CometCard>
      <div 
        className="ad-card" 
        onMouseEnter={() => audioAlerts.playClickHaptic()}
        style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}
      >
        <div className="ad-head" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AnimatedEmoji name="swords" size={22} />
            <div>
              <span className="t" style={{ fontSize: '13.5px', fontWeight: 800, letterSpacing: '-0.01em' }}>
                MARKET BREADTH TELEMETRY
              </span>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 2 }}>
                Real-time Advance to Decline ratio across all tracked securities
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span 
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                padding: '4px 10px',
                borderRadius: '8px',
                border: isBullish ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
                background: isBullish ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                color: isBullish ? 'var(--up)' : 'var(--down)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {isBullish ? (
                <>
                  <AnimatedEmoji name="bull" size={14} /> BULL BIAS
                </>
              ) : isNeutral ? (
                <>
                  <AnimatedEmoji name="scale" size={14} /> NEUTRAL
                </>
              ) : (
                <>
                  <AnimatedEmoji name="bear" size={14} /> BEAR BIAS
                </>
              )}
            </span>
            <span className="r tabular-nums" style={{ fontWeight: 800, fontSize: '12.5px', padding: '4px 10px', borderRadius: 8 }}>
              A/D RATIO: {adRatio}
            </span>
          </div>
        </div>

        {/* Dual Neon Laser Bar with Smooth Transitions */}
        <div style={{ position: 'relative' }}>
          <div className="ad-bar" style={{ height: 12, borderRadius: 8, background: 'rgba(255,255,255,0.06)', padding: 2, display: 'flex', gap: 2 }}>
            <div 
              style={{
                width: `${gainerPct}%`,
                background: 'linear-gradient(90deg, #059669, #10b981)',
                borderRadius: '6px 0 0 6px',
                transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)'
              }}
            />
            <div 
              style={{
                width: `${loserPct}%`,
                background: 'linear-gradient(90deg, #ef4444, #dc2626)',
                borderRadius: '0 6px 6px 0',
                transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)'
              }}
            />
          </div>
        </div>

        <div className="ad-labels" style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px' }}>
            <span style={{ color: 'var(--up)', fontWeight: 800 }}>▲</span>
            <span><b className="num tabular-nums" style={{ color: 'var(--up)', fontSize: '13px' }}>{stats.gainers}</b> advancing ({gainerPct.toFixed(1)}%)</span>
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600 }}>
            {stats.unchanged} flat / sideways
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px' }}>
            <span><b className="num tabular-nums" style={{ color: 'var(--down)', fontSize: '13px' }}>{stats.losers}</b> declining ({loserPct.toFixed(1)}%)</span>
            <span style={{ color: 'var(--down)', fontWeight: 800 }}>▼</span>
          </span>
        </div>
      </div>
    </CometCard>
  );
}
