import React, {
  useEffect, useState, useCallback, useMemo,
} from 'react';
import type { StockData } from '../../types';
import { useStocks } from '../../hooks/useStocks';
import { useWatchlist } from '../../hooks/useWatchlist';
import { useDashboard } from '../../contexts/DashboardContext';
import { formatPrice } from '../../utils/formatters';
import {
  ChartPane,
  ChartSlot,
  Timeframe,
  Range,
  Candle,
} from './ChartPane';
import { PineStudio } from './PineStudio';
import type { PineExecutionResult } from '../../utils/pineRunner';
import { StockLogo } from '../common/StockLogo';
import { isMarketOpen } from '../../utils/marketHours';

export type LayoutMode = '1' | '2-vert' | '2-horiz' | '4-grid';

interface ChartViewProps {
  allStocks?: StockData[];
}

export function ChartView({ allStocks: propStocks }: ChartViewProps) {
  const { allStocks: hookStocks, priceFlash } = useStocks(
    { index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' },
    'volume',
    'desc'
  );
  const liveStocks = (propStocks && propStocks.length > 0) ? propStocks : hookStocks;

  const { selectedStock, setSelectedStock, chartSymbol, setChartSymbol } = useDashboard();
  const { isWatchlisted, toggle: toggleWatchlist } = useWatchlist();

  // Multi-chart Layout & Slots State
  const [layout, setLayout] = useState<LayoutMode>('1');
  const [activeSlotIdx, setActiveSlotIdx] = useState<number>(0);

  const [slots, setSlots] = useState<ChartSlot[]>([
    { id: 'slot-1', symbol: chartSymbol || 'RELIANCE', timeframe: '1D', range: '1Y' },
    { id: 'slot-2', symbol: 'TCS',                   timeframe: '1D', range: '1Y' },
    { id: 'slot-3', symbol: 'HDFCBANK',              timeframe: '1D', range: '1Y' },
    { id: 'slot-4', symbol: 'INFY',                  timeframe: '1D', range: '1Y' },
  ]);

  const [watchFilter, setWatchFilter]   = useState<'all' | 'nifty50' | 'starred' | 'gainers' | 'losers'>('all');
  const [searchQ, setSearchQ]           = useState('');
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const [watchSearch, setWatchSearch]   = useState('');
  const [activeTool, setActiveTool]     = useState<string>('crosshair');

  // Pine Script Studio & Strategy State
  const [isPineStudioOpen, setIsPineStudioOpen] = useState(false);
  const [activeCandles, setActiveCandles]       = useState<Candle[]>([]);
  const [pineResult, setPineResult]             = useState<PineExecutionResult | null>(null);

  // Sync external chartSymbol into active slot
  useEffect(() => {
    const target = chartSymbol || selectedStock;
    if (target) {
      const clean = target.toUpperCase();
      setSlots(prev => {
        const next = [...prev];
        if (next[activeSlotIdx] && next[activeSlotIdx].symbol !== clean) {
          next[activeSlotIdx] = { ...next[activeSlotIdx], symbol: clean };
        }
        return next;
      });
    }
    if (selectedStock) {
      setSelectedStock(null);
    }
  }, [chartSymbol, selectedStock]);

  const handleUpdateSlot = (idx: number, updated: Partial<ChartSlot>) => {
    setSlots(prev => {
      const next = [...prev];
      if (next[idx]) {
        next[idx] = { ...next[idx], ...updated };
      }
      return next;
    });
  };

  // Selecting a symbol loads it directly into the currently focused chart slot
  const handleSelectSymbol = (sym: string) => {
    const cleanSym = sym.replace('.NS', '').toUpperCase();
    handleUpdateSlot(activeSlotIdx, { symbol: cleanSym });
    setChartSymbol(cleanSym);
    setSelectedStock(null);
    setShowSearchDrop(false);
    setSearchQ('');
  };

  // Top search results
  const searchResults = useMemo(() => {
    if (!searchQ.trim()) return [];
    const q = searchQ.toUpperCase();
    return liveStocks
      .filter(s => s.symbol.includes(q) || s.name.toUpperCase().includes(q))
      .slice(0, 10);
  }, [searchQ, liveStocks]);

  // Market watch filtering
  const filteredWatchlist = useMemo(() => {
    let list = [...liveStocks];

    if (watchFilter === 'nifty50') {
      list = list.filter(s => s.indexName === 'NIFTY50');
    } else if (watchFilter === 'starred') {
      list = list.filter(s => isWatchlisted(s.symbol));
    } else if (watchFilter === 'gainers') {
      list = list.filter(s => s.change > 0).sort((a, b) => b.changePercent - a.changePercent);
    } else if (watchFilter === 'losers') {
      list = list.filter(s => s.change < 0).sort((a, b) => a.changePercent - b.changePercent);
    }

    if (watchSearch.trim()) {
      const q = watchSearch.toUpperCase();
      list = list.filter(s => s.symbol.includes(q) || s.name.toUpperCase().includes(q));
    }

    return list;
  }, [liveStocks, watchFilter, watchSearch, isWatchlisted]);

  const activeSlot = slots[activeSlotIdx] || slots[0];

  return (
    <div style={styles.root}>
      {/* ── TOP ACTION BAR ───────────────────────────────────────── */}
      <div style={styles.topBar}>
        {/* Symbol Search (Loads into active chart) */}
        <div style={styles.symbolArea}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder={`Search stock for Chart ${activeSlotIdx + 1}…`}
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setShowSearchDrop(true); }}
              onFocus={() => setShowSearchDrop(true)}
              style={styles.searchInput}
            />
            {showSearchDrop && searchResults.length > 0 && (
              <div style={styles.dropdown}>
                {searchResults.map(s => (
                  <div
                    key={s.symbol}
                    style={styles.dropItem}
                    onMouseDown={() => handleSelectSymbol(s.symbol)}
                  >
                    <StockLogo symbol={s.symbol} name={s.name} size={20} style={{ marginRight: 8, flexShrink: 0 }} />
                    <span style={styles.dropTicker}>{s.symbol}</span>
                    <span style={styles.dropName}>{s.name}</span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: s.change >= 0 ? '#089981' : '#f23645',
                    }}>
                      {formatPrice(s.price)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <span style={{ fontSize: 11, color: '#8b949e', display: 'flex', alignItems: 'center', gap: 4 }}>
            Active: <b style={{ color: '#58a6ff' }}>{activeSlot.symbol}</b>
          </span>
        </div>

        {/* Layout Mode Selector */}
        <div style={styles.layoutBar}>
          <span style={{ fontSize: 10.5, color: '#8b949e', fontWeight: 600, marginRight: 2 }}>LAYOUT:</span>
          <button
            title="Single Chart View"
            style={{ ...styles.layoutBtn, ...(layout === '1' ? styles.layoutBtnActive : {}) }}
            onClick={() => setLayout('1')}
          >
            [ 1 ]
          </button>
          <button
            title="2 Charts Split Vertically (Side by Side)"
            style={{ ...styles.layoutBtn, ...(layout === '2-vert' ? styles.layoutBtnActive : {}) }}
            onClick={() => setLayout('2-vert')}
          >
            [ 2 ◫ ]
          </button>
          <button
            title="2 Charts Split Horizontally (Stacked)"
            style={{ ...styles.layoutBtn, ...(layout === '2-horiz' ? styles.layoutBtnActive : {}) }}
            onClick={() => setLayout('2-horiz')}
          >
            [ 2 ☵ ]
          </button>
          <button
            title="4 Charts 2x2 Grid"
            style={{ ...styles.layoutBtn, ...(layout === '4-grid' ? styles.layoutBtnActive : {}) }}
            onClick={() => setLayout('4-grid')}
          >
            [ 4 ⊞ ]
          </button>

          {/* Pine Script Studio Toggle Button */}
          <button
            title="Pine Script Studio (Indicators & Strategies)"
            style={{
              ...styles.layoutBtn,
              ...(isPineStudioOpen ? styles.layoutBtnActive : {}),
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              marginLeft: 8,
              color: isPineStudioOpen ? '#10b981' : '#c9d1d9',
              borderColor: isPineStudioOpen ? '#10b981' : undefined,
              background: isPineStudioOpen ? 'rgba(16, 185, 129, 0.12)' : undefined,
            }}
            onClick={() => setIsPineStudioOpen(prev => !prev)}
          >
            <span>🌲</span>
            <span style={{ fontSize: 11, fontWeight: 700 }}>Pine Script</span>
            {pineResult && (pineResult.plots.length > 0 || pineResult.markers.length > 0) && (
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 6px #10b981',
              }} />
            )}
          </button>
        </div>

        {/* Live Active Status Indicator */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {isMarketOpen() ? (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#089981',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 9px',
              borderRadius: 12,
              background: 'rgba(8, 153, 129, 0.12)',
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#089981',
                boxShadow: '0 0 8px #089981',
                display: 'inline-block',
              }} />
              LIVE MARKET STREAM
            </span>
          ) : (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#8b949e',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 9px',
              borderRadius: 12,
              background: 'rgba(139, 148, 158, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#8b949e',
                display: 'inline-block',
              }} />
              MARKET CLOSED (EOD SETTLED)
            </span>
          )}
        </div>
      </div>

      {/* ── MAIN WORKSPACE ────────────────────────────────────────── */}
      <div style={styles.mainLayout}>
        {/* Left Drawing Toolbar */}
        <div style={styles.leftBar}>
          {[
            { id: 'crosshair', icon: '⊕', label: 'Crosshair' },
            { id: 'trend', icon: '↗', label: 'Trend Line' },
            { id: 'hline', icon: '—', label: 'Horizontal Line' },
            { id: 'vline', icon: '↕', label: 'Vertical Line' },
            { id: 'fib', icon: '◇', label: 'Fibonacci Retracement' },
            { id: 'rect', icon: '□', label: 'Rectangle Zone' },
            { id: 'text', icon: 'T', label: 'Text Annotation' },
            { id: 'zoom', icon: '🔍', label: 'Zoom Area' },
          ].map(tool => (
            <button
              key={tool.id}
              title={tool.label}
              style={{
                ...styles.toolBtn,
                ...(activeTool === tool.id ? styles.toolBtnActive : {}),
              }}
              onClick={() => setActiveTool(tool.id)}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        {/* Multi-Chart Grid Viewport */}
        <div style={styles.chartWrapper}>
          {/* Charts Area */}
          <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
            {/* Layout: Single Chart */}
            {layout === '1' && (
              <div style={{ flex: 1, width: '100%', height: '100%', minHeight: 0 }}>
                <ChartPane
                  slot={slots[activeSlotIdx] || slots[0]}
                  isActive={true}
                  isMultiView={false}
                  onFocus={() => setActiveSlotIdx(activeSlotIdx)}
                  onUpdateSlot={up => handleUpdateSlot(activeSlotIdx, up)}
                  liveStocks={liveStocks}
                  pineResult={pineResult}
                  onCandlesReady={setActiveCandles}
                />
              </div>
            )}

            {/* Layout: 2 Charts Split Vertically (Side by Side) */}
            {layout === '2-vert' && (
              <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 4,
                padding: 4,
                height: '100%',
                minHeight: 0,
                boxSizing: 'border-box',
              }}>
                {[0, 1].map(idx => (
                  <ChartPane
                    key={slots[idx].id}
                    slot={slots[idx]}
                    isActive={activeSlotIdx === idx}
                    isMultiView={true}
                    onFocus={() => setActiveSlotIdx(idx)}
                    onUpdateSlot={up => handleUpdateSlot(idx, up)}
                    liveStocks={liveStocks}
                    pineResult={activeSlotIdx === idx ? pineResult : null}
                    onCandlesReady={activeSlotIdx === idx ? setActiveCandles : undefined}
                  />
                ))}
              </div>
            )}

            {/* Layout: 2 Charts Split Horizontally (Stacked) */}
            {layout === '2-horiz' && (
              <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateRows: '1fr 1fr',
                gap: 4,
                padding: 4,
                height: '100%',
                minHeight: 0,
                boxSizing: 'border-box',
              }}>
                {[0, 1].map(idx => (
                  <ChartPane
                    key={slots[idx].id}
                    slot={slots[idx]}
                    isActive={activeSlotIdx === idx}
                    isMultiView={true}
                    onFocus={() => setActiveSlotIdx(idx)}
                    onUpdateSlot={up => handleUpdateSlot(idx, up)}
                    liveStocks={liveStocks}
                    pineResult={activeSlotIdx === idx ? pineResult : null}
                    onCandlesReady={activeSlotIdx === idx ? setActiveCandles : undefined}
                  />
                ))}
              </div>
            )}

            {/* Layout: 4 Charts 2x2 Grid */}
            {layout === '4-grid' && (
              <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: '1fr 1fr',
                gap: 4,
                padding: 4,
                height: '100%',
                minHeight: 0,
                boxSizing: 'border-box',
              }}>
                {[0, 1, 2, 3].map(idx => (
                  <ChartPane
                    key={slots[idx].id}
                    slot={slots[idx]}
                    isActive={activeSlotIdx === idx}
                    isMultiView={true}
                    onFocus={() => setActiveSlotIdx(idx)}
                    onUpdateSlot={up => handleUpdateSlot(idx, up)}
                    liveStocks={liveStocks}
                    pineResult={activeSlotIdx === idx ? pineResult : null}
                    onCandlesReady={activeSlotIdx === idx ? setActiveCandles : undefined}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pine Script Studio Drawer */}
          {isPineStudioOpen && (
            <PineStudio
              candles={activeCandles}
              activeSymbol={slots[activeSlotIdx]?.symbol || 'RELIANCE'}
              activeTimeframe={slots[activeSlotIdx]?.timeframe || '1D'}
              onApplyResult={setPineResult}
              onClose={() => setIsPineStudioOpen(false)}
            />
          )}
        </div>

        {/* ── RIGHT LIVE WATCHLIST PANEL ──────────────────────── */}
        <div style={styles.watchPanel}>
          <div style={styles.watchHeader}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#c9d1d9', letterSpacing: 0.5 }}>
                MARKET WATCH ({filteredWatchlist.length})
              </span>
              <span style={{ fontSize: 10, color: '#089981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#089981', display: 'inline-block' }} />
                LIVE
              </span>
            </div>

            {/* Quick Watchlist Filter Tabs */}
            <div style={styles.watchTabsRow}>
              <button
                style={{ ...styles.watchTabBtn, ...(watchFilter === 'all' ? styles.watchTabActive : {}) }}
                onClick={() => setWatchFilter('all')}
              >
                All
              </button>
              <button
                style={{ ...styles.watchTabBtn, ...(watchFilter === 'nifty50' ? styles.watchTabActive : {}) }}
                onClick={() => setWatchFilter('nifty50')}
              >
                Nifty 50
              </button>
              <button
                style={{ ...styles.watchTabBtn, ...(watchFilter === 'starred' ? styles.watchTabActive : {}) }}
                onClick={() => setWatchFilter('starred')}
              >
                ⭐ Watchlist
              </button>
              <button
                style={{ ...styles.watchTabBtn, ...(watchFilter === 'gainers' ? styles.watchTabActive : {}) }}
                onClick={() => setWatchFilter('gainers')}
              >
                ▲ Gainers
              </button>
              <button
                style={{ ...styles.watchTabBtn, ...(watchFilter === 'losers' ? styles.watchTabActive : {}) }}
                onClick={() => setWatchFilter('losers')}
              >
                ▼ Losers
              </button>
            </div>

            <input
              type="text"
              placeholder="Filter 500+ NSE stocks..."
              value={watchSearch}
              onChange={e => setWatchSearch(e.target.value)}
              style={styles.watchSearchInput}
            />
          </div>

          <div style={styles.watchColRow}>
            <span style={{ flex: 1.5 }}>SYMBOL</span>
            <span style={{ flex: 1, textAlign: 'right' }}>LTP (₹)</span>
            <span style={{ flex: 1, textAlign: 'right' }}>CHG %</span>
          </div>

          <div style={styles.watchBody}>
            {filteredWatchlist.map(s => {
              const isSelected = s.symbol.toUpperCase() === activeSlot.symbol.toUpperCase();
              const isUp = s.change >= 0;
              const starred = isWatchlisted(s.symbol);
              const flash = priceFlash.get(s.symbol);

              return (
                <div
                  key={s.symbol}
                  style={{
                    ...styles.watchItem,
                    ...(isSelected ? styles.watchItemActive : {}),
                    backgroundColor: flash === 'up'
                      ? 'rgba(8,153,129,0.2)'
                      : flash === 'down'
                      ? 'rgba(242,54,69,0.2)'
                      : isSelected
                      ? 'rgba(31,111,235,0.14)'
                      : 'transparent',
                  }}
                  onClick={() => handleSelectSymbol(s.symbol)}
                  title={`Click to load ${s.symbol} into Chart ${activeSlotIdx + 1}`}
                >
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWatchlist(s.symbol);
                    }}
                    style={{
                      cursor: 'pointer',
                      color: starred ? '#f59e0b' : '#484f58',
                      fontSize: 14,
                      marginRight: 6,
                      userSelect: 'none',
                    }}
                    title={starred ? 'Remove from Watchlist' : 'Add to Watchlist'}
                  >
                    {starred ? '★' : '☆'}
                  </span>

                  <StockLogo symbol={s.symbol} name={s.name} size={24} style={{ marginRight: 8, flexShrink: 0 }} />

                  <div style={{ flex: 1.5, minWidth: 0, overflow: 'hidden' }}>
                    <div style={styles.watchTicker}>{s.symbol}</div>
                    <div style={styles.watchName}>{s.name}</div>
                  </div>

                  <div style={{
                    flex: 1,
                    textAlign: 'right',
                    fontWeight: 600,
                    fontSize: 12,
                    color: isUp ? '#089981' : '#f23645',
                  }}>
                    {formatPrice(s.price)}
                  </div>

                  <div style={{
                    flex: 1,
                    textAlign: 'right',
                    fontWeight: 700,
                    fontSize: 11.5,
                    color: isUp ? '#089981' : '#f23645',
                  }}>
                    {isUp ? '+' : ''}{s.changePercent.toFixed(2)}%
                  </div>
                </div>
              );
            })}

            {filteredWatchlist.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#58636d', fontSize: 12 }}>
                {watchFilter === 'starred'
                  ? 'No stocks in Watchlist. Click ☆ to star stocks.'
                  : 'No matching stocks found.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 60px)',
    background: '#0d1117',
    overflow: 'hidden',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0 16px',
    height: 48,
    flexShrink: 0,
    background: '#161b22',
    borderBottom: '1px solid #21262d',
  },
  symbolArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    paddingRight: 14,
    borderRight: '1px solid #21262d',
  },
  searchInput: {
    background: '#21262d',
    border: '1px solid #30363d',
    borderRadius: 6,
    color: '#c9d1d9',
    fontSize: 12,
    padding: '6px 12px',
    outline: 'none',
    width: 220,
  },
  dropdown: {
    position: 'absolute',
    top: '115%',
    left: 0,
    width: 320,
    maxHeight: 340,
    overflowY: 'auto',
    zIndex: 9999,
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 8,
    boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
  },
  dropItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid #21262d',
  },
  dropTicker: { fontWeight: 700, color: '#fff', fontSize: 13, minWidth: 85 },
  dropName: { flex: 1, color: '#8b949e', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  layoutBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 4,
  },
  layoutBtn: {
    background: '#21262d',
    border: '1px solid #30363d',
    color: '#8b949e',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 600,
    transition: 'all 0.15s ease',
  },
  layoutBtnActive: {
    background: 'rgba(31,111,235,0.25)',
    borderColor: '#1f6feb',
    color: '#58a6ff',
  },
  mainLayout: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    minHeight: 0,
  },
  leftBar: {
    width: 44,
    background: '#161b22',
    borderRight: '1px solid #21262d',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 0',
    gap: 4,
    flexShrink: 0,
  },
  toolBtn: {
    width: 32,
    height: 32,
    background: 'none',
    border: 'none',
    color: '#8b949e',
    cursor: 'pointer',
    borderRadius: 5,
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  toolBtnActive: {
    background: 'rgba(31,111,235,0.2)',
    color: '#58a6ff',
  },
  chartWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
    background: '#0d1117',
    position: 'relative',
  },
  watchPanel: {
    width: 290,
    background: '#161b22',
    borderLeft: '1px solid #21262d',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  watchHeader: {
    padding: '10px 10px 8px',
    borderBottom: '1px solid #21262d',
  },
  watchTabsRow: {
    display: 'flex',
    gap: 4,
    overflowX: 'auto',
    marginBottom: 8,
  },
  watchTabBtn: {
    background: 'none',
    border: 'none',
    color: '#8b949e',
    fontSize: 10.5,
    fontWeight: 600,
    padding: '3px 6px',
    borderRadius: 4,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  watchTabActive: {
    background: '#21262d',
    color: '#58a6ff',
  },
  watchSearchInput: {
    width: '100%',
    boxSizing: 'border-box',
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: 5,
    color: '#c9d1d9',
    fontSize: 11,
    padding: '5px 8px',
    outline: 'none',
  },
  watchColRow: {
    display: 'flex',
    padding: '5px 12px',
    fontSize: 10,
    color: '#58636d',
    fontWeight: 600,
    letterSpacing: 0.5,
    borderBottom: '1px solid #21262d',
    textTransform: 'uppercase',
  },
  watchBody: {
    flex: 1,
    overflowY: 'auto',
  },
  watchItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '7px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(33,38,45,0.6)',
    transition: 'background-color 0.15s ease',
  },
  watchItemActive: {
    borderLeft: '3px solid #1f6feb',
  },
  watchTicker: {
    fontSize: 12,
    fontWeight: 700,
    color: '#c9d1d9',
    lineHeight: 1.2,
  },
  watchName: {
    fontSize: 9.5,
    color: '#58636d',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 100,
  },
};
