import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { CometCard } from '../ui/comet-card';
import { audioAlerts } from '../../utils/audioAlerts';
import { AnimatedEmoji } from '../common/AnimatedEmoji';

export function StatsWidget() {
  const { stats } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  
  const gainerPct = stats.total > 0 ? ((stats.gainers / stats.total) * 100).toFixed(1) : '0';
  const loserPct = stats.total > 0 ? ((stats.losers / stats.total) * 100).toFixed(1) : '0';
  const unchPct = stats.total > 0 ? ((stats.unchanged / stats.total) * 100).toFixed(1) : '0';

  return (
    <div className="stats-row">
      <CometCard>
        <div 
          className="stat-card" 
          onMouseEnter={() => audioAlerts.playClickHaptic()}
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          <div className="stat-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-2)' }}>
              <span className="telemetry-dot live" style={{ width: 6, height: 6 }} />
              UNIVERSE
            </span>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: 'var(--text-1)' }}>
              NSE CASH
            </span>
          </div>
          <div className="stat-value num tabular-nums" style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {stats.total}
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-3)' }}>TICKERS</span>
          </div>
          <div className="stat-delta" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--amber)' }} />
            Nifty 500 + Nifty 50 Active
          </div>
        </div>
      </CometCard>

      <CometCard>
        <div 
          className="stat-card" 
          onMouseEnter={() => audioAlerts.playClickHaptic()}
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          <div className="stat-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', color: 'var(--up)' }}>
              <AnimatedEmoji name="rocket" size={16} /> ADVANCING
            </span>
            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--up)' }}>
              {gainerPct}%
            </span>
          </div>
          <div className="stat-value num up tabular-nums" style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {stats.gainers}
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--up)' }}>▲</span>
          </div>
          <div className="stat-delta" style={{ marginTop: 8 }}>
            <div style={{ height: 4, width: '100%', background: 'rgba(16, 185, 129, 0.15)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${gainerPct}%`, background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: 2, transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>
      </CometCard>

      <CometCard>
        <div 
          className="stat-card" 
          onMouseEnter={() => audioAlerts.playClickHaptic()}
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          <div className="stat-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', color: 'var(--down)' }}>
              <AnimatedEmoji name="blood" size={16} /> DECLINING
            </span>
            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: 12, background: 'rgba(239, 68, 68, 0.15)', color: 'var(--down)' }}>
              {loserPct}%
            </span>
          </div>
          <div className="stat-value num down tabular-nums" style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {stats.losers}
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--down)' }}>▼</span>
          </div>
          <div className="stat-delta" style={{ marginTop: 8 }}>
            <div style={{ height: 4, width: '100%', background: 'rgba(239, 68, 68, 0.15)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${loserPct}%`, background: 'linear-gradient(90deg, #ef4444, #f87171)', borderRadius: 2, transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>
      </CometCard>

      <CometCard>
        <div 
          className="stat-card" 
          onMouseEnter={() => audioAlerts.playClickHaptic()}
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          <div className="stat-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-2)' }}>
              <AnimatedEmoji name="scale" size={16} /> UNCHANGED
            </span>
            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: 'var(--text-2)' }}>
              {unchPct}%
            </span>
          </div>
          <div className="stat-value num tabular-nums" style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', display: 'flex', alignItems: 'baseline', gap: 6, color: 'var(--text-1)' }}>
            {stats.unchanged}
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-3)' }}>―</span>
          </div>
          <div className="stat-delta" style={{ marginTop: 8 }}>
            <div style={{ height: 4, width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${unchPct}%`, background: 'rgba(255,255,255,0.25)', borderRadius: 2, transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>
      </CometCard>
    </div>
  );
}
