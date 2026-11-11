import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { audioAlerts } from '../../utils/audioAlerts';
import { Activity, TrendingUp, TrendingDown, Gauge } from 'lucide-react';
import { AnimatedNumber } from '../common/AnimatedNumber';

interface AdvanceDeclineProps {
  stats?: {
    total: number;
    gainers: number;
    losers: number;
    unchanged: number;
    advanceDeclineRatio: number;
  };
}

export function AdvanceDeclineWidget({ stats }: AdvanceDeclineProps) {
  if (stats) return <AdvanceDeclineContent stats={stats} />;
  return <AdvanceDeclineWithHook />;
}

function AdvanceDeclineWithHook() {
  const { stats } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  return <AdvanceDeclineContent stats={stats} />;
}

function AdvanceDeclineContent({ stats }: { stats: NonNullable<AdvanceDeclineProps['stats']> }) {
  const gainerPct = stats.total > 0 ? ((stats.gainers / stats.total) * 100) : 50;
  const loserPct = stats.total > 0 ? ((stats.losers / stats.total) * 100) : 50;
  const adRatio = stats.advanceDeclineRatio === Infinity ? '∞' : stats.advanceDeclineRatio.toFixed(2);
  
  const isBullish = stats.gainers > stats.losers;
  const isNeutral = stats.gainers === stats.losers;

  return (
    <div className="ad-hardware-shell" onMouseEnter={() => audioAlerts.playClickHaptic()}>
      <div className="ad-hardware-core">
        <div className="ad-head">
          <div className="ad-title-group" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="ad-icon-badge">
              <Gauge size={18} strokeWidth={1.5} className="text-cyan-400" />
            </div>
            <div>
              <div className="ad-title-text" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                MARKET BREADTH TELEMETRY
              </div>
              <div className="ad-sub-text">
                Real-time Advance to Decline ratio across all tracked securities
              </div>
            </div>
          </div>

          <div className="ad-badges-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`ad-bias-badge ${isBullish ? 'bull' : isNeutral ? 'neutral' : 'bear'}`}>
              {isBullish ? (
                <>
                  <TrendingUp size={13} strokeWidth={1.5} />
                  <span>BULL BIAS</span>
                </>
              ) : isNeutral ? (
                <>
                  <Activity size={13} strokeWidth={1.5} />
                  <span>NEUTRAL</span>
                </>
              ) : (
                <>
                  <TrendingDown size={13} strokeWidth={1.5} />
                  <span>BEAR BIAS</span>
                </>
              )}
            </span>
            <span className="ad-ratio-pill num tabular-nums font-mono">
              A/D RATIO: {adRatio}
            </span>
          </div>
        </div>

        {/* Dual Neon Laser Bar with Multi-Segment Progress */}
        <div className="ad-bar-container">
          <div className="ad-bar-track">
            <div 
              className="ad-bar-segment bull"
              style={{ width: `${gainerPct}%`, transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
            <div 
              className="ad-bar-segment bear"
              style={{ width: `${loserPct}%`, transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
          </div>
        </div>

        <div className="ad-labels-row font-mono">
          <span className="ad-label-item bull">
            <span className="glyph">▲</span>
            <span>
              <b className="num tabular-nums"><AnimatedNumber value={stats.gainers} duration={0.6} /></b> advancing ({gainerPct.toFixed(1)}%)
            </span>
          </span>
          <span className="ad-label-center">
            <AnimatedNumber value={stats.unchanged} duration={0.6} /> flat / sideways
          </span>
          <span className="ad-label-item bear">
            <span>
              <b className="num tabular-nums"><AnimatedNumber value={stats.losers} duration={0.6} /></b> declining ({loserPct.toFixed(1)}%)
            </span>
            <span className="glyph">▼</span>
          </span>
        </div>
      </div>
    </div>
  );
}
