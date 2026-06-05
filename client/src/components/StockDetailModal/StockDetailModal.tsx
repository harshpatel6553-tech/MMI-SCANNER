import { useEffect, useCallback, useState, useRef } from 'react';
import type { StockData } from '../../types';
import { formatPrice, formatVolume, formatMarketCap, formatPercent, getChangeClass } from '../../utils/formatters';
import './StockDetailModal.css';

interface StockDetailModalProps {
  stock: StockData | null;
  onClose: () => void;
}

export function StockDetailModal({ stock, onClose }: StockDetailModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const prevStock = useRef<StockData | null>(null);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsVisible(false);
      onClose();
    }, 250);
  }, [onClose]);

  useEffect(() => {
    if (stock) {
      prevStock.current = stock;
      setIsVisible(true);
      setIsClosing(false);
      document.body.style.overflow = 'hidden';
    } else if (!stock && isVisible && !isClosing) {
      // Reset if externally closed
      setIsVisible(false);
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [stock, isVisible, isClosing]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isVisible, handleClose]);

  if (!isVisible) return null;

  const displayStock = stock || prevStock.current;
  if (!displayStock) return null;

  const changeClass = getChangeClass(displayStock.change);
  const fiftyTwoRange = displayStock.fiftyTwoWeekHigh - displayStock.fiftyTwoWeekLow;
  const fiftyTwoPosition = fiftyTwoRange > 0
    ? ((displayStock.price - displayStock.fiftyTwoWeekLow) / fiftyTwoRange) * 100
    : 50;

  return (
    <div
      className={`modal-overlay ${isClosing ? 'closing' : ''}`}
      onClick={handleClose}
    >
      <div
        className={`modal-container ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button className="modal-close" onClick={handleClose} aria-label="Close">
          ✕
        </button>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <h2 className="modal-symbol">{displayStock.symbol}</h2>
            <p className="modal-company-name">{displayStock.name}</p>
            <div className="modal-meta">
              {displayStock.sector && (
                <span className="modal-sector-badge">{displayStock.sector}</span>
              )}
              <span className="modal-index-badge">{displayStock.indexName}</span>
            </div>
          </div>
          <div className="modal-header-right">
            <div className={`modal-price ${changeClass}`}>
              {formatPrice(displayStock.price)}
            </div>
            <div className={`modal-change ${changeClass}`}>
              <span className="modal-change-arrow">
                {displayStock.change > 0 ? '▲' : displayStock.change < 0 ? '▼' : '—'}
              </span>
              {formatPrice(Math.abs(displayStock.change))}
              {' '}
              ({formatPercent(displayStock.changePercent)})
            </div>
          </div>
        </div>

        {/* OHLC Section */}
        <div className="modal-section">
          <h3 className="modal-section-title">OHLC Data</h3>
          <div className="modal-ohlc-grid">
            <div className="ohlc-item">
              <span className="ohlc-label">Open</span>
              <span className="ohlc-value">{displayStock.open > 0 ? formatPrice(displayStock.open) : 'N/A'}</span>
            </div>
            <div className="ohlc-item">
              <span className="ohlc-label">High</span>
              <span className="ohlc-value">
                {formatPrice(displayStock.dayHigh)}
                {displayStock.atDayHigh && <span className="at-indicator at-high-dot" title="At Day High" />}
              </span>
            </div>
            <div className="ohlc-item">
              <span className="ohlc-label">Low</span>
              <span className="ohlc-value">
                {formatPrice(displayStock.dayLow)}
                {displayStock.atDayLow && <span className="at-indicator at-low-dot" title="At Day Low" />}
              </span>
            </div>
            <div className="ohlc-item">
              <span className="ohlc-label">Prev Close</span>
              <span className="ohlc-value">{formatPrice(displayStock.previousClose)}</span>
            </div>
          </div>
        </div>

        {/* 52 Week Range */}
        <div className="modal-section">
          <h3 className="modal-section-title">52-Week Range</h3>
          <div className="range-bar-container">
            <div className="range-bar-track">
              <div
                className="range-bar-fill"
                style={{ width: `${Math.min(100, Math.max(0, fiftyTwoPosition))}%` }}
              />
              <div
                className="range-bar-thumb"
                style={{ left: `${Math.min(100, Math.max(0, fiftyTwoPosition))}%` }}
              />
            </div>
            <div className="range-bar-labels">
              <span className="range-label-low">{formatPrice(displayStock.fiftyTwoWeekLow)}</span>
              <span className="range-label-high">{formatPrice(displayStock.fiftyTwoWeekHigh)}</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="modal-stats-grid">
          <div className="modal-stat-card">
            <span className="stat-card-label">Volume</span>
            <span className="stat-card-value">{formatVolume(displayStock.volume)}</span>
          </div>
          <div className="modal-stat-card">
            <span className="stat-card-label">Market Cap</span>
            <span className="stat-card-value">{displayStock.marketCap > 0 ? formatMarketCap(displayStock.marketCap) : 'N/A'}</span>
          </div>
          <div className="modal-stat-card">
            <span className="stat-card-label">Rel. Volume</span>
            <span className="stat-card-value">
              {displayStock.averageVolume > 0 ? (
                <>
                  {displayStock.relativeVolume.toFixed(1)}x
                  {displayStock.volumeSpike && (
                    <span className="stat-spike-badge" title="Volume Spike">⚡</span>
                  )}
                </>
              ) : 'N/A'}
            </span>
          </div>
        </div>

        <div className="modal-section modal-chart-section">
          <h3 className="modal-section-title">Chart</h3>
          <div className="modal-chart-wrapper">
            <iframe
              key={displayStock.symbol}
              src={`https://s.tradingview.com/embed-widget/advanced-chart/?symbol=NSE%3A${encodeURIComponent(displayStock.symbol)}&interval=D&theme=dark&style=1&locale=en&timezone=Asia%2FKolkata&hide_side_toolbar=1&allow_symbol_change=0&calendar=false&hide_volume=false&support_host=https%3A%2F%2Fwww.tradingview.com`}
              style={{ width: '100%', height: '350px', border: 'none', borderRadius: '8px' }}
              title={`${displayStock.symbol} Chart`}
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
