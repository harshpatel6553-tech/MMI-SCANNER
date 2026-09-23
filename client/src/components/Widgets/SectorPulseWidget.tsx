import React, { useState } from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';
import { CometCard } from '../ui/comet-card';
import { audioAlerts } from '../../utils/audioAlerts';
import { CyberIcon } from '../common/CyberIcon';

export function SectorPulseWidget() {
  const [tab, setTab] = useState<'top'|'bottom'>('top');
  const { sectorData } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  const { setActiveTab } = useDashboard();

  const sortedSectors = Array.from(sectorData.entries()).map(([n, d]) => ({
    n,
    v: d.avgChange,
    gainers: d.gainers,
    losers: d.losers,
    total: d.totalStocks
  })).sort((a, b) => tab === 'top' ? b.v - a.v : a.v - b.v);
  
  const displaySectors = sortedSectors.slice(0, 5);

  return (
    <CometCard>
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="card-head" style={{ marginBottom: 12 }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <CyberIcon name="sectors" size={20} />
            <span className="card-title" style={{ letterSpacing: '-0.01em' }}>Sector Pulse Radar</span>
            <div className="tabs">
              <div 
                className={"tab" + (tab === 'top' ? ' active' : '')} 
                onClick={() => {
                  audioAlerts.playClickHaptic();
                  setTab('top');
                }}
                style={{ cursor: 'pointer' }}
              >
                Top 5
              </div>
              <div 
                className={"tab" + (tab === 'bottom' ? ' active' : '')} 
                onClick={() => {
                  audioAlerts.playClickHaptic();
                  setTab('bottom');
                }}
                style={{ cursor: 'pointer' }}
              >
                Lagging
              </div>
            </div>
          </div>
          <a 
            className="card-link" 
            href="#" 
            onClick={(e) => { 
              e.preventDefault(); 
              audioAlerts.playClickHaptic();
              setActiveTab('Sectors'); 
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <span>All Sectors</span> →
          </a>
        </div>
        <div style={{ flex: 1 }}>
          {displaySectors.map(s => {
            const up = s.v >= 0;
            return (
              <div 
                className="mover-row" 
                key={s.n} 
                onClick={() => {
                  audioAlerts.playClickHaptic();
                  setActiveTab('Sectors');
                }}
                style={{ cursor: 'pointer', padding: '10px 4px', borderRadius: 8, transition: 'background 0.15s ease' }}
              >
                <div className="mover-sym" style={{ width: 'auto', flex: 1, fontWeight: 600 }}>{s.n}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginRight: 10 }}>
                  <span style={{ color: 'var(--up)' }}>{s.gainers}▲</span> / <span style={{ color: 'var(--down)' }}>{s.losers}▼</span>
                </div>
                <div className={"chg-pill tabular-nums " + (up ? 'up' : 'down')} style={{ fontWeight: 700 }}>
                  {up ? '+' : ''}{s.v.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </CometCard>
  );
}
