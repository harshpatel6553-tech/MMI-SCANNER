import React, { useState } from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';
import { StockLogo } from '../common/StockLogo';
import { audioAlerts } from '../../utils/audioAlerts';
import { TrendingUp, TrendingDown, Flame } from 'lucide-react';

export function TopMoversWidget() {
  const [tab, setTab] = useState<'gainers' | 'losers'>('gainers');
  const { allStocks, priceFlash } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  const { setChartSymbol, setActiveTab } = useDashboard();

  const sorted = [...allStocks].sort((a, b) => tab === 'gainers' ? b.changePercent - a.changePercent : a.changePercent - b.changePercent);
  const top5 = sorted.slice(0, 5);

  return (
    <div className="bento-widget-shell">
      <div className="bento-widget-core">
        <div className="bento-card-header">
          <div className="bento-title-left">
            <div className="bento-icon-box">
              <Flame size={17} strokeWidth={1.5} className="text-amber-400" />
            </div>
            <div>
              <span className="bento-card-title">Top Market Movers</span>
              <div className="bento-card-subtitle">Real-time percentage velocity across active equities</div>
            </div>
          </div>
          <div className="bento-segment-control">
            <button
              type="button"
              className={`bento-seg-btn ${tab === 'gainers' ? 'active-bull' : ''}`}
              onClick={() => {
                audioAlerts.playClickHaptic();
                setTab('gainers');
              }}
            >
              <TrendingUp size={13} strokeWidth={1.5} />
              <span>Gainers</span>
            </button>
            <button
              type="button"
              className={`bento-seg-btn ${tab === 'losers' ? 'active-bear' : ''}`}
              onClick={() => {
                audioAlerts.playClickHaptic();
                setTab('losers');
              }}
            >
              <TrendingDown size={13} strokeWidth={1.5} />
              <span>Losers</span>
            </button>
          </div>
        </div>

        <div className="bento-list-body">
          {top5.map((g) => {
            const flash = priceFlash.get(g.symbol);
            return (
              <div 
                className="mover-row-item" 
                key={g.symbol}
                onClick={() => {
                  audioAlerts.playClickHaptic();
                  setChartSymbol(g.symbol);
                  setActiveTab('Charts');
                }}
                title={`Click to analyze ${g.symbol} chart`}
              >
                <div className="mover-identity-group">
                  <StockLogo symbol={g.symbol} name={g.name} size={26} className="shrink-0" />
                  <div className="mover-names-wrap">
                    <span className="mover-sym-text">{g.symbol}</span>
                    <span className="mover-company-text">{g.name}</span>
                  </div>
                </div>

                <div className="mover-spark-wrap">
                  <svg className="spark-svg" viewBox="0 0 54 22">
                    {tab === 'gainers' ? (
                      <polyline points="0,18 9,15 18,17 27,11 36,13 45,6 54,3" fill="none" stroke="#00f59b" strokeWidth="2" strokeLinecap="round" />
                    ) : (
                      <polyline points="0,4 9,7 18,5 27,12 36,10 45,16 54,19" fill="none" stroke="#ff2a5f" strokeWidth="2" strokeLinecap="round" />
                    )}
                  </svg>
                </div>

                <div className="mover-price-column">
                  <div className={`mover-price-val num tabular-nums ${flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}`}>
                    ₹{g.price.toFixed(2)}
                  </div>
                  <div className={`mover-pct-badge num tabular-nums ${g.change >= 0 ? 'bull' : 'bear'}`}>
                    {g.changePercent > 0 ? '+' : ''}{g.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
