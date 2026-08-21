import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';

export function SectorPulseWidget() {
  const { sectorData } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  const { setActiveTab } = useDashboard();

  const sectors = Array.from(sectorData.entries()).map(([n, d]) => ({
    n,
    v: d.avgChange
  })).sort((a, b) => b.v - a.v).slice(0, 6);

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Sector Pulse</span>
        <a className="card-link" href="#" onClick={(e) => { e.preventDefault(); setActiveTab('Sectors'); }}>Sectors →</a>
      </div>
      <div className="sector-grid">
        {sectors.map(s => {
          const up = s.v >= 0;
          return (
            <div key={s.n} className="sector-tile" style={{background: up ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)', borderColor: up ? 'rgba(52,211,153,0.22)' : 'rgba(248,113,113,0.22)'}}>
              <div className="name">{s.n}</div>
              <div className={"val num " + (up ? 'up-txt' : 'down-txt')}>
                {up ? '+' : ''}{s.v.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
