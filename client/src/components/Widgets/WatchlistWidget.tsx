import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { StockLogo } from '../common/StockLogo';
import { audioAlerts } from '../../utils/audioAlerts';
import { Star, ArrowRight, Eye } from 'lucide-react';

export function WatchlistWidget() {
  const { allStocks, priceFlash } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  const { setActiveTab, setChartSymbol } = useDashboard();
  const { isWatchlisted, watchlist, toggle: toggleWatchlist } = useWatchlist();
  
  const defaultSymbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'WIPRO'];
  const watch = allStocks.filter(s => watchlist.size > 0 ? watchlist.has(s.symbol) : defaultSymbols.includes(s.symbol)).slice(0, 5);

  return (
    <div className="bento-widget-shell">
      <div className="bento-widget-core">
        <div className="bento-card-header">
          <div className="bento-title-left">
            <div className="bento-icon-box">
              <Eye size={17} strokeWidth={1.5} className="text-amber-400" />
            </div>
            <div>
              <div className="bento-title-row">
                <span className="bento-card-title">Quick Watchlist</span>
                <span className="bento-pinned-badge num tabular-nums">{watch.length} PINNED</span>
              </div>
              <div className="bento-card-subtitle">One-click fast switching to interactive pro charting</div>
            </div>
          </div>

          <button
            type="button"
            className="bento-link-btn"
            onClick={() => {
              audioAlerts.playClickHaptic();
              setActiveTab('Watchlist');
            }}
          >
            <span>Manage</span>
            <ArrowRight size={13} strokeWidth={1.5} />
          </button>
        </div>

        <div className="bento-list-body">
          {watch.map((w) => {
            const up = w.changePercent >= 0;
            const flash = priceFlash.get(w.symbol);
            const starred = isWatchlisted(w.symbol);
            return (
              <div
                className="watch-row-item"
                key={w.symbol}
                onClick={() => {
                  audioAlerts.playClickHaptic();
                  setChartSymbol(w.symbol);
                  setActiveTab('Charts');
                }}
                title={`Open ${w.symbol} interactive chart`}
              >
                <button
                  type="button"
                  className="watch-star-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    audioAlerts.playClickHaptic();
                    toggleWatchlist(w.symbol);
                  }}
                  title={starred ? 'Remove from Watchlist' : 'Add to Watchlist'}
                >
                  <Star 
                    size={15} 
                    strokeWidth={1.5} 
                    className={starred ? 'text-amber-400 fill-amber-400' : 'text-slate-500 hover:text-slate-300'} 
                  />
                </button>

                <div className="mover-identity-group">
                  <StockLogo symbol={w.symbol} name={w.name} size={26} className="shrink-0" />
                  <div className="mover-names-wrap">
                    <span className="mover-sym-text">{w.symbol}</span>
                    <span className="mover-company-text">{w.name}</span>
                  </div>
                </div>

                <div className="mover-price-column">
                  <div className={`mover-price-val num tabular-nums ${flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}`}>
                    ₹{w.price.toFixed(2)}
                  </div>
                  <div className={`mover-pct-badge num tabular-nums ${up ? 'bull' : 'bear'}`}>
                    {up ? '+' : ''}{w.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
