import React, { useMemo } from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';

export function SectorPulseWidget() {
  const { sectorData } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  const { setActiveTab } = useDashboard();

  const sectors = useMemo(() => {
    return Array.from(sectorData.entries()).map(([n, d]) => {
      const sorted = [...d.stocks].sort((a, b) => b.changePercent - a.changePercent);
      return {
        n,
        avgChange: d.avgChange,
        totalStocks: d.totalStocks,
        topGainer: sorted[0],
        topLoser: sorted[sorted.length - 1]
      };
    }).sort((a, b) => b.avgChange - a.avgChange).slice(0, 6);
  }, [sectorData]);

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title" style={{textTransform: 'uppercase', letterSpacing: '0.05em'}}>Sector Pulse</span>
        <span style={{fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600}}>
          6 OF {sectorData.size} SECTORS
        </span>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px'}}>
        {sectors.map(s => {
          const up = s.avgChange >= 0;
          return (
            <div key={s.n} style={{background: 'var(--bg-surface-2)', border: '1px solid var(--border-soft)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column'}}>
              <div style={{fontSize: '13px', fontWeight: 600, color: 'var(--text-1)'}}>{s.n}</div>
              <div style={{fontSize: '10px', color: 'var(--text-3)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em'}}>{s.totalStocks} STOCKS</div>
              
              <div style={{fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: up ? 'var(--up)' : 'var(--down)', marginTop: '12px'}}>
                {up ? '+' : ''}{s.avgChange.toFixed(2)}%
              </div>
              
              <svg viewBox="0 0 100 20" style={{width: '100%', height: '28px', margin: '8px 0', opacity: 0.8}}>
                {up ? (
                  <polyline points="0,18 20,15 40,16 60,10 80,12 100,2" fill="none" stroke="var(--up)" strokeWidth="2" />
                ) : (
                  <polyline points="0,2 20,5 40,4 60,10 80,8 100,18" fill="none" stroke="var(--down)" strokeWidth="2" />
                )}
              </svg>
              
              <div style={{display: 'flex', flexDirection: 'column', gap: '4px', marginTop: 'auto', paddingTop: '8px'}}>
                 <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 600}}>
                   <div style={{display: 'flex', gap: '6px', color: 'var(--text-3)'}}>
                     <span style={{letterSpacing: '0.05em'}}>TOP</span>
                     <span style={{color: 'var(--up)'}}>?</span>
                     <span style={{color: 'var(--text-1)', marginLeft: '6px'}}>{s.topGainer?.symbol || '-'}</span>
                   </div>
                   <span style={{color: 'var(--up)', fontFamily: 'var(--font-mono)'}}>
                     {s.topGainer ? `+${s.topGainer.changePercent.toFixed(2)}%` : '-'}
                   </span>
                 </div>
                 <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 600}}>
                   <div style={{display: 'flex', gap: '6px', color: 'var(--text-3)'}}>
                     <span style={{letterSpacing: '0.05em'}}>TOP</span>
                     <span style={{color: 'var(--down)'}}>?</span>
                     <span style={{color: 'var(--text-1)', marginLeft: '6px'}}>{s.topLoser?.symbol || '-'}</span>
                   </div>
                   <span style={{color: 'var(--down)', fontFamily: 'var(--font-mono)'}}>
                     {s.topLoser ? `${s.topLoser.changePercent.toFixed(2)}%` : '-'}
                   </span>
                 </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
