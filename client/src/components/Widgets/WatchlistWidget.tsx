import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';

export function WatchlistWidget() {
  const { allStocks, priceFlash } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  const { setActiveTab } = useDashboard();
  
  const symbols = ['TCS', 'ASTRAL', 'IFCI'];
  const watch = allStocks.filter(s => symbols.includes(s.symbol));

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Watchlist</span>
        <a className="card-link" href="#" onClick={(e) => { e.preventDefault(); setActiveTab('Watchlist'); }}>Manage â†’</a>
      </div>
      <div>
        {watch.map(w => {
          const up = w.changePercent >= 0;
          const flash = priceFlash.get(w.symbol);
          return (
            <div className="watch-row" key={w.symbol}>
              <svg className="star" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7L12 17.3 5.7 20.9l1.7-7L2 9.2l7.1-.6z"/></svg>
              <div className="mover-sym">{w.symbol}</div>
              <div className="mover-co">{w.name}</div>
              <div className={`mover-price num ${flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}`}>
                {w.price.toFixed(2)}
              </div>
              <div className={"chg-pill " + (up ? 'up' : 'down')}>
                {up ? '+' : ''}{w.changePercent.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
