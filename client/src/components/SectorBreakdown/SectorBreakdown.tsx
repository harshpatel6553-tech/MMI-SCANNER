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
    <div className="sector-breakdown-container" style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'start'}}>
      {sortedSectors.map(([sector, data]) => {
        const isExpanded = expandedSector === sector;
        const topGainer = [...data.stocks].sort((a, b) => b.changePercent - a.changePercent)[0];
        const topLoser = [...data.stocks].sort((a, b) => a.changePercent - b.changePercent)[0];
        const up = data.avgChange >= 0;

        return (
          <div 
            key={sector} 
            style={{
              background: 'var(--bg-surface-2)', 
              border: '1px solid var(--border-soft)', 
              borderRadius: '8px', 
              padding: '16px', 
              display: 'flex', 
              flexDirection: 'column',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
              borderColor: isExpanded ? 'var(--border-focus)' : 'var(--border-soft)'
            }}
            onClick={() => setExpandedSector(isExpanded ? null : sector)}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <div>
                <div style={{fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-1)'}}>{sector}</div>
                <div style={{fontSize: '10px', color: 'var(--text-3)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em'}}>{data.totalStocks} STOCKS</div>
              </div>
              <div style={{color: 'var(--text-3)'}}>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>
            
            <div style={{fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: up ? 'var(--up)' : 'var(--down)', marginTop: '16px'}}>
              {up ? '+' : ''}{data.avgChange.toFixed(2)}%
            </div>
            
            <svg viewBox="0 0 100 20" style={{width: '100%', height: '32px', margin: '12px 0', opacity: 0.8}}>
              {up ? (
                <polyline points="0,18 20,15 40,16 60,10 80,12 100,2" fill="none" stroke="var(--up)" strokeWidth="1.5" />
              ) : (
                <polyline points="0,2 20,5 40,4 60,10 80,8 100,18" fill="none" stroke="var(--down)" strokeWidth="1.5" />
              )}
            </svg>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', paddingTop: '8px'}}>
               <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600}}>
                 <div style={{display: 'flex', gap: '8px', color: 'var(--text-3)'}}>
                   <span style={{letterSpacing: '0.05em'}}>TOP</span>
                   <span style={{color: 'var(--up)'}}>?</span>
                   <span style={{color: 'var(--text-1)', marginLeft: '4px'}}>{topGainer?.symbol || '-'}</span>
                 </div>
                 <span style={{color: 'var(--up)', fontFamily: 'var(--font-mono)'}}>
                   {topGainer ? `+${topGainer.changePercent.toFixed(2)}%` : '-'}
                 </span>
               </div>
               <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600}}>
                 <div style={{display: 'flex', gap: '8px', color: 'var(--text-3)'}}>
                   <span style={{letterSpacing: '0.05em'}}>TOP</span>
                   <span style={{color: 'var(--down)'}}>?</span>
                   <span style={{color: 'var(--text-1)', marginLeft: '4px'}}>{topLoser?.symbol || '-'}</span>
                 </div>
                 <span style={{color: 'var(--down)', fontFamily: 'var(--font-mono)'}}>
                   {topLoser ? `${topLoser.changePercent.toFixed(2)}%` : '-'}
                 </span>
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
                  <div style={{marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-soft)'}}>
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
