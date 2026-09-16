import React, {
  useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import {
  createChart,
  CrosshairMode,
  LineStyle,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  LineData,
} from 'lightweight-charts';
import type { StockData } from '../../types';
import { useStocks } from '../../hooks/useStocks';
import { useWatchlist } from '../../hooks/useWatchlist';
import { useDashboard } from '../../contexts/DashboardContext';
import { formatPrice, formatVolume } from '../../utils/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartViewProps {
  allStocks?: StockData[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_SOCKET_URL || window.location.origin);
const SERVER = `${API_BASE}/api/stocks`;

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1D', '1W', '1M'] as const;
type Timeframe = typeof TIMEFRAMES[number];

const TV_INTERVAL_MAP: Record<Timeframe, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '1D': 'D',
  '1W': 'W',
  '1M': 'M',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, dec = 2): string {
  if (v == null || isNaN(v)) return '—';
  return v.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function calcEMA(data: Candle[], period: number): LineData[] {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
  const out: LineData[] = [{ time: data[period - 1].time as any, value: +ema.toFixed(2) }];
  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    out.push({ time: data[i].time as any, value: +ema.toFixed(2) });
  }
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChartView({ allStocks: propStocks }: ChartViewProps) {
  // Live stock data from hook if not passed from parent
  const { allStocks: hookStocks, priceFlash } = useStocks(
    { index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' },
    'volume',
    'desc'
  );
  const liveStocks = (propStocks && propStocks.length > 0) ? propStocks : hookStocks;

  const { selectedStock, setSelectedStock } = useDashboard();
  const { isWatchlisted, toggle: toggleWatchlist } = useWatchlist();

  // Selected symbol (default to selectedStock from dashboard or RELIANCE)
  const [currentSymbol, setCurrentSymbol] = useState<string>(() => {
    return selectedStock || 'RELIANCE';
  });

  const [tf, setTf] = useState<Timeframe>('1D');
  const [chartMode, setChartMode] = useState<'tradingview' | 'lightweight'>('tradingview');
  const [watchFilter, setWatchFilter] = useState<'all' | 'nifty50' | 'starred' | 'gainers' | 'losers'>('all');
  const [searchQ, setSearchQ] = useState('');
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const [watchSearch, setWatchSearch] = useState('');

  // Lightweight chart state
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const candleRef    = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef    = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema13Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const ema34Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200Ref    = useRef<ISeriesApi<'Line'> | null>(null);

  const [loading, setLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [activeInds, setActiveInds] = useState(new Set(['ema13', 'ema34', 'ema50', 'ema200']));

  // Sync with global selectedStock when it changes outside
  useEffect(() => {
    if (selectedStock && selectedStock !== currentSymbol) {
      setCurrentSymbol(selectedStock);
    }
  }, [selectedStock]);

  // Current selected stock object from live data
  const currentStockData = useMemo(() => {
    return liveStocks.find(s => s.symbol.toUpperCase() === currentSymbol.toUpperCase()) || {
      symbol: currentSymbol,
      name: currentSymbol,
      price: 0,
      open: 0,
      dayHigh: 0,
      dayLow: 0,
      previousClose: 0,
      change: 0,
      changePercent: 0,
      volume: 0,
      sector: 'NSE Equity',
      fiftyTwoWeekHigh: 0,
      fiftyTwoWeekLow: 0,
    } as StockData;
  }, [liveStocks, currentSymbol]);

  // Filtered stocks for the right-hand Watchlist panel
  const filteredWatchlist = useMemo(() => {
    let list = [...liveStocks];

    if (watchFilter === 'nifty50') {
      list = list.filter(s => s.indexName === 'NIFTY50');
    } else if (watchFilter === 'starred') {
      list = list.filter(s => isWatchlisted(s.symbol));
    } else if (watchFilter === 'gainers') {
      list = list.filter(s => s.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent);
    } else if (watchFilter === 'losers') {
      list = list.filter(s => s.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent);
    }

    if (watchSearch.trim()) {
      const q = watchSearch.trim().toUpperCase();
      list = list.filter(s => s.symbol.toUpperCase().includes(q) || s.name.toUpperCase().includes(q));
    }

    return list;
  }, [liveStocks, watchFilter, isWatchlisted, watchSearch]);

  // Quick search autocomplete options
  const searchResults = useMemo(() => {
    if (!searchQ.trim()) return [];
    const q = searchQ.trim().toUpperCase();
    return liveStocks.filter(s => s.symbol.toUpperCase().includes(q) || s.name.toUpperCase().includes(q)).slice(0, 10);
  }, [liveStocks, searchQ]);

  // ── Lightweight Chart Setup ──────────────────────────────────────
  const applyData = useCallback((data: Candle[], inds: Set<string>) => {
    if (!candleRef.current) return;
    const sorted = [...data].sort((a, b) => a.time - b.time);

    candleRef.current.setData(
      sorted.map(d => ({ time: d.time as any, open: d.open, high: d.high, low: d.low, close: d.close }))
    );
    volumeRef.current?.setData(
      sorted.map(d => ({
        time: d.time as any, value: d.volume,
        color: d.close >= d.open ? 'rgba(38,166,154,0.45)' : 'rgba(239,83,80,0.45)',
      }))
    );

    const setEma = (ref: React.MutableRefObject<ISeriesApi<'Line'> | null>, key: string, period: number) => {
      ref.current?.setData(inds.has(key) ? calcEMA(sorted, period) : []);
    };
    setEma(ema13Ref,  'ema13',  13);
    setEma(ema34Ref,  'ema34',  34);
    setEma(ema50Ref,  'ema50',  50);
    setEma(ema200Ref, 'ema200', 200);

    chartRef.current?.timeScale().fitContent();
  }, []);

  const loadLightweightChart = useCallback(async (sym: string, timeframe: string) => {
    setLoading(true);
    setChartError(null);
    try {
      const res = await fetch(`${SERVER}/chart/${sym.replace('.NS', '')}?tf=${timeframe}`);
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Backend chart API unavailable');
      }
      const json = await res.json();
      if (!json.candles || json.candles.length === 0) {
        throw new Error('No candlestick data returned');
      }
      setCandles(json.candles);
      applyData(json.candles, activeInds);
    } catch (e: any) {
      console.warn('[ChartView] Lightweight chart fetch failed, falling back to TradingView:', e.message);
      setChartError(e.message);
      setChartMode('tradingview');
    } finally {
      setLoading(false);
    }
  }, [applyData, activeInds]);

  // Init Lightweight chart canvas if mode is lightweight
  useEffect(() => {
    if (chartMode !== 'lightweight' || !containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0d1117' },
        textColor: '#d1d4dc',
        fontSize: 11,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: '#161b22' },
        horzLines: { color: '#161b22' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#58636d', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#21262d' },
        horzLine: { color: '#58636d', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#21262d' },
      },
      rightPriceScale: {
        borderColor: '#21262d',
        scaleMargins: { top: 0.06, bottom: 0.28 },
      },
      timeScale: {
        borderColor: '#21262d',
        timeVisible: true,
        secondsVisible: false,
      },
      width:  containerRef.current.offsetWidth,
      height: containerRef.current.offsetHeight,
    });

    candleRef.current = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350',
      borderUpColor: '#26a69a', borderDownColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });

    volumeRef.current = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    const lineOpts = (color: string, width: 1 | 2 | 3 | 4) => ({
      color, lineWidth: width,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    ema13Ref.current  = chart.addLineSeries(lineOpts('#f59e0b', 1));
    ema34Ref.current  = chart.addLineSeries(lineOpts('#3b82f6', 1));
    ema50Ref.current  = chart.addLineSeries(lineOpts('#22c55e', 2));
    ema200Ref.current = chart.addLineSeries(lineOpts('#ef4444', 2));

    const ro = new ResizeObserver(() => {
      if (containerRef.current)
        chart.resize(containerRef.current.offsetWidth, containerRef.current.offsetHeight);
    });
    ro.observe(containerRef.current);
    chartRef.current = chart;

    loadLightweightChart(currentSymbol, tf);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [chartMode, currentSymbol, tf, loadLightweightChart]);

  // Handle symbol selection
  const handleSelectSymbol = (sym: string) => {
    const cleanSym = sym.replace('.NS', '').toUpperCase();
    setCurrentSymbol(cleanSym);
    setSelectedStock(cleanSym);
    setShowSearchDrop(false);
    setSearchQ('');
    if (chartMode === 'lightweight') {
      loadLightweightChart(cleanSym, tf);
    }
  };

  const isUp = currentStockData.change >= 0;

  return (
    <div style={styles.root}>
      {/* ── TOP ACTION BAR ───────────────────────────────────────── */}
      <div style={styles.topBar}>
        {/* Symbol search & quick badge */}
        <div style={styles.symbolArea}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search 500+ NSE stocks..."
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
                    <span style={styles.dropTicker}>{s.symbol}</span>
                    <span style={styles.dropName}>{s.name}</span>
                    <span style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontWeight: 600,
                      color: s.change >= 0 ? '#26a69a' : '#ef5350',
                      marginLeft: 'auto'
                    }}>
                      ₹{s.price.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={styles.symLabel}>{currentStockData.symbol}</span>
            <span style={styles.badge}>NSE</span>
            <span style={styles.badge}>{tf}</span>
          </div>
        </div>

        {/* Live OHLC & Metrics Bar */}
        <div style={styles.metricsBar}>
          <span style={styles.metricItem}>
            LTP: <b style={{ color: isUp ? '#26a69a' : '#ef5350', fontFamily: 'var(--font-mono, monospace)' }}>
              ₹{currentStockData.price > 0 ? currentStockData.price.toFixed(2) : '—'}
            </b>
            <span style={{ color: isUp ? '#26a69a' : '#ef5350', marginLeft: 4, fontWeight: 600 }}>
              ({isUp ? '+' : ''}{currentStockData.changePercent.toFixed(2)}%)
            </span>
          </span>
          <span style={styles.metricItem}>O: <b>{currentStockData.open > 0 ? currentStockData.open.toFixed(2) : '—'}</b></span>
          <span style={styles.metricItem}>H: <b style={{ color: '#26a69a' }}>{currentStockData.dayHigh > 0 ? currentStockData.dayHigh.toFixed(2) : '—'}</b></span>
          <span style={styles.metricItem}>L: <b style={{ color: '#ef5350' }}>{currentStockData.dayLow > 0 ? currentStockData.dayLow.toFixed(2) : '—'}</b></span>
          <span style={styles.metricItem}>Vol: <b>{formatVolume(currentStockData.volume)}</b></span>
          {currentStockData.sector && (
            <span style={{ ...styles.badge, background: 'rgba(218, 127, 99, 0.15)', color: '#da7f63' }}>
              {currentStockData.sector}
            </span>
          )}
        </div>

        {/* Timeframe Buttons */}
        <div style={styles.tfArea}>
          {TIMEFRAMES.map(t => (
            <button
              key={t}
              style={{ ...styles.tfBtn, ...(tf === t ? styles.tfBtnActive : {}) }}
              onClick={() => setTf(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Chart Engine Switcher */}
        <div style={styles.actionsArea}>
          <button
            style={{
              ...styles.actionBtn,
              background: chartMode === 'tradingview' ? 'rgba(38,166,154,0.18)' : '#21262d',
              color: chartMode === 'tradingview' ? '#26a69a' : '#c9d1d9',
              border: `1px solid ${chartMode === 'tradingview' ? 'rgba(38,166,154,0.4)' : '#30363d'}`,
              fontWeight: chartMode === 'tradingview' ? 700 : 500,
            }}
            onClick={() => setChartMode('tradingview')}
          >
            ⚡ TradingView
          </button>
          <button
            style={{
              ...styles.actionBtn,
              background: chartMode === 'lightweight' ? 'rgba(31,111,235,0.18)' : '#21262d',
              color: chartMode === 'lightweight' ? '#58a6ff' : '#c9d1d9',
              border: `1px solid ${chartMode === 'lightweight' ? 'rgba(31,111,235,0.4)' : '#30363d'}`,
              fontWeight: chartMode === 'lightweight' ? 700 : 500,
            }}
            onClick={() => setChartMode('lightweight')}
          >
            📊 Terminal
          </button>
        </div>
      </div>

      {/* ── MAIN LAYOUT ────────────────────────────────────────── */}
      <div style={styles.mainLayout}>
        {/* Chart Area */}
        <div style={styles.chartWrapper}>
          {chartMode === 'tradingview' ? (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <iframe
                key={`${currentSymbol}-${tf}`}
                src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=NSE%3A${encodeURIComponent(currentSymbol)}&interval=${TV_INTERVAL_MAP[tf] || 'D'}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=161b22&theme=dark&style=1&timezone=Asia%2FKolkata&withdateranges=1&showpopupbutton=1&locale=en`}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: 'block',
                  background: '#0d1117',
                }}
                title={`${currentSymbol} TradingView Chart`}
                allow="fullscreen"
              />
            </div>
          ) : (
            <div style={styles.chartArea}>
              <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
              {loading && (
                <div style={styles.loadingOverlay}>
                  <div style={styles.spinner} />
                  <span style={{ color: '#8b949e', fontSize: 13 }}>Loading candlestick data…</span>
                </div>
              )}
              {chartError && (
                <div style={styles.errorBanner}>
                  <span>⚠️ {chartError}. Switched to TradingView feed.</span>
                  <button onClick={() => setChartMode('tradingview')} style={styles.switchBtn}>
                    Switch to TradingView
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT LIVE WATCHLIST PANEL ──────────────────────── */}
        <div style={styles.watchPanel}>
          {/* Header & Watchlist Tabs */}
          <div style={styles.watchHeader}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#c9d1d9', letterSpacing: 0.5 }}>
                MARKET WATCH ({filteredWatchlist.length})
              </span>
              <span style={{ fontSize: 10, color: '#26a69a', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#26a69a', display: 'inline-block' }} />
                LIVE
              </span>
            </div>

            {/* Quick Watchlist Filters */}
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

            {/* In-Watchlist Search */}
            <input
              type="text"
              placeholder="Filter list..."
              value={watchSearch}
              onChange={e => setWatchSearch(e.target.value)}
              style={styles.watchSearchInput}
            />
          </div>

          {/* Column Header */}
          <div style={styles.watchColRow}>
            <span style={{ flex: 1.6 }}>Symbol</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Last</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Chg%</span>
          </div>

          {/* Watchlist Items */}
          <div style={styles.watchBody}>
            {filteredWatchlist.map(s => {
              const up = s.change >= 0;
              const flash = priceFlash?.get(s.symbol);
              const isSelected = s.symbol.toUpperCase() === currentSymbol.toUpperCase();
              const starred = isWatchlisted(s.symbol);

              return (
                <div
                  key={s.symbol}
                  style={{
                    ...styles.watchItem,
                    ...(isSelected ? styles.watchItemActive : {}),
                    backgroundColor: flash === 'up'
                      ? 'rgba(38,166,154,0.2)'
                      : flash === 'down'
                      ? 'rgba(239,83,80,0.2)'
                      : isSelected
                      ? 'rgba(31,111,235,0.12)'
                      : 'transparent',
                  }}
                  onClick={() => handleSelectSymbol(s.symbol)}
                >
                  {/* Star Toggle */}
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

                  {/* Stock Symbol & Name */}
                  <div style={{ flex: 1.5, minWidth: 0, overflow: 'hidden' }}>
                    <div style={styles.watchTicker}>{s.symbol}</div>
                    <div style={styles.watchName}>{s.name}</div>
                  </div>

                  {/* Real Last Traded Price */}
                  <div style={{
                    flex: 1,
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#c9d1d9',
                  }}>
                    {s.price > 0 ? s.price.toFixed(2) : '—'}
                  </div>

                  {/* Real Change % Pill */}
                  <div style={{
                    flex: 1,
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: up ? '#26a69a' : '#ef5350',
                  }}>
                    <span style={{
                      padding: '2px 5px',
                      borderRadius: 4,
                      background: up ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,80,0.15)',
                    }}>
                      {up ? '+' : ''}{s.changePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredWatchlist.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#8b949e', fontSize: 12 }}>
                {watchFilter === 'starred'
                  ? 'No stocks in Watchlist. Click ☆ next to any stock to add.'
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
    width: 190,
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
  symLabel: { fontSize: 14, fontWeight: 700, color: '#fff' },
  badge: {
    fontSize: 10,
    padding: '2px 6px',
    borderRadius: 4,
    background: '#21262d',
    color: '#8b949e',
    fontWeight: 600,
  },
  metricsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    fontSize: 11.5,
    color: '#8b949e',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
  },
  metricItem: { display: 'flex', alignItems: 'center', gap: 3 },
  tfArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
    paddingLeft: 10,
  },
  tfBtn: {
    background: 'none',
    border: 'none',
    color: '#8b949e',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 5,
    fontSize: 11.5,
    fontWeight: 600,
  },
  tfBtnActive: { background: 'rgba(31,111,235,0.2)', color: '#58a6ff' },
  actionsArea: { display: 'flex', gap: 6 },
  actionBtn: {
    borderRadius: 6,
    cursor: 'pointer',
    padding: '5px 10px',
    fontSize: 11.5,
    transition: 'all 0.15s ease',
  },
  mainLayout: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    minHeight: 0,
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
  chartArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 0,
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(13,17,23,0.85)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 10,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #21262d',
    borderTopColor: '#1f6feb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorBanner: {
    position: 'absolute',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(239, 83, 80, 0.15)',
    border: '1px solid rgba(239, 83, 80, 0.4)',
    color: '#ff7b72',
    padding: '8px 16px',
    borderRadius: 6,
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    zIndex: 20,
  },
  switchBtn: {
    background: '#21262d',
    border: '1px solid #30363d',
    color: '#fff',
    borderRadius: 4,
    padding: '3px 8px',
    fontSize: 11,
    cursor: 'pointer',
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
