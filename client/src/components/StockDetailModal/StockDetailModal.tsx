import { useEffect, useCallback, useState, useRef } from 'react';
import type { StockData } from '../../types';
import { formatPrice, formatVolume, formatMarketCap, formatPercent, getChangeClass } from '../../utils/formatters';
import './StockDetailModal.css';

interface StockDetailModalProps {
  stock: StockData | null;
  onClose: () => void;
}

interface Fundamentals {
  marketCap: string;
  currentPrice: string;
  highLow: string;
  peRatio: string;
  roce: string;
  roe: string;
  bookValue: string;
  dividendYield: string;
  faceValue: string;
}

export function StockDetailModal({ stock, onClose }: StockDetailModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [fundamentals, setFundamentals] = useState<Fundamentals | null>(null);
  const [loadingFunds, setLoadingFunds] = useState(false);
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
      
      // Fetch Fundamentals
      setLoadingFunds(true);
      setFundamentals(null);
      const apiUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
      fetch(`${apiUrl}/api/stocks/${stock.symbol}/fundamentals`)
        .then(res => res.ok ? res.json() : null)
        .then(data => setFundamentals(data))
        .catch(err => console.error("Failed to fetch fundamentals", err))
        .finally(() => setLoadingFunds(false));

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
            <span className="stat-card-value">
              {fundamentals && fundamentals.marketCap !== 'N/A' 
                ? fundamentals.marketCap 
                : (displayStock.marketCap > 0 ? formatMarketCap(displayStock.marketCap) : 'N/A')}
            </span>
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

        {/* Fundamental Scorecard */}
        <div className="modal-section">
          <h3 className="modal-section-title">Fundamental Scorecard</h3>
          <div className="modal-fundamentals-wrapper">
            {loadingFunds ? (
              <div className="fundamentals-loading">
                <div className="spinner"></div>
                <span>Fetching live fundamentals from Screener...</span>
              </div>
            ) : fundamentals ? (
              <div className="fundamentals-grid">
                <div className="fund-item">
                  <span className="fund-label">P/E Ratio</span>
                  <span className="fund-value">{fundamentals.peRatio}</span>
                </div>
                <div className="fund-item">
                  <span className="fund-label">ROCE</span>
                  <span className="fund-value">{fundamentals.roce}</span>
                </div>
                <div className="fund-item">
                  <span className="fund-label">ROE</span>
                  <span className="fund-value">{fundamentals.roe}</span>
                </div>
                <div className="fund-item">
                  <span className="fund-label">Book Value</span>
                  <span className="fund-value">{fundamentals.bookValue}</span>
                </div>
                <div className="fund-item">
                  <span className="fund-label">Div. Yield</span>
                  <span className="fund-value">{fundamentals.dividendYield}</span>
                </div>
                <div className="fund-item">
                  <span className="fund-label">Face Value</span>
                  <span className="fund-value">{fundamentals.faceValue}</span>
                </div>
              </div>
            ) : (
              <div className="fundamentals-error">
                Failed to load fundamentals for this stock.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
