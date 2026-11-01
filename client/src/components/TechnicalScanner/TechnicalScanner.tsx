import React, { useState, useMemo } from 'react';
import { useStocks } from '../../hooks/useStocks';
import { useDashboard } from '../../contexts/DashboardContext';
import { audioAlerts } from '../../utils/audioAlerts';
import { StockLogo } from '../common/StockLogo';
import { LivePrice } from '../common/LivePrice';
import { PriceChange } from '../common/PriceChange';
import { TelemetryPulse } from '../common/TelemetryPulse';
import { AnimatedNumber } from '../common/AnimatedNumber';
import { 
  Activity, 
  TrendingUp, 
  ArrowLeftRight, 
  SlidersHorizontal, 
  CheckSquare, 
  Square, 
  Flame, 
  Zap, 
  Target, 
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function formatVol(v: number) {
  if (v >= 1e7) return (v / 1e7).toFixed(2) + ' Cr';
  if (v >= 1e5) return (v / 1e5).toFixed(2) + ' L';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + ' K';
  return v.toString();
}

interface ConditionState {
  emaCross: boolean;
  volSurge: boolean;
  rsiBull: boolean;
  dayHighBreak: boolean;
  macdBuy: boolean;
  rsiOversold: boolean;
}

const DEFAULT_CONDITIONS: ConditionState = {
  emaCross: true,
  volSurge: true,
  rsiBull: false,
  dayHighBreak: false,
  macdBuy: false,
  rsiOversold: false,
};

export function TechnicalScanner() {
  const [indexScope, setIndexScope] = useState<'ALL' | 'NIFTY50' | 'NIFTY500'>('ALL');
  const [conditions, setConditions] = useState<ConditionState>(DEFAULT_CONDITIONS);
  const [sortBy, setSortBy] = useState<'change' | 'volume' | 'rsi'>('change');

  const { allStocks } = useStocks({ index: indexScope, priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'volume', 'desc');
  const { setSelectedStock, setChartSymbol, setActiveTab } = useDashboard();

  // Helper to toggle a single condition
  const toggleCondition = (key: keyof ConditionState) => {
    audioAlerts.playClickHaptic();
    setConditions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Preset conditions shortcuts
  const applyPreset = (preset: 'default' | 'breakout' | 'trend' | 'dip') => {
    audioAlerts.playClickHaptic();
    if (preset === 'default') {
      setConditions(DEFAULT_CONDITIONS);
    } else if (preset === 'breakout') {
      setConditions({
        emaCross: false,
        volSurge: true,
        rsiBull: true,
        dayHighBreak: true,
        macdBuy: false,
        rsiOversold: false,
      });
    } else if (preset === 'trend') {
      setConditions({
        emaCross: true,
        volSurge: false,
        rsiBull: true,
        dayHighBreak: false,
        macdBuy: true,
        rsiOversold: false,
      });
    } else if (preset === 'dip') {
      setConditions({
        emaCross: false,
        volSurge: false,
        rsiBull: false,
        dayHighBreak: false,
        macdBuy: false,
        rsiOversold: true,
      });
    }
  };

  // Live condition counts across current index universe
  const conditionMatchCounts = useMemo(() => {
    return {
      emaCross: allStocks.filter(s => !!s.emaCrossDaily).length,
      volSurge: allStocks.filter(s => (s.relativeVolume && s.relativeVolume >= 1.5) || s.volumeSpike).length,
      rsiBull: allStocks.filter(s => (s.rsiDaily || 50) >= 60).length,
      dayHighBreak: allStocks.filter(s => s.atDayHigh || (s.dayHigh > 0 && s.price >= s.dayHigh * 0.995)).length,
      macdBuy: allStocks.filter(s => !!s.macdWeeklyBuy).length,
      rsiOversold: allStocks.filter(s => s.rsiDaily !== undefined && s.rsiDaily <= 35).length,
    };
  }, [allStocks]);

  // Filter stocks that pass ALL enabled conditions
  const matchedStocks = useMemo(() => {
    const activeFilters = Object.entries(conditions).filter(([_, active]) => active);
    
    // If no condition is active, show all stocks sorted by volume
    if (activeFilters.length === 0) return allStocks;

    return allStocks.filter(stock => {
      if (conditions.emaCross && !stock.emaCrossDaily) return false;
      if (conditions.volSurge && !((stock.relativeVolume && stock.relativeVolume >= 1.5) || stock.volumeSpike)) return false;
      if (conditions.rsiBull && (stock.rsiDaily === undefined || stock.rsiDaily < 60)) return false;
      if (conditions.dayHighBreak && !(stock.atDayHigh || (stock.dayHigh > 0 && stock.price >= stock.dayHigh * 0.995))) return false;
      if (conditions.macdBuy && !stock.macdWeeklyBuy) return false;
      if (conditions.rsiOversold && (stock.rsiDaily === undefined || stock.rsiDaily > 35)) return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === 'volume') return b.volume - a.volume;
      if (sortBy === 'rsi') return (b.rsiDaily || 50) - (a.rsiDaily || 50);
      return b.changePercent - a.changePercent;
    });
  }, [allStocks, conditions, sortBy]);

  const activeCount = Object.values(conditions).filter(Boolean).length;
  const passPct = allStocks.length > 0 ? (matchedStocks.length / allStocks.length) * 100 : 0;

  const handleRowClick = (sym: string) => {
    audioAlerts.playClickHaptic();
    setSelectedStock(sym);
    setChartSymbol(sym);
    setActiveTab('Charts');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', minWidth: 0, paddingBottom: '50px' }}>
      
      {/* ── 1. Header & Live Telemetry Strip ── */}
      <div className="bento-widget-shell">
        <div className="bento-widget-core">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="bento-icon-box">
                <SlidersHorizontal size={18} strokeWidth={1.5} className="text-cyan-400" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="bento-card-title">Algorithmic Condition Engine</span>
                  <TelemetryPulse variant="live" size={5} />
                </div>
                <div className="bento-card-subtitle">
                  Build multi-factor quantitative filters from plain market conditions
                </div>
              </div>
            </div>

            {/* Scope Switcher: ALL | NIFTY 50 | NIFTY 500 */}
            <div className="bento-segment-control">
              <button 
                type="button" 
                className={`bento-seg-btn ${indexScope === 'ALL' ? 'active-bull' : ''}`}
                onClick={() => { audioAlerts.playClickHaptic(); setIndexScope('ALL'); }}
              >
                <span>ALL ({allStocks.length})</span>
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
          </div>

          {/* ── Condition Checklist Cards ── */}
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
              gap: 12, 
              marginTop: 18 
            }}
          >
            {/* Condition 1: EMA Cross */}
            <div 
              onClick={() => toggleCondition('emaCross')}
              className="stat-hardware-shell"
              style={{
                cursor: 'pointer',
                borderColor: conditions.emaCross ? 'rgba(40, 207, 255, 0.45)' : 'var(--border)',
                background: conditions.emaCross ? 'rgba(40, 207, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)'
              }}
            >
              <div className="stat-hardware-core" style={{ padding: '12px 14px', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {conditions.emaCross ? (
                      <CheckSquare size={16} className="text-cyan-400" />
                    ) : (
                      <Square size={16} className="text-slate-500" />
                    )}
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: conditions.emaCross ? '#fff' : 'var(--text-2)' }}>
                      Close crosses above EMA 20
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-[11px] text-cyan-400 font-bold">
                    {conditionMatchCounts.emaCross}
                  </span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                  Bullish moving average trendline breakthrough
                </div>
              </div>
            </div>

            {/* Condition 2: Volume Surge */}
            <div 
              onClick={() => toggleCondition('volSurge')}
              className="stat-hardware-shell"
              style={{
                cursor: 'pointer',
                borderColor: conditions.volSurge ? 'rgba(0, 214, 163, 0.45)' : 'var(--border)',
                background: conditions.volSurge ? 'rgba(0, 214, 163, 0.05)' : 'rgba(255, 255, 255, 0.02)'
              }}
            >
              <div className="stat-hardware-core" style={{ padding: '12px 14px', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {conditions.volSurge ? (
                      <CheckSquare size={16} className="text-emerald-400" />
                    ) : (
                      <Square size={16} className="text-slate-500" />
                    )}
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: conditions.volSurge ? '#fff' : 'var(--text-2)' }}>
                      Volume &gt; 1.5× 20-Day Avg
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-[11px] text-emerald-400 font-bold">
                    {conditionMatchCounts.volSurge}
                  </span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                  Substantial institutional liquidity surge
                </div>
              </div>
            </div>

            {/* Condition 3: RSI 14 above 60 */}
            <div 
              onClick={() => toggleCondition('rsiBull')}
              className="stat-hardware-shell"
              style={{
                cursor: 'pointer',
                borderColor: conditions.rsiBull ? 'rgba(129, 140, 248, 0.45)' : 'var(--border)',
                background: conditions.rsiBull ? 'rgba(129, 140, 248, 0.05)' : 'rgba(255, 255, 255, 0.02)'
              }}
            >
              <div className="stat-hardware-core" style={{ padding: '12px 14px', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {conditions.rsiBull ? (
                      <CheckSquare size={16} className="text-indigo-400" />
                    ) : (
                      <Square size={16} className="text-slate-500" />
                    )}
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: conditions.rsiBull ? '#fff' : 'var(--text-2)' }}>
                      RSI 14 above 60
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-[11px] text-indigo-400 font-bold">
                    {conditionMatchCounts.rsiBull}
                  </span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                  Strong expansion momentum zone
                </div>
              </div>
            </div>

            {/* Condition 4: Close at/near Day High */}
            <div 
              onClick={() => toggleCondition('dayHighBreak')}
              className="stat-hardware-shell"
              style={{
                cursor: 'pointer',
                borderColor: conditions.dayHighBreak ? 'rgba(212, 175, 55, 0.45)' : 'var(--border)',
                background: conditions.dayHighBreak ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 255, 255, 0.02)'
              }}
            >
              <div className="stat-hardware-core" style={{ padding: '12px 14px', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {conditions.dayHighBreak ? (
                      <CheckSquare size={16} className="text-amber-400" />
                    ) : (
                      <Square size={16} className="text-slate-500" />
                    )}
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: conditions.dayHighBreak ? '#fff' : 'var(--text-2)' }}>
                      Close at or near Day High
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-[11px] text-amber-400 font-bold">
                    {conditionMatchCounts.dayHighBreak}
                  </span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                  Breakout pressure within 0.5% of session peak
                </div>
              </div>
            </div>

            {/* Condition 5: MACD Weekly Buy */}
            <div 
              onClick={() => toggleCondition('macdBuy')}
              className="stat-hardware-shell"
              style={{
                cursor: 'pointer',
                borderColor: conditions.macdBuy ? 'rgba(0, 214, 163, 0.45)' : 'var(--border)',
                background: conditions.macdBuy ? 'rgba(0, 214, 163, 0.05)' : 'rgba(255, 255, 255, 0.02)'
              }}
            >
              <div className="stat-hardware-core" style={{ padding: '12px 14px', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {conditions.macdBuy ? (
                      <CheckSquare size={16} className="text-emerald-400" />
                    ) : (
                      <Square size={16} className="text-slate-500" />
                    )}
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: conditions.macdBuy ? '#fff' : 'var(--text-2)' }}>
                      MACD Weekly Buy Setup
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-[11px] text-emerald-400 font-bold">
                    {conditionMatchCounts.macdBuy}
                  </span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                  Higher timeframe multi-week momentum cross
                </div>
              </div>
            </div>

            {/* Condition 6: Oversold Pullback (RSI < 35) */}
            <div 
              onClick={() => toggleCondition('rsiOversold')}
              className="stat-hardware-shell"
              style={{
                cursor: 'pointer',
                borderColor: conditions.rsiOversold ? 'rgba(255, 66, 104, 0.45)' : 'var(--border)',
                background: conditions.rsiOversold ? 'rgba(255, 66, 104, 0.05)' : 'rgba(255, 255, 255, 0.02)'
              }}
            >
              <div className="stat-hardware-core" style={{ padding: '12px 14px', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {conditions.rsiOversold ? (
                      <CheckSquare size={16} className="text-rose-400" />
                    ) : (
                      <Square size={16} className="text-slate-500" />
                    )}
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: conditions.rsiOversold ? '#fff' : 'var(--text-2)' }}>
                      Oversold Dip (RSI &lt; 35)
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-[11px] text-rose-400 font-bold">
                    {conditionMatchCounts.rsiOversold}
                  </span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                  Mean-reversion bounce candidates
                </div>
              </div>
            </div>
          </div>

          {/* ── Preset Shortcuts & Status Banner ── */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              flexWrap: 'wrap', 
              gap: 12, 
              marginTop: 18, 
              paddingTop: 14, 
              borderTop: '1px solid var(--border)' 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Preset Matrices:
              </span>
              <button 
                type="button" 
                className="filter-pill"
                onClick={() => applyPreset('default')}
              >
                Standard Flow
              </button>
              <button 
                type="button" 
                className="filter-pill"
                onClick={() => applyPreset('breakout')}
              >
                Breakout Hunter
              </button>
              <button 
                type="button" 
                className="filter-pill"
                onClick={() => applyPreset('trend')}
              >
                Trend Following
              </button>
              <button 
                type="button" 
                className="filter-pill"
                onClick={() => applyPreset('dip')}
              >
                Oversold Dips
              </button>
            </div>

            {/* Live Match Counter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="font-mono tabular-nums" style={{ fontSize: 13, fontWeight: 800, color: 'var(--up)' }}>
                <AnimatedNumber value={matchedStocks.length} duration={0.5} /> of {allStocks.length} stocks pass
              </span>
              <span className="font-mono text-xs text-slate-400">
                ({passPct.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Real-time laser pass percentage progress bar */}
          <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${passPct}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: '100%', background: 'linear-gradient(90deg, var(--cyan) 0%, var(--up) 100%)' }}
            />
          </div>
        </div>
      </div>

      {/* ── 2. Filtered Screener Data Table ── */}
      <div className="bento-widget-shell">
        <div className="bento-widget-core p-0 overflow-hidden">
          <div className="table-header-strip">
            <div className="table-title-group">
              <div className="bento-icon-box">
                <Target size={17} strokeWidth={1.5} className="text-cyan-400" />
              </div>
              <div>
                <div className="table-title-main" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                  MATCHED SECURITIES TELEMETRY
                </div>
                <div className="table-subtitle-main">
                  Passing {activeCount} active quantitative conditions
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>SORT:</span>
              <button
                type="button"
                className={`bento-seg-btn ${sortBy === 'change' ? 'active-bull' : ''}`}
                onClick={() => { audioAlerts.playClickHaptic(); setSortBy('change'); }}
              >
                % Change
              </button>
              <button
                type="button"
                className={`bento-seg-btn ${sortBy === 'volume' ? 'active-bull' : ''}`}
                onClick={() => { audioAlerts.playClickHaptic(); setSortBy('volume'); }}
              >
                Volume
              </button>
              <button
                type="button"
                className={`bento-seg-btn ${sortBy === 'rsi' ? 'active-bull' : ''}`}
                onClick={() => { audioAlerts.playClickHaptic(); setSortBy('rsi'); }}
              >
                RSI
              </button>
            </div>
          </div>

          <div className="table-scroll-container">
            <table className="vanguard-data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Security Name</th>
                  <th className="num-col">LTP (₹)</th>
                  <th className="num-col">Net Chg</th>
                  <th className="num-col">Chg %</th>
                  <th className="num-col">Rel Vol</th>
                  <th className="num-col">RSI 14</th>
                  <th>Matched Rules</th>
                  <th style={{ textAlign: 'right' }}>Chart</th>
                </tr>
              </thead>
              <tbody>
                {matchedStocks.map(stock => {
                  const up = stock.change >= 0;
                  const isEma = !!stock.emaCrossDaily;
                  const isVol = (stock.relativeVolume && stock.relativeVolume >= 1.5) || stock.volumeSpike;
                  const isRsiBull = (stock.rsiDaily || 50) >= 60;
                  const isHigh = stock.atDayHigh || (stock.dayHigh > 0 && stock.price >= stock.dayHigh * 0.995);
                  const isMacd = !!stock.macdWeeklyBuy;
                  const isOversold = stock.rsiDaily !== undefined && stock.rsiDaily <= 35;

                  return (
                    <tr 
                      key={stock.symbol}
                      className="vanguard-table-row"
                      onClick={() => handleRowClick(stock.symbol)}
                    >
                      <td className="sym-cell">
                        <div className="sym-flex-wrap" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <StockLogo symbol={stock.symbol} name={stock.name} size={22} className="shrink-0" />
                          <span className="sym-ticker-text font-mono" style={{ fontWeight: 800 }}>{stock.symbol}</span>
                        </div>
                      </td>

                      <td className="company-cell" style={{ color: 'var(--text-2)' }}>{stock.name}</td>

                      <td className="num-col font-mono tabular-nums">
                        <LivePrice price={stock.price} decimals={2} />
                      </td>

                      <td className="num-col font-mono tabular-nums" style={{ color: up ? 'var(--up)' : 'var(--down)', fontWeight: 700 }}>
                        {up ? '+' : ''}{stock.change.toFixed(2)}
                      </td>

                      <td className="num-col">
                        <PriceChange change={stock.change} changePercent={stock.changePercent} />
                      </td>

                      <td className="num-col font-mono tabular-nums" style={{ color: isVol ? 'var(--up)' : 'var(--text-2)', fontWeight: 700 }}>
                        {stock.relativeVolume ? `${stock.relativeVolume.toFixed(1)}x` : '1.0x'}
                      </td>

                      <td className="num-col font-mono tabular-nums" style={{ 
                        color: isOversold ? 'var(--down)' : isRsiBull ? 'var(--up)' : 'var(--text-2)',
                        fontWeight: 700 
                      }}>
                        {stock.rsiDaily ? stock.rsiDaily.toFixed(1) : '50.0'}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          {isEma && (
                            <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: 'rgba(40, 207, 255, 0.12)', color: 'var(--cyan)', border: '1px solid rgba(40, 207, 255, 0.25)' }}>
                              EMA CROSS
                            </span>
                          )}
                          {isVol && (
                            <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: 'rgba(0, 214, 163, 0.12)', color: 'var(--up)', border: '1px solid rgba(0, 214, 163, 0.25)' }}>
                              VOL SURGE
                            </span>
                          )}
                          {isHigh && (
                            <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: 'rgba(212, 175, 55, 0.12)', color: 'var(--gold)', border: '1px solid rgba(212, 175, 55, 0.25)' }}>
                              DAY HIGH
                            </span>
                          )}
                          {isMacd && (
                            <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: 'rgba(0, 214, 163, 0.12)', color: 'var(--up)', border: '1px solid rgba(0, 214, 163, 0.25)' }}>
                              MACD BUY
                            </span>
                          )}
                          {isOversold && (
                            <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: 'rgba(255, 66, 104, 0.12)', color: 'var(--down)', border: '1px solid rgba(255, 66, 104, 0.25)' }}>
                              OVERSOLD
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--cyan)', cursor: 'pointer' }}>
                          Open <ExternalLink size={11} />
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {matchedStocks.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <SlidersHorizontal size={28} className="text-slate-600" />
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>No stocks match all active conditions</span>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Try relaxing one or more filter rules to broaden the scan.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
