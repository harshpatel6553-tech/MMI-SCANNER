import { useState, useMemo } from 'react';
import type { StockData } from '../../types';
import { formatPercent, formatPrice } from '../../utils/formatters';
import { ChevronDown, ChevronUp, PieChart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

  if (sortedSectors.length === 0) {
    return (
      <div className="sector-breakdown-container">
        <div className="sector-empty">
          <div className="sector-empty-icon"><PieChart size={32} /></div>
          <div>Waiting for sector data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="sector-breakdown-container" style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 24px', alignItems: 'start'}}>
      {sortedSectors.map(([sector, data]) => {
        const isExpanded = expandedSector === sector;
        const topGainer = [...data.stocks].sort((a, b) => b.changePercent - a.changePercent)[0];
        const topLoser = [...data.stocks].sort((a, b) => a.changePercent - b.changePercent)[0];
        const up = data.avgChange >= 0;

        return (
          <div key={sector} style={{borderBottom: '1px solid var(--border-soft)', paddingBottom: '16px', display: 'flex', flexDirection: 'column'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                 <span style={{fontWeight: 700, fontSize: '13.5px', fontFamily: 'var(--font-display)', color: 'var(--text-1)'}}>{sector}</span>
                 <span style={{fontSize: '9.5px', color: 'var(--text-3)', fontWeight: 600}}>{data.totalStocks}</span>
              </div>
              <span style={{fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-mono)', color: 'var(--text-1)'}}>
                 {up ? '+' : ''}{data.avgChange.toFixed(2)}%
              </span>
            </div>
            
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', fontSize: '10px', fontWeight: 600}}>
               <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
                  <span style={{color: 'var(--text-3)'}}>Top</span>
                  <span style={{color: 'var(--text-3)'}}>^</span>
                  <span style={{color: 'var(--text-1)', marginLeft: '2px', textTransform: 'uppercase'}}>{topGainer?.symbol || '-'}</span>
                  <span style={{color: 'var(--text-1)', fontFamily: 'var(--font-mono)'}}>
                     {topGainer ? `${topGainer.changePercent >= 0 ? '+' : ''}${topGainer.changePercent.toFixed(2)}%` : '-'}
                  </span>
               </div>
               <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
                  <span style={{color: 'var(--text-3)'}}>Top</span>
                  <span style={{color: 'var(--text-3)'}}>v</span>
                  <span style={{color: 'var(--text-1)', marginLeft: '2px', textTransform: 'uppercase'}}>{topLoser?.symbol || '-'}</span>
                  <span style={{color: 'var(--text-1)', fontFamily: 'var(--font-mono)'}}>
                     {topLoser ? `${topLoser.changePercent.toFixed(2)}%` : '-'}
                  </span>
                  <div style={{cursor: 'pointer', padding: '4px', marginLeft: '2px', color: 'var(--text-2)'}} onClick={() => setExpandedSector(isExpanded ? null : sector)}>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
               </div>
            </div>

            <AnimatePresence>
              {isExpanded && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  style={{overflow: 'hidden'}}
                >
                  <div style={{marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-surface-2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-soft)'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600, paddingBottom: '6px', borderBottom: '1px dashed var(--border-soft)'}}>
                      <span>Symbol</span>
                      <span>Change</span>
                    </div>
                    {data.stocks
                      .sort((a, b) => b.changePercent - a.changePercent)
                      .map(stock => (
                        <div key={stock.symbol} style={{display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 500}}>
                          <span style={{color: 'var(--text-1)'}}>{stock.symbol}</span>
                          <span style={{color: stock.changePercent >= 0 ? 'var(--up)' : 'var(--down)', fontFamily: 'var(--font-mono)'}}>
                            {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                          </span>
                        </div>
                      ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        );
      })}
    </div>
  );
}
