import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { audioAlerts } from '../../utils/audioAlerts';
import { Activity, TrendingUp, TrendingDown, Gauge } from 'lucide-react';

export function AdvanceDeclineWidget() {
  const { stats } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');

  const gainerPct = stats.total > 0 ? ((stats.gainers / stats.total) * 100) : 50;
  const loserPct = stats.total > 0 ? ((stats.losers / stats.total) * 100) : 50;
  const adRatio = stats.advanceDeclineRatio === Infinity ? '∞' : stats.advanceDeclineRatio.toFixed(2);
  
  const isBullish = stats.gainers > stats.losers;
  const isNeutral = stats.gainers === stats.losers;

  return (
    <div className="ad-hardware-shell" onMouseEnter={() => audioAlerts.playClickHaptic()}>
      <div className="ad-hardware-core">
        <div className="ad-head">
          <div className="ad-title-group">
            <div className="ad-icon-badge">
              <Gauge size={18} strokeWidth={1.5} className="text-cyan-400" />
            </div>
            <div>
              <div className="ad-title-text">
                MARKET BREADTH TELEMETRY
              </div>
              <div className="ad-sub-text">
                Real-time Advance to Decline ratio across all tracked securities
              </div>
            </div>
          </div>

          <div className="ad-badges-group">
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
            <span className="ad-ratio-pill num tabular-nums">
              A/D RATIO: {adRatio}
            </span>
          </div>
        </div>

        {/* Dual Neon Laser Bar with Multi-Segment Progress */}
        <div className="ad-bar-container">
          <div className="ad-bar-track">
            <div 
              className="ad-bar-segment bull"
              style={{ width: `${gainerPct}%` }}
            />
            <div 
              className="ad-bar-segment bear"
              style={{ width: `${loserPct}%` }}
            />
          </div>
        </div>

        <div className="ad-labels-row">
          <span className="ad-label-item bull">
            <span className="glyph">▲</span>
            <span><b className="num tabular-nums">{stats.gainers}</b> advancing ({gainerPct.toFixed(1)}%)</span>
          </span>
          <span className="ad-label-center">
            {stats.unchanged} flat / sideways
          </span>
          <span className="ad-label-item bear">
            <span><b className="num tabular-nums">{stats.losers}</b> declining ({loserPct.toFixed(1)}%)</span>
            <span className="glyph">▼</span>
          </span>
        </div>
      </div>
    </div>
  );
}
