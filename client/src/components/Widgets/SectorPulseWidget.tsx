import React, { useState } from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';
import { audioAlerts } from '../../utils/audioAlerts';
import { Radio, ArrowRight, BarChart2 } from 'lucide-react';

export function SectorPulseWidget() {
  const [tab, setTab] = useState<'top' | 'bottom'>('top');
  const { sectorData } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  const { setActiveTab } = useDashboard();

  const sortedSectors = Array.from(sectorData.entries()).map(([n, d]) => ({
    n,
    v: d.avgChange,
    gainers: d.gainers,
    losers: d.losers,
    total: d.totalStocks || (d.gainers + d.losers) || 1
  })).sort((a, b) => tab === 'top' ? b.v - a.v : a.v - b.v);
  
  const displaySectors = sortedSectors.slice(0, 5);

  return (
    <div className="bento-widget-shell">
      <div className="bento-widget-core">
        <div className="bento-card-header">
          <div className="bento-title-left">
            <div className="bento-icon-box">
              <Radio size={17} strokeWidth={1.5} className="text-cyan-400" />
            </div>
            <div>
              <span className="bento-card-title">Sector Pulse Radar</span>
              <div className="bento-card-subtitle">Real-time capital flow and industry breadth</div>
            </div>
          </div>

          <div className="bento-header-actions">
            <div className="bento-segment-control">
              <button
                type="button"
                className={`bento-seg-btn ${tab === 'top' ? 'active-bull' : ''}`}
                onClick={() => {
                  audioAlerts.playClickHaptic();
                  setTab('top');
                }}
              >
                <span>Leaders</span>
              </button>
              <button
                type="button"
                className={`bento-seg-btn ${tab === 'bottom' ? 'active-bear' : ''}`}
                onClick={() => {
                  audioAlerts.playClickHaptic();
                  setTab('bottom');
                }}
              >
                <span>Laggards</span>
              </button>
            </div>

            <button
              type="button"
              className="bento-link-btn"
              onClick={() => {
                audioAlerts.playClickHaptic();
                setActiveTab('Sectors');
              }}
            >
              <span>All Sectors</span>
              <ArrowRight size={13} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="bento-list-body">
          {displaySectors.map((s) => {
            const up = s.v >= 0;
            const gainerRatio = Math.round((s.gainers / (s.gainers + s.losers || 1)) * 100);
            return (
              <div 
                className="sector-row-item" 
                key={s.n} 
                onClick={() => {
                  audioAlerts.playClickHaptic();
                  setActiveTab('Sectors');
                }}
                title={`Open ${s.n} sector breakdown`}
              >
                <div className="sector-info-col">
                  <span className="sector-name-text">{s.n}</span>
                  <div className="sector-ratio-track">
                    <div 
                      className="sector-ratio-fill bull" 
                      style={{ width: `${gainerRatio}%` }} 
                    />
                    <div 
                      className="sector-ratio-fill bear" 
                      style={{ width: `${100 - gainerRatio}%` }} 
                    />
                  </div>
                </div>

                <div className="sector-breadth-split">
                  <span className="breadth-up"><b className="num tabular-nums">{s.gainers}</b>▲</span>
                  <span className="divider">/</span>
                  <span className="breadth-down"><b className="num tabular-nums">{s.losers}</b>▼</span>
                </div>

                <div className={`sector-perf-pill num tabular-nums ${up ? 'bull' : 'bear'}`}>
                  {up ? '+' : ''}{s.v.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
