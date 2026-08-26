import React from 'react';
import { useStocks } from '../../hooks/useStocks';

export function StatsWidget() {
  const { stats } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  
  const gainerPct = stats.total > 0 ? ((stats.gainers / stats.total) * 100).toFixed(1) : 0;
  const loserPct = stats.total > 0 ? ((stats.losers / stats.total) * 100).toFixed(1) : 0;
  const unchPct = stats.total > 0 ? ((stats.unchanged / stats.total) * 100).toFixed(1) : 0;

  return (
    <div className="stats-row">
      <div className="card stat-card">
        <div className="stat-label">Total tracked</div>
        <div className="stat-value num">{stats.total}</div>
        <div className="stat-delta">Nifty 500 + Nifty 50</div>
      </div>
      <div className="card stat-card">
        <div className="stat-label">Gainers</div>
        <div className="stat-value num up">{stats.gainers}</div>
        <div className="stat-delta">{gainerPct}% of universe</div>
      </div>
      <div className="card stat-card">
        <div className="stat-label">Losers</div>
        <div className="stat-value num down">{stats.losers}</div>
        <div className="stat-delta">{loserPct}% of universe</div>
      </div>
      <div className="card stat-card">
        <div className="stat-label">Unchanged</div>
        <div className="stat-value num">{stats.unchanged}</div>
        <div className="stat-delta">{unchPct}% of universe</div>
      </div>
    </div>
  );
}
