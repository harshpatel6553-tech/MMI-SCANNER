import React, { useState } from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';
import { CometCard } from '../ui/comet-card';
import { StockLogo } from '../common/StockLogo';
import { audioAlerts } from '../../utils/audioAlerts';
import { AnimatedEmoji } from '../common/AnimatedEmoji';

export function TopMoversWidget() {
  const [tab, setTab] = useState<'gainers'|'losers'>('gainers');
  const { allStocks, priceFlash } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  const { setChartSymbol, setActiveTab } = useDashboard();

  const sorted = [...allStocks].sort((a, b) => tab === 'gainers' ? b.changePercent - a.changePercent : a.changePercent - b.changePercent);
  const top5 = sorted.slice(0, 5);

  return (
    <CometCard>
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="card-head" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AnimatedEmoji name={tab === 'gainers' ? 'livenews' : 'blood'} size={22} />
            <span className="card-title" style={{ letterSpacing: '-0.01em' }}>Top Market Movers</span>
          </div>
          <div className="tabs">
            <div 
              className={"tab" + (tab === 'gainers' ? ' active' : '')} 
              onClick={() => {
                audioAlerts.playClickHaptic();
                setTab('gainers');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <AnimatedEmoji name="rocket" size={14} /> Gainers
            </div>
            <div 
              className={"tab" + (tab === 'losers' ? ' active' : '')} 
              onClick={() => {
                audioAlerts.playClickHaptic();
                setTab('losers');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <AnimatedEmoji name="blood" size={14} /> Losers
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {top5.map(g => {
            const flash = priceFlash.get(g.symbol);
            return (
            <div 
              className="mover-row" 
              key={g.symbol}
              onClick={() => {
                audioAlerts.playClickHaptic();
                setChartSymbol(g.symbol);
                setActiveTab('Charts');
              }}
              style={{ cursor: 'pointer', padding: '10px 4px', borderRadius: 8, transition: 'background 0.15s ease' }}
              title={`Click to analyze ${g.symbol} chart`}
            >
              <StockLogo symbol={g.symbol} name={g.name} size={24} style={{ marginRight: 6, flexShrink: 0 }} />
              <div className="mover-sym" style={{ fontWeight: 700 }}>{g.symbol}</div>
              <div className="mover-co">{g.name}</div>
              <svg className="spark" viewBox="0 0 52 22">
                {tab === 'gainers' ? (
                  <polyline points="0,16 8,14 16,17 24,10 32,12 40,5 52,2" fill="none" stroke="#34d399" strokeWidth="1.8"/>
                ) : (
                  <polyline points="0,6 8,8 16,5 24,12 32,10 40,17 52,20" fill="none" stroke="#f87171" strokeWidth="1.8"/>
                )}
              </svg>
              <div className={`mover-price num tabular-nums ${flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}`} style={{ fontWeight: 600 }}>
                ₹{g.price.toFixed(2)}
              </div>
              <div className={"chg-pill tabular-nums " + (g.change >= 0 ? 'up' : 'down')} style={{ fontWeight: 700 }}>
                {g.changePercent > 0 ? '+' : ''}{g.changePercent.toFixed(2)}%
              </div>
            </div>
          )})}
        </div>
      </div>
    </CometCard>
  );
}
