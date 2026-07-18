import { useState, useMemo } from 'react';
import type { StockData } from '../../types';
import { formatPrice, formatPercent } from '../../utils/formatters';
import { StaggerList } from '../Motion/StaggerList';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, PieChart } from 'lucide-react';
import './SectorBreakdown.css';

interface SectorEntry {
  stocks: StockData[];
  totalStocks: number;
  avgChange: number;
  gainers: number;
  losers: number;
}

interface SectorBreakdownProps {
  sectorData: Map<string, SectorEntry>;
}

export function SectorBreakdown({ sectorData }: SectorBreakdownProps) {
  const [expandedSector, setExpandedSector] = useState<string | null>(null);

  const sortedSectors = useMemo(() => {
    return Array.from(sectorData.entries())
      .sort((a, b) => b[1].avgChange - a[1].avgChange);
  }, [sectorData]);

  const handleToggle = (sector: string) => {
    setExpandedSector(prev => prev === sector ? null : sector);
  };

  return (
    <div className="sector-breakdown-container">
      {sortedSectors.length === 0 && (
        <div className="sector-empty">
          <div className="sector-empty-icon"><PieChart size={32} /></div>
          <div>Waiting for sector data...</div>
        </div>
      )}
      <StaggerList className="sector-grid" staggerDelay={0.05}>
        {sortedSectors.map(([sector, data]) => {
          const isExpanded = expandedSector === sector;
          const topGainer = [...data.stocks].sort((a, b) => b.changePercent - a.changePercent)[0];
          const topLoser = [...data.stocks].sort((a, b) => a.changePercent - b.changePercent)[0];
          const unchangedCount = data.totalStocks - data.gainers - data.losers;
          const gainerPct = data.totalStocks > 0 ? (data.gainers / data.totalStocks) * 100 : 0;
          const unchangedPct = data.totalStocks > 0 ? (unchangedCount / data.totalStocks) * 100 : 0;
          const loserPct = data.totalStocks > 0 ? (data.losers / data.totalStocks) * 100 : 0;

          return (
            <motion.div
              layout
              key={sector}
              className={`sector-card glass-card ${isExpanded ? 'expanded' : ''}`}
            >
              <div className="sector-card-header" onClick={() => handleToggle(sector)}>
                <div className="sector-card-title">
                  <span className="sector-name">{sector}</span>
                  <span className="pill pill-accent sector-count-pill">{data.totalStocks}</span>
                </div>
                <div className={`sector-avg-change ${data.avgChange >= 0 ? 'positive' : 'negative'}`}>
                  {formatPercent(data.avgChange)}
                </div>
              </div>

              <div className="sector-mini-bar">
                <div className="sector-bar-segment bar-gainers" style={{ width: `${gainerPct}%` }} />
                <div className="sector-bar-segment bar-unchanged" style={{ width: `${unchangedPct}%` }} />
                <div className="sector-bar-segment bar-losers" style={{ width: `${loserPct}%` }} />
              </div>

              <div className="sector-extremes">
                {topGainer && (
                  <div className="sector-extreme">
                    <span className="sector-extreme-label">Top <ChevronUp size={12} className="inline" /></span>
                    <span className="positive">{topGainer.symbol}</span>
                    <span className="positive">{formatPercent(topGainer.changePercent)}</span>
                  </div>
                )}
                {topLoser && (
                  <div className="sector-extreme">
                    <span className="sector-extreme-label">Top <ChevronDown size={12} className="inline" /></span>
                    <span className="negative">{topLoser.symbol}</span>
                    <span className="negative">{formatPercent(topLoser.changePercent)}</span>
                  </div>
                )}
              </div>

              <div className="sector-expand-hint">
                <span className="sector-expand-icon">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="sector-detail-table">
                      <div className="sector-detail-header">
                        <span>Symbol</span>
                        <span>Price</span>
                        <span>Change %</span>
                      </div>
                      {data.stocks
                        .sort((a, b) => b.changePercent - a.changePercent)
                        .map(stock => (
                          <div key={stock.symbol} className="sector-detail-row">
                            <span className="sector-detail-symbol">{stock.symbol}</span>
                            <span className="sector-detail-price">{formatPrice(stock.price)}</span>
                            <span className={`sector-detail-change ${stock.changePercent >= 0 ? 'positive' : 'negative'}`}>
                              {formatPercent(stock.changePercent)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </StaggerList>
    </div>
  );
}
