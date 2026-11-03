import React, { useState, useMemo } from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { StockLogo } from '../common/StockLogo';
import { audioAlerts } from '../../utils/audioAlerts';
import { Table as TableIcon, Star, ArrowRight, TrendingUp, TrendingDown, Flame, Compass } from 'lucide-react';
import { LivePrice } from '../common/LivePrice';
import { PriceChange } from '../common/PriceChange';
import { LiveSignal } from '../common/LiveSignal';
import { motion, AnimatePresence } from 'framer-motion';

function formatVol(v: number) {
  if (v >= 1e7) return (v / 1e7).toFixed(2) + ' Cr';
  if (v >= 1e5) return (v / 1e5).toFixed(2) + ' L';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + ' K';
  return v.toString();
}

type SortRankMode = 'volume' | 'gainers' | 'losers' | 'nearHigh' | 'nearLow';

interface MarketTableWidgetProps {
  fullView?: boolean;
  watchlistOnly?: boolean;
}

export function MarketTableWidget({ fullView = false, watchlistOnly = false }: MarketTableWidgetProps) {
  const { searchQuery, setChartSymbol, setActiveTab } = useDashboard();
  const { isWatchlisted, toggle: toggleWatchlist } = useWatchlist();
  
  const [indexScope, setIndexScope] = useState<'ALL' | 'NIFTY50' | 'NIFTY500'>('ALL');
  const [sortRank, setSortRank] = useState<SortRankMode>('volume');

  const { stocks, allStocks } = useStocks(
    { index: indexScope, priceMin: 0, priceMax: 0, volumeMin: 0, search: searchQuery },
    'volume',
    'desc'
  );

  const dataset = useMemo(() => {
    let list = watchlistOnly ? allStocks.filter(s => isWatchlisted(s.symbol)) : stocks;

    // Apply ranking logic
    const sorted = [...list].sort((a, b) => {
      if (sortRank === 'gainers') return b.changePercent - a.changePercent;
      if (sortRank === 'losers') return a.changePercent - b.changePercent;
      if (sortRank === 'nearHigh') {
        const distA = a.dayHigh > 0 ? (a.dayHigh - a.price) / a.dayHigh : 999;
        const distB = b.dayHigh > 0 ? (b.dayHigh - b.price) / b.dayHigh : 999;
        return distA - distB;
      }
      if (sortRank === 'nearLow') {
        const distA = a.dayLow > 0 ? (a.price - a.dayLow) / a.dayLow : 999;
        const distB = b.dayLow > 0 ? (b.price - b.dayLow) / b.dayLow : 999;
        return distA - distB;
      }
      return b.volume - a.volume;
    });

    return sorted;
  }, [watchlistOnly, allStocks, stocks, isWatchlisted, sortRank]);

  const rows = fullView ? dataset : dataset.slice(0, 10);

  return (
    <div className="bento-widget-shell">
      <div className="bento-widget-core p-0 overflow-hidden">
        {/* Table Header Strip */}
        <div className="table-header-strip" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="table-title-group">
            <div className="bento-icon-box">
              <TableIcon size={17} strokeWidth={1.5} className="text-cyan-400" />
            </div>
            <div>
              <div className="table-title-main" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                {watchlistOnly ? 'PORTFOLIO WATCHLIST RADAR' : 'LIVE CASH MARKET SCANNER'}
              </div>
              <div className="table-subtitle-main">
                Ranked by {sortRank === 'volume' ? 'Volume Flow' : sortRank === 'gainers' ? 'Top Gainers' : sortRank === 'losers' ? 'Top Losers' : sortRank === 'nearHigh' ? 'Distance from Day High' : 'Distance from Day Low'} · {rows.length} securities
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Index Switcher */}
            {!watchlistOnly && (
              <div className="bento-segment-control">
                <button
                  type="button"
                  className={`bento-seg-btn ${indexScope === 'ALL' ? 'active-bull' : ''}`}
                  onClick={() => { audioAlerts.playClickHaptic(); setIndexScope('ALL'); }}
                >
                  <span>ALL</span>
                </button>
                <button
                  type="button"
                  className={`bento-seg-btn ${indexScope === 'NIFTY50' ? 'active-bull' : ''}`}
                  onClick={() => { audioAlerts.playClickHaptic(); setIndexScope('NIFTY50'); }}
                >
                  <span>NIFTY 50</span>
                </button>
                <button
                  type="button"
                  className={`bento-seg-btn ${indexScope === 'NIFTY500' ? 'active-bull' : ''}`}
                  onClick={() => { audioAlerts.playClickHaptic(); setIndexScope('NIFTY500'); }}
                >
                  <span>NIFTY 500</span>
                </button>
              </div>
            )}

            {/* Rank Mode Buttons */}
            <div className="bento-segment-control">
              <button
                type="button"
                className={`bento-seg-btn ${sortRank === 'volume' ? 'active-bull' : ''}`}
                onClick={() => { audioAlerts.playClickHaptic(); setSortRank('volume'); }}
              >
                <span>Vol Flow</span>
              </button>
              <button
                type="button"
                className={`bento-seg-btn ${sortRank === 'nearHigh' ? 'active-bull' : ''}`}
                onClick={() => { audioAlerts.playClickHaptic(); setSortRank('nearHigh'); }}
                title="Sort by nearest to Day High"
              >
                <span>Near High</span>
              </button>
              <button
                type="button"
                className={`bento-seg-btn ${sortRank === 'nearLow' ? 'active-bear' : ''}`}
                onClick={() => { audioAlerts.playClickHaptic(); setSortRank('nearLow'); }}
                title="Sort by nearest to Day Low"
              >
                <span>Near Low</span>
              </button>
              <button
                type="button"
                className={`bento-seg-btn ${sortRank === 'gainers' ? 'active-bull' : ''}`}
                onClick={() => { audioAlerts.playClickHaptic(); setSortRank('gainers'); }}
              >
                <span>% Move</span>
              </button>
            </div>

            {!fullView && (
              <button 
                type="button"
                className="bento-link-btn"
                onClick={() => { 
                  audioAlerts.playClickHaptic();
                  setActiveTab(watchlistOnly ? 'Watchlist' : 'Table'); 
                }}
              >
                <span>Open full market tape</span>
                <ArrowRight size={13} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Data Table */}
        <div className="table-scroll-container">
          <table className="vanguard-data-table">
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'center' }}></th>
                <th>Symbol</th>
                <th>Security Name</th>
                <th className="num-col">LTP (₹)</th>
                <th className="num-col">Net Chg</th>
                <th className="num-col">Chg %</th>
                <th className="num-col">Day High (₹)</th>
                <th className="num-col">Day Low (₹)</th>
                <th className="num-col">Volume Flow</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const up = r.changePercent >= 0;
                const starred = isWatchlisted(r.symbol);
                const isNearHigh = r.dayHigh > 0 && (r.price >= r.dayHigh * 0.995);
                const isNearLow = r.dayLow > 0 && (r.price <= r.dayLow * 1.005);
                const isVolSurge = r.volume > 500000;
                
                const distHighPct = r.dayHigh > 0 ? Math.max(0, ((r.dayHigh - r.price) / r.dayHigh) * 100) : 0;
                const distLowPct = r.dayLow > 0 ? Math.max(0, ((r.price - r.dayLow) / r.dayLow) * 100) : 0;

                return (
                  <tr 
                    key={r.symbol}
                    className="vanguard-table-row"
                  >
                    <td style={{ width: 44, textAlign: 'center' }}>
                      <button
                        type="button"
                        className="table-star-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          audioAlerts.playClickHaptic();
                          toggleWatchlist(r.symbol);
                        }}
                        title={starred ? 'Remove from Watchlist' : 'Add to Watchlist'}
                      >
                        <Star 
                          size={14} 
                          strokeWidth={1.5} 
                          className={starred ? 'text-amber-400 fill-amber-400' : 'text-slate-600 hover:text-slate-300'} 
                        />
                      </button>
                    </td>
                    <td 
                      className="sym-cell" 
                      onClick={() => { 
                        audioAlerts.playClickHaptic();
                        setChartSymbol(r.symbol); 
                        setActiveTab('Charts'); 
                      }}
                    >
                      <div className="sym-flex-wrap" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <StockLogo symbol={r.symbol} name={r.name} size={26} className="shrink-0" />
                        <span className="sym-ticker-text font-mono" style={{ fontWeight: 800 }}>{r.symbol}</span>
                        {isNearHigh && <LiveSignal type="breakout" label="HIGH" />}
                        {isNearLow && <LiveSignal type="breakdown" label="LOW" />}
                        {isVolSurge && !isNearHigh && !isNearLow && <LiveSignal type="spike" label="VOL" />}
                      </div>
                    </td>

                    <td className="company-cell" style={{ color: 'var(--text-2)' }}>{r.name}</td>

                    <td className="num-col font-mono tabular-nums">
                      <LivePrice price={r.price} decimals={2} />
                    </td>

                    <td className="num-col font-mono tabular-nums" style={{ color: up ? 'var(--up)' : 'var(--down)', fontWeight: 700 }}>
                      {up ? '+' : ''}{r.change.toFixed(2)}
                    </td>

                    <td className="num-col">
                      <PriceChange change={r.change} changePercent={r.changePercent} />
                    </td>

                    <td className="num-col font-mono tabular-nums">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <span style={{ fontWeight: 700, color: isNearHigh ? 'var(--up)' : 'var(--text-1)' }}>
                          ₹{r.dayHigh > 0 ? r.dayHigh.toFixed(2) : r.price.toFixed(2)}
                        </span>
                        <span 
                          style={{
                            display: 'inline-block',
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            background: distHighPct <= 0.25 ? 'rgba(0, 214, 163, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                            color: distHighPct <= 0.25 ? 'var(--up)' : 'var(--text-3)',
                            border: distHighPct <= 0.25 ? '1px solid rgba(0, 214, 163, 0.35)' : '1px solid transparent'
                          }}
                        >
                          {distHighPct <= 0.05 ? 'AT HIGH' : `-${distHighPct.toFixed(2)}%`}
                        </span>
                      </div>
                    </td>

                    <td className="num-col font-mono tabular-nums">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <span style={{ fontWeight: 700, color: isNearLow ? 'var(--down)' : 'var(--text-1)' }}>
                          ₹{r.dayLow > 0 ? r.dayLow.toFixed(2) : r.price.toFixed(2)}
                        </span>
                        <span 
                          style={{
                            display: 'inline-block',
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            background: distLowPct <= 0.25 ? 'rgba(255, 66, 104, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                            color: distLowPct <= 0.25 ? 'var(--down)' : 'var(--text-3)',
                            border: distLowPct <= 0.25 ? '1px solid rgba(255, 66, 104, 0.35)' : '1px solid transparent'
                          }}
                        >
                          {distLowPct <= 0.05 ? 'AT LOW' : `+${distLowPct.toFixed(2)}%`}
                        </span>
                      </div>
                    </td>

                    <td className="num-col font-mono tabular-nums text-cyan-300 font-semibold">{formatVol(r.volume)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
