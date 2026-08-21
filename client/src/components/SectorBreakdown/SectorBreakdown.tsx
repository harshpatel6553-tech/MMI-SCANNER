import { useState, useMemo } from 'react';
import type { StockData } from '../../types';
import { formatPercent } from '../../utils/formatters';
import { ChevronDown, PieChart } from 'lucide-react';
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
    <div className="sector-breakdown-container" style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 24px'}}>
      {sortedSectors.map(([sector, data]) => {
        const topGainer = [...data.stocks].sort((a, b) => b.changePercent - a.changePercent)[0];
        const topLoser = [...data.stocks].sort((a, b) => a.changePercent - b.changePercent)[0];
        const up = data.avgChange >= 0;

        return (
          <div key={sector} style={{borderBottom: '1px solid var(--border-soft)', paddingBottom: '16px', display: 'flex', flexDirection: 'column'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                 <span style={{fontWeight: 700, fontSize: '13px', color: 'var(--text-1)'}}>{sector}</span>
                 <span style={{fontSize: '9px', color: 'var(--text-3)', fontWeight: 600}}>{data.totalStocks}</span>
              </div>
              <span style={{fontWeight: 700, fontSize: '14.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-1)'}}>
                 {up ? '+' : ''}{data.avgChange.toFixed(2)}%
              </span>
            </div>
            
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '9.5px', fontWeight: 600}}>
               <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
                  <span style={{color: 'var(--text-2)'}}>Top</span>
                  <span style={{color: 'var(--text-2)'}}>^</span>
                  <span style={{color: 'var(--text-1)', marginLeft: '2px'}}>{topGainer?.symbol || '-'}</span>
                  <span style={{color: 'var(--text-2)', fontFamily: 'var(--font-mono)'}}>
                     {topGainer ? `${topGainer.changePercent >= 0 ? '+' : ''}${topGainer.changePercent.toFixed(2)}%` : '-'}
                  </span>
               </div>
               <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
                  <span style={{color: 'var(--text-2)'}}>Top</span>
                  <span style={{color: 'var(--text-2)'}}>v</span>
                  <span style={{color: 'var(--text-1)', marginLeft: '2px'}}>{topLoser?.symbol || '-'}</span>
                  <span style={{color: 'var(--text-2)', fontFamily: 'var(--font-mono)'}}>
                     {topLoser ? `${topLoser.changePercent.toFixed(2)}%` : '-'}
                  </span>
                  <ChevronDown size={14} color="var(--text-3)" style={{cursor: 'pointer', marginLeft: '4px'}} onClick={() => setExpandedSector(expandedSector === sector ? null : sector)} />
               </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
