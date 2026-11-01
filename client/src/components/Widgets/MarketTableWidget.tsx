import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { StockLogo } from '../common/StockLogo';
import { audioAlerts } from '../../utils/audioAlerts';
import { Table as TableIcon, Star, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';

function formatVol(v: number) {
  if (v >= 1e7) return (v / 1e7).toFixed(2) + ' Cr';
  if (v >= 1e5) return (v / 1e5).toFixed(2) + ' L';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + ' K';
  return v.toString();
}

interface MarketTableWidgetProps {
  fullView?: boolean;
  watchlistOnly?: boolean;
}

export function MarketTableWidget({ fullView = false, watchlistOnly = false }: MarketTableWidgetProps) {
  const { searchQuery, setChartSymbol, setActiveTab } = useDashboard();
  const { isWatchlisted, toggle: toggleWatchlist } = useWatchlist();
  const { stocks, priceFlash } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: searchQuery }, 'volume', 'desc');

  const dataset = watchlistOnly ? stocks.filter(s => isWatchlisted(s.symbol)) : stocks;
  const rows = fullView ? dataset : dataset.slice(0, 10);

  return (
    <div className="bento-widget-shell">
      <div className="bento-widget-core p-0 overflow-hidden">
        <div className="table-header-strip">
          <div className="table-title-group">
            <div className="bento-icon-box">
              <TableIcon size={17} strokeWidth={1.5} className="text-cyan-400" />
            </div>
            <div>
              <div className="table-title-main">
                {watchlistOnly ? 'PORTFOLIO WATCHLIST RADAR' : 'LIVE CASH MARKET SCANNER'}
              </div>
              <div className="table-subtitle-main">
                Showing {rows.length} securities ordered by liquidity & volume flow
              </div>
            </div>
          </div>

          {!fullView && (
            <button 
              type="button"
              className="bento-link-btn"
              onClick={() => { 
                audioAlerts.playClickHaptic();
                setActiveTab(watchlistOnly ? 'Watchlist' : 'Table'); 
              }}
            >
              <span>Open full market tape</span>
              <ArrowRight size={13} strokeWidth={1.5} />
            </button>
          )}
        </div>

        <div className="table-scroll-container">
          <table className="vanguard-data-table">
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'center' }}></th>
                <th>Symbol</th>
                <th>Security Name</th>
                <th className="num-col">LTP (₹)</th>
                <th className="num-col">Net Chg</th>
                <th className="num-col">Chg %</th>
                <th className="num-col">Day High</th>
                <th className="num-col">Day Low</th>
                <th className="num-col">Volume Flow</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const up = r.changePercent >= 0;
                const starred = isWatchlisted(r.symbol);
                const flash = priceFlash.get(r.symbol);
                return (
                  <tr 
                    key={r.symbol}
                    className="vanguard-table-row"
                  >
                    <td style={{ width: 44, textAlign: 'center' }}>
                      <button
                        type="button"
                        className="table-star-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          audioAlerts.playClickHaptic();
                          toggleWatchlist(r.symbol);
                        }}
                        title={starred ? 'Remove from Watchlist' : 'Add to Watchlist'}
                      >
                        <Star 
                          size={14} 
                          strokeWidth={1.5} 
                          className={starred ? 'text-amber-400 fill-amber-400' : 'text-slate-600 hover:text-slate-300'} 
                        />
                      </button>
                    </td>
                    <td 
                      className="sym-cell" 
                      onClick={() => { 
                        audioAlerts.playClickHaptic();
                        setChartSymbol(r.symbol); 
                        setActiveTab('Charts'); 
                      }}
                    >
                      <div className="sym-flex-wrap">
                        <StockLogo symbol={r.symbol} name={r.name} size={22} className="shrink-0" />
                        <span className="sym-ticker-text">{r.symbol}</span>
                      </div>
                    </td>
                    <td className="company-cell">{r.name}</td>
                    <td className={`num-col num price-cell ${flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}`}>
                      ₹{r.price.toFixed(2)}
                    </td>
                    <td className={`num-col num ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {up ? '+' : ''}{r.change.toFixed(2)}
                    </td>
                    <td className="num-col">
                      <span className={`table-pct-pill num tabular-nums ${up ? 'bull' : 'bear'}`}>
                        {up ? '+' : ''}{r.changePercent.toFixed(2)}%
                      </span>
                    </td>
                    <td className="num-col num text-slate-300">₹{r.dayHigh.toFixed(2)}</td>
                    <td className="num-col num text-slate-300">₹{r.dayLow.toFixed(2)}</td>
                    <td className="num-col num text-cyan-300 font-semibold">{formatVol(r.volume)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
