import { useState, useMemo } from 'react';
import type { StockData } from '../../types';
import { formatPercent, formatPrice } from '../../utils/formatters';
import { ChevronDown, ChevronUp, PieChart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboard } from '../../contexts/DashboardContext';
import { audioAlerts } from '../../utils/audioAlerts';
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
  const { setActiveTab, setChartSymbol } = useDashboard();

  const sortedSectors = useMemo(() => {
    return Array.from(sectorData.entries())
      .sort((a, b) => b[1].avgChange - a[1].avgChange);
  }, [sectorData]);

  if (sortedSectors.length === 0) {
    return (
      <div className="sector-breakdown-container">
        <div className="sector-empty">
          <div className="sector-empty-icon"><PieChart size={32} /></div>
          <div>Waiting for live sector telemetry...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="sector-breakdown-container" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', alignItems: 'start'}}>
      {sortedSectors.map(([sector, data]) => {
        const isExpanded = expandedSector === sector;
        const topGainer = [...data.stocks].sort((a, b) => b.changePercent - a.changePercent)[0];
        const topLoser = [...data.stocks].sort((a, b) => a.changePercent - b.changePercent)[0];
        const up = data.avgChange >= 0;

        return (
          <div 
            key={sector} 
            className="beast-card"
            style={{
              padding: '18px', 
              display: 'flex', 
              flexDirection: 'column',
              cursor: 'pointer',
              borderColor: isExpanded ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)'
            }}
            onClick={() => {
              audioAlerts.playClickHaptic();
              setExpandedSector(isExpanded ? null : sector);
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <div>
                <div style={{fontSize: '15px', fontWeight: 800, fontFamily: 'var(--font-display)', color: '#fff', letterSpacing: '-0.01em'}}>{sector}</div>
                <div style={{fontSize: '10px', color: 'var(--text-3)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700}}>
                  {data.totalStocks} SECURITIES · <span style={{ color: 'var(--up)' }}>{data.gainers}▲</span> <span style={{ color: 'var(--down)' }}>{data.losers}▼</span>
                </div>
              </div>
              <div style={{color: 'var(--text-3)', background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '4px'}}>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>
            
            <div style={{fontSize: '26px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: up ? 'var(--up)' : 'var(--down)', marginTop: '14px', letterSpacing: '-0.02em'}} className="tabular-nums">
              {up ? '+' : ''}{data.avgChange.toFixed(2)}%
            </div>
            
            <svg viewBox="0 0 100 20" style={{width: '100%', height: '32px', margin: '12px 0', opacity: 0.9}}>
              {up ? (
                <polyline points="0,18 20,15 40,16 60,10 80,12 100,2" fill="none" stroke="var(--up)" strokeWidth="2" />
              ) : (
                <polyline points="0,2 20,5 40,4 60,10 80,8 100,18" fill="none" stroke="var(--down)" strokeWidth="2" />
              )}
            </svg>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)'}}>
               <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 600}}>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-3)'}}>
                   <span style={{letterSpacing: '0.04em', fontSize: '10px'}}>TOP GAINER</span>
                   <span style={{color: 'var(--up)', fontWeight: 800}}>▲</span>
                   <span style={{color: '#fff', fontWeight: 700}}>{topGainer?.symbol || '-'}</span>
                 </div>
                 <span style={{color: 'var(--up)', fontFamily: 'var(--font-mono)', fontWeight: 700}}>
                   {topGainer ? `+${topGainer.changePercent.toFixed(2)}%` : '-'}
                 </span>
               </div>
               <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 600}}>
                 <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-3)'}}>
                   <span style={{letterSpacing: '0.04em', fontSize: '10px'}}>TOP LOSER</span>
                   <span style={{color: 'var(--down)', fontWeight: 800}}>▼</span>
                   <span style={{color: '#fff', fontWeight: 700}}>{topLoser?.symbol || '-'}</span>
                 </div>
                 <span style={{color: 'var(--down)', fontFamily: 'var(--font-mono)', fontWeight: 700}}>
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
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700, paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.06)', letterSpacing: '0.05em'}}>
                      <span>Security</span>
                      <span>Change %</span>
                    </div>
                    {data.stocks
                      .sort((a, b) => b.changePercent - a.changePercent)
                      .map(stock => (
                        <div 
                          key={stock.symbol} 
                          onClick={() => {
                            audioAlerts.playClickHaptic();
                            setChartSymbol(stock.symbol);
                            setActiveTab('Charts');
                          }}
                          style={{display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 600, padding: '4px 6px', borderRadius: 4, cursor: 'pointer', transition: 'background 0.1s ease'}}
                          className="mover-row"
                          title={`Analyze ${stock.symbol} chart`}
                        >
                          <span style={{color: '#fff'}}>{stock.symbol}</span>
                          <span style={{color: stock.changePercent >= 0 ? 'var(--up)' : 'var(--down)', fontFamily: 'var(--font-mono)', fontWeight: 700}}>
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
