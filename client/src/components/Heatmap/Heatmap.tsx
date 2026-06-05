import { useMemo, useState } from 'react';
import type { StockData } from '../../types';
import { formatPrice, formatVolume, formatPercent } from '../../utils/formatters';
import './Heatmap.css';

interface HeatmapProps {
  stocks: StockData[];
}

function getHeatColor(changePercent: number): string {
  if (changePercent <= -3) return '#dc2626';
  if (changePercent <= -1) {
    const t = (changePercent + 3) / 2; // 0 at -3, 1 at -1
    return lerpColor('#dc2626', '#ef4444', t);
  }
  if (changePercent < 0) {
    const t = (changePercent + 1) / 1; // 0 at -1, 1 at 0
    return lerpColor('#ef4444', '#2a2a2e', t);
  }
  if (changePercent === 0) return '#2a2a2e';
  if (changePercent <= 1) {
    const t = changePercent / 1; // 0 at 0, 1 at +1
    return lerpColor('#2a2a2e', '#10b981', t);
  }
  if (changePercent <= 3) {
    const t = (changePercent - 1) / 2; // 0 at +1, 1 at +3
    return lerpColor('#10b981', '#059669', t);
  }
  return '#059669';
}

function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);

  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

export function Heatmap({ stocks }: HeatmapProps) {
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, StockData[]>();
    stocks.forEach(s => {
      const sector = s.sector || 'Unknown';
      if (!map.has(sector)) map.set(sector, []);
      map.get(sector)!.push(s);
    });
    // Sort sectors by size
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [stocks]);

  let tileIndex = 0;

  return (
    <div className="heatmap-container">
      {grouped.map(([sector, sectorStocks]) => (
        <div key={sector} className="heatmap-sector">
          <div className="heatmap-sector-header">
            <span className="heatmap-sector-name">{sector}</span>
            <span className="heatmap-sector-count">{sectorStocks.length}</span>
          </div>
          <div className="heatmap-grid">
            {sectorStocks.map(stock => {
              const idx = tileIndex++;
              const bgColor = getHeatColor(stock.changePercent);
              const isHovered = hoveredSymbol === stock.symbol;

              return (
                <div
                  key={stock.symbol}
                  className={`heatmap-tile ${isHovered ? 'hovered' : ''}`}
                  style={{
                    backgroundColor: bgColor,
                    animationDelay: `${Math.min(idx * 20, 800)}ms`,
                  }}
                  onMouseEnter={() => setHoveredSymbol(stock.symbol)}
                  onMouseLeave={() => setHoveredSymbol(null)}
                >
                  <span className="heatmap-tile-symbol">
                    {stock.symbol}
                    {stock.volumeSpike && <span className="heatmap-spike-icon">⚡</span>}
                  </span>
                  <span className={`heatmap-tile-change ${stock.changePercent >= 0 ? '' : 'neg'}`}>
                    {formatPercent(stock.changePercent)}
                  </span>

                  {isHovered && (
                    <div className="heatmap-tooltip">
                      <div className="heatmap-tooltip-name">{stock.name}</div>
                      <div className="heatmap-tooltip-row">
                        <span>Price</span>
                        <span>{formatPrice(stock.price)}</span>
                      </div>
                      <div className="heatmap-tooltip-row">
                        <span>Change</span>
                        <span className={stock.change >= 0 ? 'positive' : 'negative'}>
                          {formatPercent(stock.changePercent)}
                        </span>
                      </div>
                      <div className="heatmap-tooltip-row">
                        <span>Volume</span>
                        <span>{formatVolume(stock.volume)}</span>
                      </div>
                      <div className="heatmap-tooltip-row">
                        <span>Sector</span>
                        <span>{stock.sector || 'Unknown'}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {stocks.length === 0 && (
        <div className="heatmap-empty">
          <div className="heatmap-empty-icon">🟩</div>
          <div>Waiting for stock data...</div>
        </div>
      )}
    </div>
  );
}
