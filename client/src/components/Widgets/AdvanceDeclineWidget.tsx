import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { audioAlerts } from '../../utils/audioAlerts';
import { Gauge } from 'lucide-react';
import { AnimatedNumber } from '../common/AnimatedNumber';
import { MarketBreadthRadar } from '../common/MarketBreadthRadar';

interface AdvanceDeclineProps {
  stats?: {
    total: number;
    gainers: number;
    losers: number;
    unchanged: number;
    advanceDeclineRatio: number;
  };
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
          
          <div className="ad-status-pills">
            <span className={`ad-sentiment-pill ${isBullish ? 'bull' : isNeutral ? 'neutral' : 'bear'}`}>
              <span className="telemetry-dot" />
              {isBullish ? 'BULL BIAS' : isNeutral ? 'NEUTRAL' : 'BEAR BIAS'}
            </span>
            <span className="ad-ratio-pill tabular-nums font-mono font-bold">
              A/D RATIO: {adRatio}
            </span>
          </div>
        </div>

        {/* Dynamic Dual-Phase Breadth Laser Bar */}
        <div className="ad-track-shell">
          <div 
            className="ad-bar-advancing" 
            style={{ width: `${gainerPct}%` }}
          />
          <div 
            className="ad-bar-declining" 
            style={{ width: `${loserPct}%` }}
          />
        </div>

        {/* Sub-Legend Hardware Footer */}
        <div className="ad-footer-legend">
          <div className="ad-legend-item bull">
            <span className="ad-pulse-light bull" />
            <span className="tabular-nums font-mono font-bold">
              <AnimatedNumber value={stats.gainers} duration={0.8} /> advancing ({gainerPct.toFixed(1)}%)
            </span>
          </div>
          <div className="ad-legend-item neutral font-mono text-xs">
            {stats.unchanged} flat / sideways
          </div>
          <div className="ad-legend-item bear">
            <span className="ad-pulse-light bear" />
            <span className="tabular-nums font-mono font-bold">
              <AnimatedNumber value={stats.losers} duration={0.8} /> declining ({loserPct.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Live Circular Radar Scope */}
        <MarketBreadthRadar 
          advancers={stats.gainers} 
          decliners={stats.losers} 
          unchanged={stats.unchanged} 
          total={stats.total} 
          adRatio={stats.advanceDeclineRatio} 
        />
      </div>
    </div>
  );
}

function AdvanceDeclineWithHook() {
  const { stats } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  return <AdvanceDeclineContent stats={stats} />;
}

export function AdvanceDeclineWidget({ stats }: AdvanceDeclineProps) {
  if (stats) return <AdvanceDeclineContent stats={stats} />;
  return <AdvanceDeclineWithHook />;
}
