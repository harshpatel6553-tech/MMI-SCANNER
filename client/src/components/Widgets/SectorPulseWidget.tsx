import React, { useState } from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';
import { CometCard } from '../ui/comet-card';

export function SectorPulseWidget() {
  const [tab, setTab] = useState<'top'|'bottom'>('top');
  const { sectorData } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  const { setActiveTab } = useDashboard();

  const sortedSectors = Array.from(sectorData.entries()).map(([n, d]) => ({
    n,
    v: d.avgChange
  })).sort((a, b) => tab === 'top' ? b.v - a.v : a.v - b.v);
  
  const displaySectors = sortedSectors.slice(0, 5);

  return (
    <CometCard>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="card-head">
          <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
            <span className="card-title">Sector Pulse</span>
            <div className="tabs">
              <div className={"tab" + (tab === 'top' ? ' active' : '')} onClick={() => setTab('top')}>Top 5</div>
              <div className={"tab" + (tab === 'bottom' ? ' active' : '')} onClick={() => setTab('bottom')}>Bottom 5</div>
            </div>
          </div>
          <a className="card-link" href="#" onClick={(e) => { e.preventDefault(); setActiveTab('Sectors'); }}>Sectors →</a>
        </div>
        <div style={{ flex: 1 }}>
          {displaySectors.map(s => {
            const up = s.v >= 0;
            return (
              <div className="mover-row" key={s.n}>
                <div className="mover-sym" style={{width: 'auto', flex: 1}}>{s.n}</div>
                <div className={"chg-pill " + (up ? 'up' : 'down')}>
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
