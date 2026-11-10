import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { audioAlerts } from '../../utils/audioAlerts';
import { Layers, TrendingUp, TrendingDown } from 'lucide-react';
import { AnimatedNumber } from '../common/AnimatedNumber';

interface StatsProps {
  stats?: {
    total: number;
    gainers: number;
    losers: number;
    unchanged: number;
    advanceDeclineRatio: number;
  };
}

function StatsWidgetContent({ stats }: { stats: NonNullable<StatsProps['stats']> }) {
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
              {stats.total > 0 ? ((stats.gainers / stats.total) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <div className="stat-value num bull tabular-nums font-mono">
            <AnimatedNumber value={stats.gainers} duration={0.8} />
            <span className="stat-icon-ind">▲</span>
          </div>
          <div className="stat-gauge-track">
            <div 
              className="stat-gauge-bar bull" 
              style={{ width: `${stats.total > 0 ? (stats.gainers / stats.total) * 100 : 0}%` }} 
            />
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
              {stats.total > 0 ? ((stats.losers / stats.total) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <div className="stat-value num bear tabular-nums font-mono">
            <AnimatedNumber value={stats.losers} duration={0.8} />
            <span className="stat-icon-ind">▼</span>
          </div>
          <div className="stat-gauge-track">
            <div 
              className="stat-gauge-bar bear" 
              style={{ width: `${stats.total > 0 ? (stats.losers / stats.total) * 100 : 0}%` }} 
            />
          </div>
        </div>
      </div>

      {/* 4. FLAT / NEUTRAL */}
      <div 
        className="stat-hardware-shell"
        onMouseEnter={() => audioAlerts.playClickHaptic()}
      >
        <div className="stat-hardware-core">
          <div className="stat-label">
            <span className="stat-label-left">
              <span className="stat-icon-flat font-mono font-bold">~</span>
              <span>FLAT / SIDEWAYS</span>
            </span>
            <span className="stat-badge-tag neutral">
              {stats.total > 0 ? ((stats.unchanged / stats.total) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <div className="stat-value num muted tabular-nums font-mono">
            <AnimatedNumber value={stats.unchanged} duration={0.8} />
            <span className="stat-unit">FLAT</span>
          </div>
          <div className="stat-delta">
            <span>Rangebound Neutrality</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsWidgetWithHook() {
  const { stats } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  return <StatsWidgetContent stats={stats} />;
}

export function StatsWidget({ stats }: StatsProps) {
  if (stats) return <StatsWidgetContent stats={stats} />;
  return <StatsWidgetWithHook />;
}
