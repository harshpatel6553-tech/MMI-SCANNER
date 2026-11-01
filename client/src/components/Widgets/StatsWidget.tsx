import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { audioAlerts } from '../../utils/audioAlerts';
import { Layers, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { AnimatedNumber } from '../common/AnimatedNumber';

export function StatsWidget() {
  const { stats } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  
  const gainerPct = stats.total > 0 ? ((stats.gainers / stats.total) * 100).toFixed(1) : '0';
  const loserPct = stats.total > 0 ? ((stats.losers / stats.total) * 100).toFixed(1) : '0';
  const unchPct = stats.total > 0 ? ((stats.unchanged / stats.total) * 100).toFixed(1) : '0';

  return (
    <div className="stats-row">
      {/* 1. UNIVERSE POOL */}
      <div 
        className="stat-hardware-shell"
        onMouseEnter={() => audioAlerts.playClickHaptic()}
      >
        <div className="stat-hardware-core">
          <div className="stat-label">
            <span className="stat-label-left">
              <Layers size={14} strokeWidth={1.5} className="text-cyan-400" />
              <span>UNIVERSE POOL</span>
            </span>
            <span className="stat-badge-tag neutral">
              NSE CASH
            </span>
          </div>
          <div className="stat-value num tabular-nums font-mono">
            <AnimatedNumber value={stats.total} duration={0.8} />
            <span className="stat-unit">TICKERS</span>
          </div>
          <div className="stat-delta">
            <span className="stat-sub-dot cyan" />
            <span>Nifty 500 + Nifty 50 Active</span>
          </div>
        </div>
      </div>

      {/* 2. ADVANCING */}
      <div 
        className="stat-hardware-shell is-bull"
        onMouseEnter={() => audioAlerts.playClickHaptic()}
      >
        <div className="stat-hardware-core">
          <div className="stat-label">
            <span className="stat-label-left bull">
              <TrendingUp size={14} strokeWidth={1.5} />
              <span>ADVANCING</span>
            </span>
            <span className="stat-badge-tag bull">
              {gainerPct}%
            </span>
          </div>
          <div className="stat-value num up tabular-nums font-mono">
            <AnimatedNumber value={stats.gainers} duration={0.8} />
            <span className="stat-direction-glyph">▲</span>
          </div>
          <div className="stat-delta">
            <div className="stat-bar-track">
              <div 
                className="stat-bar-fill bull" 
                style={{ width: `${gainerPct}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. DECLINING */}
      <div 
        className="stat-hardware-shell is-bear"
        onMouseEnter={() => audioAlerts.playClickHaptic()}
      >
        <div className="stat-hardware-core">
          <div className="stat-label">
            <span className="stat-label-left bear">
              <TrendingDown size={14} strokeWidth={1.5} />
              <span>DECLINING</span>
            </span>
            <span className="stat-badge-tag bear">
              {loserPct}%
            </span>
          </div>
          <div className="stat-value num down tabular-nums font-mono">
            <AnimatedNumber value={stats.losers} duration={0.8} />
            <span className="stat-direction-glyph">▼</span>
          </div>
          <div className="stat-delta">
            <div className="stat-bar-track">
              <div 
                className="stat-bar-fill bear" 
                style={{ width: `${loserPct}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. FLAT / SIDEWAYS */}
      <div 
        className="stat-hardware-shell"
        onMouseEnter={() => audioAlerts.playClickHaptic()}
      >
        <div className="stat-hardware-core">
          <div className="stat-label">
            <span className="stat-label-left">
              <Activity size={14} strokeWidth={1.5} className="text-slate-400" />
              <span>FLAT / SIDEWAYS</span>
            </span>
            <span className="stat-badge-tag neutral">
              {unchPct}%
            </span>
          </div>
          <div className="stat-value num tabular-nums font-mono">
            <AnimatedNumber value={stats.unchanged} duration={0.8} />
            <span className="stat-unit">FLAT</span>
          </div>
          <div className="stat-delta">
            <span className="stat-sub-dot neutral" />
            <span>Rangebound Neutrality</span>
          </div>
        </div>
      </div>
    </div>
  );
}
