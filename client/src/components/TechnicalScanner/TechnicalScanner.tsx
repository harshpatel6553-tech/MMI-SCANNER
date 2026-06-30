import { useState, useMemo } from 'react';
import { StockData } from '../../types';
import { StockTable } from '../StockTable/StockTable';
import './TechnicalScanner.css';

interface TechnicalScannerProps {
  stocks: StockData[];
  priceFlash: Map<string, 'up' | 'down'>;
  onRowClick: (stock: StockData) => void;
}

export function TechnicalScanner({ stocks, priceFlash, onRowClick }: TechnicalScannerProps) {
  const [activeSignal, setActiveSignal] = useState<'MACD_WEEKLY'>('MACD_WEEKLY');

  // Filter stocks that have the MACD Weekly Buy signal
  const macdStocks = useMemo(() => {
    return stocks.filter(stock => stock.macdWeeklyBuy);
  }, [stocks]);

  return (
    <div className="technical-scanner">
      <div className="technical-header glass-panel">
        <div className="signal-selector">
          <button 
            className={`signal-btn ${activeSignal === 'MACD_WEEKLY' ? 'active' : ''}`}
            onClick={() => setActiveSignal('MACD_WEEKLY')}
          >
            <span className="signal-dot"></span>
            MACD Weekly Buy
            <span className="signal-count">{macdStocks.length}</span>
          </button>
          {/* Future signals can go here (e.g. RSI Oversold, Golden Cross) */}
        </div>
        
        <div className="technical-info">
          <p className="info-text">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            Live MACD (12, 26, 9) crossover signals based on current daily price action applied to the weekly trend.
          </p>
        </div>
      </div>

      <div className="technical-content">
        {macdStocks.length > 0 ? (
          <StockTable 
            stocks={macdStocks}
            priceFlash={priceFlash}
            sortField="changePercent"
            sortOrder="desc"
            onSort={() => {}}
            isLoading={false}
            watchlist={new Set()}
            onToggleWatchlist={() => {}}
            onRowClick={onRowClick}
          />
        ) : (
          <div className="empty-state glass-panel">
            <div className="radar-animation">
              <div className="radar-ping"></div>
            </div>
            <h3>Scanning the market...</h3>
            <p>No stocks currently match the MACD Weekly Buy criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
