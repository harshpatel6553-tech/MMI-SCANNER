import React from 'react';
import { useStocks } from '../../hooks/useStocks';

export function AdvanceDeclineWidget() {
  const { stats } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');

  const gainerPct = stats.total > 0 ? ((stats.gainers / stats.total) * 100) : 50;
  const loserPct = stats.total > 0 ? ((stats.losers / stats.total) * 100) : 50;
  const adRatio = stats.advanceDeclineRatio === Infinity ? '∞' : stats.advanceDeclineRatio.toFixed(2);

  return (
    <div className="card ad-card">
      <div className="ad-head">
        <span className="t">Advance / Decline</span>
        <span className="r">A/D {adRatio}</span>
      </div>
      <div className="ad-bar">
        <div className="g" style={{width: gainerPct+"%"}}></div>
        <div className="r" style={{width: loserPct+"%"}}></div>
      </div>
      <div className="ad-labels">
        <span><b className="num">{stats.gainers}</b> advancing</span>
        <span><b className="num">{stats.losers}</b> declining</span>
      </div>
    </div>
  );
}
