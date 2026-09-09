import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { CometCard } from '../ui/comet-card';

export function AdvanceDeclineWidget() {
  const { stats } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');

  const gainerPct = stats.total > 0 ? ((stats.gainers / stats.total) * 100) : 50;
  const loserPct = stats.total > 0 ? ((stats.losers / stats.total) * 100) : 50;
  const adRatio = stats.advanceDeclineRatio === Infinity ? '∞' : stats.advanceDeclineRatio.toFixed(2);

  return (
    <CometCard>
      <div className="ad-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
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
    </CometCard>
  );
}
