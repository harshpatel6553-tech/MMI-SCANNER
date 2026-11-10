import React, { useState } from 'react';
import type { StockData } from '../../types';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';
import { StockLogo } from '../common/StockLogo';
import { audioAlerts } from '../../utils/audioAlerts';
import { TrendingUp, TrendingDown, Flame } from 'lucide-react';
import { LivePrice } from '../common/LivePrice';
import { PriceChange } from '../common/PriceChange';
import { motion, AnimatePresence } from 'framer-motion';

interface TopMoversWidgetProps {
  allStocks?: StockData[];
  priceFlash?: Map<string, 'up' | 'down'>;
}

export function TopMoversWidget(props: TopMoversWidgetProps) {
  if (props.allStocks) {
    return <TopMoversContent allStocks={props.allStocks} priceFlash={props.priceFlash || new Map()} />;
  }
  return <TopMoversWithHook />;
}

function TopMoversWithHook() {
  const { allStocks, priceFlash } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  return <TopMoversContent allStocks={allStocks} priceFlash={priceFlash} />;
}

function TopMoversContent({ allStocks, priceFlash }: { allStocks: StockData[]; priceFlash: Map<string, 'up' | 'down'> }) {
  const [tab, setTab] = useState<'gainers' | 'losers'>('gainers');
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
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {top5.map((g, idx) => {
                return (
                  <motion.div 
                    className="mover-row-item" 
                    key={g.symbol}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.25 }}
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
                        <span className="mover-sym-text font-mono">{g.symbol}</span>
                        <span className="mover-company-text">{g.name}</span>
                      </div>
                    </div>

                    <div className="mover-spark-wrap">
                      <svg className="spark-svg" viewBox="0 0 54 22">
                        {tab === 'gainers' ? (
                          <polyline points="0,18 9,15 18,17 27,11 36,13 45,6 54,3" fill="none" stroke="var(--up)" strokeWidth="2" strokeLinecap="round" />
                        ) : (
                          <polyline points="0,4 9,7 18,5 27,12 36,10 45,16 54,19" fill="none" stroke="var(--down)" strokeWidth="2" strokeLinecap="round" />
                        )}
                      </svg>
                    </div>

                    <div className="mover-price-column font-mono tabular-nums">
                      <div className="mover-price-val font-mono">
                        <LivePrice price={g.price} decimals={2} />
                      </div>
                      <PriceChange change={g.change} changePercent={g.changePercent} />
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
