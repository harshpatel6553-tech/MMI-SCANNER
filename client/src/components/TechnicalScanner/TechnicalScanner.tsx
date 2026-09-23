import React, { useState, useMemo } from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';
import { Activity, TrendingUp, ArrowLeftRight } from 'lucide-react';

function formatVol(v: number) {
  if(v >= 1e7) return (v / 1e7).toFixed(1) + 'Cr';
  if(v >= 1e5) return (v / 1e5).toFixed(1) + 'L';
  if(v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toString();
}

type TechTab = 'MACD' | 'RSI' | 'EMACROSS';

export function TechnicalScanner() {
  const [activeTab, setActiveTab] = useState<TechTab>('MACD');
  const { allStocks, priceFlash } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  const { setSelectedStock } = useDashboard();

  const filteredStocks = useMemo(() => {
    let result = [...allStocks];
    if (activeTab === 'MACD') {
      result = result.filter(s => s.macdWeeklyBuy);
      result.sort((a, b) => b.changePercent - a.changePercent);
    } else if (activeTab === 'RSI') {
      // Sort by RSI ascending (most oversold first), filter out ones without RSI
      result = result.filter(s => s.rsiDaily !== undefined);
      result.sort((a, b) => (a.rsiDaily || 50) - (b.rsiDaily || 50));
    } else if (activeTab === 'EMACROSS') {
      result = result.filter(s => s.emaCrossDaily);
      result.sort((a, b) => b.changePercent - a.changePercent);
    }
    return result;
  }, [allStocks, activeTab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%', minWidth: 0, paddingBottom: '40px' }}>
      
      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 0 }}>
        <div 
          onClick={() => setActiveTab('MACD')}
          className={`tab ${activeTab === 'MACD' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Activity size={16} /> MACD Weekly Buy
          {activeTab === 'MACD' && <span className="badge-pill up" style={{ fontSize: 10, padding: '1px 6px' }}>{filteredStocks.length}</span>}
        </div>
        <div 
          onClick={() => setActiveTab('RSI')}
          className={`tab ${activeTab === 'RSI' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <TrendingUp size={16} /> RSI (14) Momentum
          {activeTab === 'RSI' && <span className="badge-pill cyan" style={{ fontSize: 10, padding: '1px 6px' }}>{filteredStocks.length}</span>}
        </div>
        <div 
          onClick={() => setActiveTab('EMACROSS')}
          className={`tab ${activeTab === 'EMACROSS' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowLeftRight size={16} /> EMA Bullish Cross (13, 34)
          {activeTab === 'EMACROSS' && <span className="badge-pill up" style={{ fontSize: 10, padding: '1px 6px' }}>{filteredStocks.length}</span>}
        </div>
      </div>

      {/* Table */}
      <div className="card table-card" style={{flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column'}}>
        <div className="card-head" style={{padding: '16px 20px'}}>
          <span className="card-title">
            {activeTab === 'MACD' && `MACD Weekly Buy Signals (${filteredStocks.length})`}
            {activeTab === 'RSI' && `RSI Screener (Sorted by Oversold)`}
            {activeTab === 'EMACROSS' && `Daily EMA (13, 34) Bullish Crossovers (${filteredStocks.length})`}
          </span>
        </div>
        
        <div style={{flex: 1, overflowY: 'auto'}}>
          <table>
            <thead>
              <tr>
                <th style={{position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-surface)', padding: '12px 20px'}}>Symbol</th>
                <th style={{position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-surface)', padding: '12px 20px'}}>Company</th>
                <th className="num-col" style={{position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-surface)', padding: '12px 20px'}}>Price</th>
                <th className="num-col" style={{position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-surface)', padding: '12px 20px'}}>Change %</th>
                <th className="num-col" style={{position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-surface)', padding: '12px 20px'}}>Volume</th>
                <th style={{position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-surface)', padding: '12px 20px', textAlign: 'right'}}>Signal</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map(stock => {
                const up = stock.change >= 0;
                const flash = priceFlash.get(stock.symbol);
                return (
                  <tr key={stock.symbol} onClick={() => setSelectedStock(stock.symbol)} style={{cursor: 'pointer'}}>
                    <td style={{padding: '12px 20px', fontWeight: 600, color: 'var(--text-1)'}}>{stock.symbol}</td>
                    <td style={{padding: '12px 20px', color: 'var(--text-2)', fontSize: '11px'}}>{stock.name}</td>
                    <td className={`num-col ${flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}`} style={{padding: '12px 20px', fontFamily: 'var(--font-mono)'}}>
                      {stock.price.toFixed(2)}
                    </td>
                    <td className={`num-col ${up ? 'up-txt' : 'down-txt'}`} style={{padding: '12px 20px', fontFamily: 'var(--font-mono)', fontWeight: 600}}>
                      {up ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </td>
                    <td className="num-col" style={{padding: '12px 20px', color: 'var(--text-2)'}}>{formatVol(stock.volume)}</td>
                    <td style={{padding: '12px 20px', textAlign: 'right'}}>
                      {activeTab === 'MACD' && <span style={{background: 'var(--up-dim)', color: 'var(--up)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700}}>BUY</span>}
                      {activeTab === 'RSI' && (
                        <span style={{
                          background: stock.rsiDaily! < 30 ? 'var(--up-dim)' : stock.rsiDaily! > 70 ? 'var(--down-dim)' : 'rgba(255,255,255,0.05)',
                          color: stock.rsiDaily! < 30 ? 'var(--up)' : stock.rsiDaily! > 70 ? 'var(--down)' : 'var(--text-2)',
                          padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-mono)'
                        }}>
                          {stock.rsiDaily?.toFixed(2)}
                        </span>
                      )}
                      {activeTab === 'EMACROSS' && <span style={{background: 'var(--up-dim)', color: 'var(--up)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700}}>CROSSOVER</span>}
                    </td>
                  </tr>
                );
              })}
              {filteredStocks.length === 0 && (
                <tr>
                  <td colSpan={6} style={{padding: '40px', textAlign: 'center', color: 'var(--text-3)'}}>
                    No stocks currently matching this technical scanner criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
