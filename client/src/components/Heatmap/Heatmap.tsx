import { useMemo, useState } from 'react';
import type { StockData } from '../../types';
import { formatPrice, formatVolume, formatPercent } from '../../utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Zap } from 'lucide-react';
import './Heatmap.css';

interface HeatmapProps {
  stocks: StockData[];
}

function getHeatColor(changePercent: number): string {
  if (changePercent >= 2) return '#129352'; // Deep Green
  if (changePercent >= 1) return '#24b267'; // Green
  if (changePercent > 0) return '#60c58e';  // Light Green
  if (changePercent === 0) return '#9ea7ac'; // Neutral Gray
  if (changePercent > -1) return '#f57e84'; // Light Red
  if (changePercent > -2) return '#e43e49'; // Red
  return '#cc222e'; // Deep Red
}

export function Heatmap({ stocks }: HeatmapProps) {
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'NIFTY50' | 'NIFTY500' | 'ALL' | 'INDEX'>('ALL');

  // Filter and sort stocks globally by changePercent descending
  const sortedStocks = useMemo(() => {
    let filtered = stocks;
    if (viewMode !== 'ALL') {
      filtered = stocks.filter(s => s.indexName === viewMode);
    } else {
      filtered = stocks.filter(s => s.indexName !== 'INDEX');
    }
    return [...filtered].sort((a, b) => b.changePercent - a.changePercent);
  }, [stocks, viewMode]);

  return (
    <div className="heatmap-container">
      <div className="heatmap-controls">
        <div className="heatmap-tabs">
          <button className={`heatmap-tab ${viewMode === 'ALL' ? 'active' : ''}`} onClick={() => setViewMode('ALL')}>All Stocks</button>
          <button className={`heatmap-tab ${viewMode === 'NIFTY50' ? 'active' : ''}`} onClick={() => setViewMode('NIFTY50')}>Nifty 50</button>
          <button className={`heatmap-tab ${viewMode === 'NIFTY500' ? 'active' : ''}`} onClick={() => setViewMode('NIFTY500')}>Nifty 500</button>
          <button className={`heatmap-tab ${viewMode === 'INDEX' ? 'active' : ''}`} onClick={() => setViewMode('INDEX')}>Indices</button>
        </div>
      </div>

      <div className="heatmap-grid">
        {sortedStocks.map((stock, idx) => {
          const bgColor = getHeatColor(stock.changePercent);
          const isHovered = hoveredSymbol === stock.symbol;

          return (
            <motion.div
              key={stock.symbol}
              className={`heatmap-tile ${isHovered ? 'hovered' : ''}`}
              style={{
                backgroundColor: bgColor,
                animationDelay: `${Math.min(idx * 10, 600)}ms`,
              }}
              whileHover={{ scale: 1.05, zIndex: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              onMouseEnter={() => setHoveredSymbol(stock.symbol)}
              onMouseLeave={() => setHoveredSymbol(null)}
            >
              <div className="heatmap-tile-top">
                <span className="heatmap-tile-symbol">
                  {stock.symbol}
                  {stock.volumeSpike && <Zap size={10} className="heatmap-spike-icon" />}
                </span>
              </div>
              
              <div className="heatmap-tile-bottom">
                <span className="heatmap-tile-price">
                  {formatPrice(stock.price).replace('â‚¹', '')}
                </span>
                <span className="heatmap-tile-change">
                  {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                </span>
              </div>

              <AnimatePresence>
                {isHovered && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="heatmap-tooltip"
                  >
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
                    {stock.indexName !== 'INDEX' && (
                      <div className="heatmap-tooltip-row">
                        <span>Volume</span>
                        <span>{formatVolume(stock.volume)}</span>
                      </div>
                    )}
                    {stock.indexName !== 'INDEX' && (
                      <div className="heatmap-tooltip-row">
                        <span>Sector</span>
                        <span>{stock.sector || 'Unknown'}</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
      
      {sortedStocks.length === 0 && (
        <div className="heatmap-empty">
          <div className="heatmap-empty-icon"><LayoutGrid size={32} /></div>
          <div>Waiting for {viewMode} data...</div>
        </div>
      )}
    </div>
  );
}
