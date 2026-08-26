import React, { useState } from 'react';
import { useStocks } from '../../hooks/useStocks';

export function TopMoversWidget() {
  const [tab, setTab] = useState<'gainers'|'losers'>('gainers');
  const { allStocks, priceFlash } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');

  const sorted = [...allStocks].sort((a, b) => tab === 'gainers' ? b.changePercent - a.changePercent : a.changePercent - b.changePercent);
  const top5 = sorted.slice(0, 5);

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Top Movers</span>
        <div className="tabs">
          <div className={"tab" + (tab === 'gainers' ? ' active' : '')} onClick={() => setTab('gainers')}>Gainers</div>
          <div className={"tab" + (tab === 'losers' ? ' active' : '')} onClick={() => setTab('losers')}>Losers</div>
        </div>
      </div>
      <div>
        {top5.map(g => {
          const flash = priceFlash.get(g.symbol);
          return (
          <div className="mover-row" key={g.symbol}>
            <div className="mover-sym">{g.symbol}</div>
            <div className="mover-co">{g.name}</div>
            <svg className="spark" viewBox="0 0 52 22">
              {tab === 'gainers' ? (
                <polyline points="0,16 8,14 16,17 24,10 32,12 40,5 52,2" fill="none" stroke="#34d399" strokeWidth="1.6"/>
              ) : (
                <polyline points="0,6 8,8 16,5 24,12 32,10 40,17 52,20" fill="none" stroke="#f87171" strokeWidth="1.6"/>
              )}
            </svg>
            <div className={`mover-price num ${flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}`}>
              {g.price.toFixed(2)}
            </div>
            <div className={"chg-pill " + (g.change >= 0 ? 'up' : 'down')}>
              {g.changePercent > 0 ? '+' : ''}{g.changePercent.toFixed(2)}%
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}
