import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { StockLogo } from '../common/StockLogo';
import { CometCard } from '../ui/comet-card';
import { audioAlerts } from '../../utils/audioAlerts';
import { CyberIcon } from '../common/CyberIcon';

export function WatchlistWidget() {
  const { allStocks, priceFlash } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  const { setActiveTab, setChartSymbol } = useDashboard();
  const { isWatchlisted, watchlist, toggle: toggleWatchlist } = useWatchlist();
  
  const defaultSymbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'WIPRO'];
  const watch = allStocks.filter(s => watchlist.size > 0 ? watchlist.has(s.symbol) : defaultSymbols.includes(s.symbol)).slice(0, 7);

  return (
    <CometCard>
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="card-head" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CyberIcon name="watchlist" size={18} />
            <span className="card-title" style={{ letterSpacing: '-0.01em' }}>Quick Watchlist</span>
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(245, 158, 11, 0.15)', color: 'var(--amber)' }}>
              {watch.length} PINNED
            </span>
          </div>
          <a 
            className="card-link" 
            href="#" 
            onClick={(e) => { 
              e.preventDefault(); 
              audioAlerts.playClickHaptic();
              setActiveTab('Watchlist'); 
            }}
          >
            Manage Watchlist →
          </a>
        </div>
        <div>
          {watch.map(w => {
            const up = w.changePercent >= 0;
            const flash = priceFlash.get(w.symbol);
            const starred = isWatchlisted(w.symbol);
            return (
              <div
                className="watch-row"
                key={w.symbol}
                onClick={() => {
                  audioAlerts.playClickHaptic();
                  setChartSymbol(w.symbol);
                  setActiveTab('Charts');
                }}
                style={{ cursor: 'pointer', padding: '10px 4px', borderRadius: 8, transition: 'background 0.15s ease' }}
                title={`Open ${w.symbol} interactive chart`}
              >
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    audioAlerts.playClickHaptic();
                    toggleWatchlist(w.symbol);
                  }}
                  style={{ cursor: 'pointer', color: starred ? '#f59e0b' : '#484f58', fontSize: 15, padding: '0 4px', userSelect: 'none' }}
                  title={starred ? 'Remove from Watchlist' : 'Add to Watchlist'}
                >
                  {starred ? '★' : '☆'}
                </span>
                <StockLogo symbol={w.symbol} name={w.name} size={24} style={{ marginRight: 6, flexShrink: 0 }} />
                <div className="mover-sym" style={{ fontWeight: 700 }}>{w.symbol}</div>
                <div className="mover-co">{w.name}</div>
                <div className={`mover-price num tabular-nums ${flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}`} style={{ fontWeight: 600 }}>
                  ₹{w.price.toFixed(2)}
                </div>
                <div className={"chg-pill tabular-nums " + (up ? 'up' : 'down')} style={{ fontWeight: 700 }}>
                  {up ? '+' : ''}{w.changePercent.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </CometCard>
  );
}
