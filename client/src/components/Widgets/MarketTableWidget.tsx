import React from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';

function formatVol(v: number) {
  if(v >= 1e7) return (v / 1e7).toFixed(1) + 'Cr';
  if(v >= 1e5) return (v / 1e5).toFixed(1) + 'L';
  if(v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toString();
}

interface MarketTableWidgetProps {
  fullView?: boolean;
}

export function MarketTableWidget({ fullView = false }: MarketTableWidgetProps) {
  const { searchQuery } = useDashboard();
  const { stocks } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: searchQuery }, 'volume', 'desc');

  const rows = fullView ? stocks : stocks.slice(0, 10);

  return (
    <div className="card table-card">
      <div className="card-head">
        <span className="card-title">Market Table</span>
        {!fullView && <a className="card-link" href="#">Open full table →</a>}
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
            return (
              <tr key={r.symbol}>
                <td><svg className="star" style={{width: 13, height: 13, color: '#3a3f46'}} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7L12 17.3 5.7 20.9l1.7-7L2 9.2l7.1-.6z"/></svg></td>
                <td className="sym">{r.symbol}</td>
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
