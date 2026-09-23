import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { StockLogo } from '../common/StockLogo';
import { audioAlerts } from '../../utils/audioAlerts';
import { AnimatedEmoji } from '../common/AnimatedEmoji';

function formatVol(v: number) {
  if(v >= 1e7) return (v / 1e7).toFixed(2) + ' Cr';
  if(v >= 1e5) return (v / 1e5).toFixed(2) + ' L';
  if(v >= 1e3) return (v / 1e3).toFixed(2) + ' K';
  return v.toString();
}

interface MarketTableWidgetProps {
  fullView?: boolean;
  watchlistOnly?: boolean;
}

export function MarketTableWidget({ fullView = false, watchlistOnly = false }: MarketTableWidgetProps) {
  const { searchQuery, setChartSymbol, setActiveTab } = useDashboard();
  const { isWatchlisted, toggle: toggleWatchlist } = useWatchlist();
  const { stocks } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: searchQuery }, 'volume', 'desc');

  const dataset = watchlistOnly ? stocks.filter(s => isWatchlisted(s.symbol)) : stocks;
  const rows = fullView ? dataset : dataset.slice(0, 10);

  return (
    <div className="card table-card beast-card" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AnimatedEmoji name={watchlistOnly ? 'watchlist' : 'table'} size={24} />
          <div>
            <span className="card-title" style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em' }}>
              {watchlistOnly ? 'MY PORTFOLIO WATCHLIST' : 'LIVE CASH MARKET SCANNER'}
            </span>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 2 }}>
              Showing {rows.length} securities ordered by liquidity & volume flow
            </div>
          </div>
        </div>
        {!fullView && (
          <a 
            className="card-link" 
            href="#" 
            onClick={(e) => { 
              e.preventDefault(); 
              audioAlerts.playClickHaptic();
              setActiveTab(watchlistOnly ? 'Watchlist' : 'Table'); 
            }}
            style={{ fontWeight: 700 }}
          >
            Open full market tape →
          </a>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
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
            {rows.map(r => {
              const up = r.changePercent >= 0;
              const starred = isWatchlisted(r.symbol);
              return (
                <tr 
                  key={r.symbol}
                  style={{ transition: 'background 0.12s ease' }}
                >
                  <td style={{ width: 36, textAlign: 'center' }}>
                    <span
                      onClick={() => {
                        audioAlerts.playClickHaptic();
                        toggleWatchlist(r.symbol);
                      }}
                      style={{ cursor: 'pointer', color: starred ? '#f59e0b' : '#3a3f46', fontSize: 16, userSelect: 'none' }}
                      title={starred ? 'Remove from Watchlist' : 'Add to Watchlist'}
                    >
                      {starred ? '★' : '☆'}
                    </span>
                  </td>
                  <td 
                    className="sym" 
                    style={{ cursor: 'pointer' }} 
                    onClick={() => { 
                      audioAlerts.playClickHaptic();
                      setChartSymbol(r.symbol); 
                      setActiveTab('Charts'); 
                    }}
                    title={`Open interactive chart for ${r.symbol}`}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <StockLogo symbol={r.symbol} name={r.name} size={24} />
                      <span style={{ fontWeight: 800, letterSpacing: '-0.01em', color: '#fff' }}>{r.symbol}</span>
                    </div>
                  </td>
                  <td className="co" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name}
                  </td>
                  <td className="price num tabular-nums" style={{ fontWeight: 700, fontSize: '13px' }}>
                    ₹{r.price.toFixed(2)}
                  </td>
                  <td className={"chg num tabular-nums " + (up ? 'up-txt' : 'down-txt')} style={{ fontWeight: 600 }}>
                    {up ? '+' : ''}{r.change.toFixed(2)}
                  </td>
                  <td className="chgpct">
                    <span className={"chg-pill tabular-nums " + (up ? 'up' : 'down')} style={{ fontWeight: 800, padding: '3px 8px' }}>
                      {up ? '+' : ''}{r.changePercent.toFixed(2)}%
                    </span>
                  </td>
                  <td className="dh num tabular-nums" style={{ color: 'var(--text-2)' }}>{r.dayHigh.toFixed(2)}</td>
                  <td className="dl num tabular-nums" style={{ color: 'var(--text-2)' }}>{r.dayLow.toFixed(2)}</td>
                  <td className="vol num tabular-nums" style={{ fontWeight: 600 }}>
                    {r.volumeSpike && (
                      <span 
                        title="Extreme Volume Spike (>2x Avg Volume)" 
                        style={{ 
                          color: '#c084fc', 
                          background: 'rgba(168, 85, 247, 0.18)', 
                          padding: '2px 7px', 
                          borderRadius: 4, 
                          marginRight: 6, 
                          fontSize: '11px', 
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <AnimatedEmoji name="technical" size={14} /> 2x SPIKE
                      </span>
                    )}
                    {formatVol(r.volume)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
