import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { StockLogo } from '../common/StockLogo';

function formatVol(v: number) {
  if(v >= 1e7) return (v / 1e7).toFixed(1) + 'Cr';
  if(v >= 1e5) return (v / 1e5).toFixed(1) + 'L';
  if(v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
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
    <div className="card table-card">
      <div className="card-head">
        <span className="card-title">{watchlistOnly ? '⭐ My Watchlist' : 'Market Table'}</span>
        {!fullView && <a className="card-link" href="#" onClick={(e) => { e.preventDefault(); setActiveTab(watchlistOnly ? 'Watchlist' : 'Table'); }}>Open full table →</a>}
      </div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Symbol</th>
            <th>Company</th>
            <th className="num-col">Price (₹)</th>
            <th className="num-col">Change</th>
            <th className="num-col">Change %</th>
            <th className="num-col">Day High</th>
            <th className="num-col">Day Low</th>
            <th className="num-col">Volume</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const up = r.changePercent >= 0;
            const starred = isWatchlisted(r.symbol);
            return (
              <tr key={r.symbol}>
                <td style={{ width: 28, textAlign: 'center' }}>
                  <span
                    onClick={() => toggleWatchlist(r.symbol)}
                    style={{ cursor: 'pointer', color: starred ? '#f59e0b' : '#3a3f46', fontSize: 14 }}
                    title={starred ? 'Remove from Watchlist' : 'Add to Watchlist'}
                  >
                    {starred ? '★' : '☆'}
                  </span>
                </td>
                <td className="sym" style={{ cursor: 'pointer' }} onClick={() => { setChartSymbol(r.symbol); setActiveTab('Charts'); }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <StockLogo symbol={r.symbol} name={r.name} size={22} />
                    <span>{r.symbol}</span>
                  </div>
                </td>
                <td className="co">{r.name}</td>
                <td className="price num">{r.price.toFixed(2)}</td>
                <td className={"chg num " + (up ? 'up-txt' : 'down-txt')}>
                  {up ? '+' : ''}{r.change.toFixed(2)}
                </td>
                <td className="chgpct">
                  <span className={"chg-pill " + (up ? 'up' : 'down')}>
                    {up ? '+' : ''}{r.changePercent.toFixed(2)}%
                  </span>
                </td>
                <td className="dh num">{r.dayHigh.toFixed(2)}</td>
                <td className="dl num">{r.dayLow.toFixed(2)}</td>
                <td className="vol num">
                  {r.volumeSpike && <span title="Volume Spike!" style={{ color: '#a855f7', marginRight: 4, display: 'inline-block', verticalAlign: 'middle', fontSize: '12px' }}>⚡</span>}
                  {formatVol(r.volume)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
