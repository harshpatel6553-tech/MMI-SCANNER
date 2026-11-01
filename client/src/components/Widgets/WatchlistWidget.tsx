import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { StockLogo } from '../common/StockLogo';
import { audioAlerts } from '../../utils/audioAlerts';
import { Star, ArrowRight, Eye } from 'lucide-react';
import { LivePrice } from '../common/LivePrice';
import { PriceChange } from '../common/PriceChange';
import { motion } from 'framer-motion';

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {watch.map((w, idx) => {
              const starred = isWatchlisted(w.symbol);
              return (
                <motion.div
                  className="watch-row-item"
                  key={w.symbol}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.25 }}
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
                      <span className="mover-sym-text font-mono">{w.symbol}</span>
                      <span className="mover-company-text">{w.name}</span>
                    </div>
                  </div>

                  <div className="mover-price-column font-mono tabular-nums">
                    <div className="mover-price-val font-mono">
                      <LivePrice price={w.price} decimals={2} />
                    </div>
                    <PriceChange change={w.change} changePercent={w.changePercent} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
