import React, {
  useEffect, useRef, useState, useCallback,
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface WatchStock {
  ticker: string;
  yf: string;
  name: string;
  sector: string;
  mockBase: number;
  last: number;
  chg: number;
  chgPct: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_SOCKET_URL || window.location.origin);
const SERVER = `${API_BASE}/api/stocks`;

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1D', '1W', '1M'] as const;
const RANGES     = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'] as const;

const NSE_STOCKS: Omit<WatchStock, 'last' | 'chg' | 'chgPct'>[] = [
  { ticker: 'RELIANCE',   yf: 'RELIANCE.NS',   name: 'Reliance Industries',    sector: 'Energy',       mockBase: 2820  },
  { ticker: 'TCS',        yf: 'TCS.NS',         name: 'Tata Consultancy Svcs', sector: 'IT',           mockBase: 3920  },
  { ticker: 'HDFCBANK',   yf: 'HDFCBANK.NS',   name: 'HDFC Bank',             sector: 'Banking',      mockBase: 1710  },
  { ticker: 'INFY',       yf: 'INFY.NS',        name: 'Infosys',               sector: 'IT',           mockBase: 1810  },
  { ticker: 'ICICIBANK',  yf: 'ICICIBANK.NS',  name: 'ICICI Bank',            sector: 'Banking',      mockBase: 1150  },
  { ticker: 'SBIN',       yf: 'SBIN.NS',        name: 'State Bank of India',   sector: 'Banking',      mockBase: 810   },
  { ticker: 'BAJFINANCE', yf: 'BAJFINANCE.NS', name: 'Bajaj Finance',         sector: 'Finance',      mockBase: 7250  },
  { ticker: 'BHARTIARTL', yf: 'BHARTIARTL.NS', name: 'Bharti Airtel',         sector: 'Telecom',      mockBase: 1620  },
  { ticker: 'KOTAKBANK',  yf: 'KOTAKBANK.NS',  name: 'Kotak Mahindra Bank',   sector: 'Banking',      mockBase: 1820  },
  { ticker: 'LT',         yf: 'LT.NS',          name: 'Larsen & Toubro',       sector: 'Infra',        mockBase: 3620  },
  { ticker: 'AXISBANK',   yf: 'AXISBANK.NS',   name: 'Axis Bank',             sector: 'Banking',      mockBase: 1160  },
  { ticker: 'ASIANPAINT', yf: 'ASIANPAINT.NS', name: 'Asian Paints',          sector: 'Consumer',     mockBase: 3050  },
  { ticker: 'MARUTI',     yf: 'MARUTI.NS',      name: 'Maruti Suzuki',         sector: 'Auto',         mockBase: 11200 },
  { ticker: 'WIPRO',      yf: 'WIPRO.NS',       name: 'Wipro',                 sector: 'IT',           mockBase: 462   },
  { ticker: 'TITAN',      yf: 'TITAN.NS',       name: 'Titan Company',         sector: 'Consumer',     mockBase: 3840  },
  { ticker: 'SUNPHARMA',  yf: 'SUNPHARMA.NS',  name: 'Sun Pharmaceutical',    sector: 'Pharma',       mockBase: 1720  },
  { ticker: 'TATAMOTORS', yf: 'TATAMOTORS.NS', name: 'Tata Motors',           sector: 'Auto',         mockBase: 960   },
  { ticker: 'HCLTECH',    yf: 'HCLTECH.NS',    name: 'HCL Technologies',      sector: 'IT',           mockBase: 1820  },
  { ticker: 'NTPC',       yf: 'NTPC.NS',        name: 'NTPC Limited',          sector: 'Energy',       mockBase: 382   },
  { ticker: 'ONGC',       yf: 'ONGC.NS',        name: 'Oil & Natural Gas',     sector: 'Energy',       mockBase: 282   },
  { ticker: 'TATASTEEL',  yf: 'TATASTEEL.NS',  name: 'Tata Steel',            sector: 'Metals',       mockBase: 162   },
  { ticker: 'ADANIENT',   yf: 'ADANIENT.NS',   name: 'Adani Enterprises',     sector: 'Conglomerate', mockBase: 2820  },
  { ticker: 'COALINDIA',  yf: 'COALINDIA.NS',  name: 'Coal India',            sector: 'Mining',       mockBase: 485   },
  { ticker: 'DRREDDY',    yf: 'DRREDDY.NS',    name: "Dr Reddy's Labs",       sector: 'Pharma',       mockBase: 6520  },
  { ticker: 'CIPLA',      yf: 'CIPLA.NS',       name: 'Cipla',                 sector: 'Pharma',       mockBase: 1620  },
  { ticker: 'EBGNG',      yf: 'EBGNG.NS',       name: 'EBGNG',                 sector: 'Electronics',  mockBase: 636   },
];

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

function seedPrice(stock: Omit<WatchStock, 'last' | 'chg' | 'chgPct'>): WatchStock {
  const base   = stock.mockBase;
  const chgPct = +(( Math.random() - 0.47) * 6).toFixed(2);
  const last   = +(base * (1 + chgPct / 100)).toFixed(2);
  const chg    = +(last - base).toFixed(2);
  return { ...stock, last, chg, chgPct };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChartView() {
  // Chart refs
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const candleRef    = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef    = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema13Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const ema34Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200Ref    = useRef<ISeriesApi<'Line'> | null>(null);

  // State
  const [symbol, setSymbol]       = useState('RELIANCE.NS');
  const [tf, setTf]               = useState('1D');
  const [range, setRange]         = useState('1Y');
  const [loading, setLoading]     = useState(false);
  const [candles, setCandles]     = useState<Candle[]>([]);
  const [ohlc, setOhlc]           = useState<Candle | null>(null);
  const [prevOhlc, setPrevOhlc]   = useState<Candle | null>(null);
  const [searchQ, setSearchQ]     = useState('');
  const [showDrop, setShowDrop]   = useState(false);
  const [watchlist, setWatchlist] = useState<WatchStock[]>(() => NSE_STOCKS.map(seedPrice));
  const [activeInds, setActiveInds] = useState(new Set(['ema13', 'ema34', 'ema50', 'ema200']));
  const [showIndModal, setShowIndModal] = useState(false);

  const currentStock = NSE_STOCKS.find(s => s.yf === symbol) || NSE_STOCKS[0];

  // ── Init chart ───────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
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
      handleScroll:  { mouseWheel: true, pressedMouseMove: true },
      handleScale:   { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
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
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.80, bottom: 0 } });

    const lineOpts = (color: string, width: number) => ({
      color, lineWidth: width as any,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    ema13Ref.current  = chart.addLineSeries(lineOpts('#f59e0b', 1.5));
    ema34Ref.current  = chart.addLineSeries(lineOpts('#3b82f6', 1.5));
    ema50Ref.current  = chart.addLineSeries(lineOpts('#22c55e', 2));
    ema200Ref.current = chart.addLineSeries(lineOpts('#ef4444', 2.5));

    chart.subscribeCrosshairMove(param => {
      if (!param?.time || !param.seriesData || !candleRef.current) return;
      const bar = param.seriesData.get(candleRef.current) as CandlestickData;
      if (!bar) return;
      setOhlc({
        time: param.time as number,
        open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: 0,
      });
    });

    const ro = new ResizeObserver(() => {
      if (containerRef.current)
        chart.resize(containerRef.current.offsetWidth, containerRef.current.offsetHeight);
    });
    ro.observe(containerRef.current);
    chartRef.current = chart;

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, []);

  // ── Apply candles + EMAs ─────────────────────────────────────
  const applyData = useCallback((data: Candle[], inds: Set<string>) => {
    const sorted = [...data].sort((a, b) => a.time - b.time);

    candleRef.current?.setData(
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

    if (sorted.length) {
      setOhlc(sorted[sorted.length - 1]);
      setPrevOhlc(sorted.length > 1 ? sorted[sorted.length - 2] : sorted[0]);
    }
  }, []);

  // ── Fetch candles ────────────────────────────────────────────
  const loadChart = useCallback(async (sym: string, timeframe: string, rangeKey?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tf: timeframe });
      if (rangeKey) params.set('range', rangeKey);
      const res = await fetch(`${SERVER}/chart/${sym.replace('.NS', '')}?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setCandles(json.candles);
      applyData(json.candles, activeInds);
    } catch (e) {
      console.warn('[ChartView] fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [applyData, activeInds]);

  // Initial load
  useEffect(() => { loadChart(symbol, tf); }, []);

  // Re-apply when indicators toggled
  useEffect(() => {
    if (candles.length) applyData(candles, activeInds);
  }, [activeInds]);

  // ── Watchlist live quotes (poll every 5s) ────────────────────
  useEffect(() => {
    const refresh = async () => {
      const results = await Promise.allSettled(
        NSE_STOCKS.map(s =>
          fetch(`${SERVER}/quote/${s.ticker}`, { signal: AbortSignal.timeout(4000) })
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      );
      setWatchlist(NSE_STOCKS.map((s, i) => {
        const r = results[i];
        if (r.status === 'fulfilled' && r.value) {
          return {
            ...s,
            last:   r.value.price,
            chg:    r.value.change,
            chgPct: r.value.changePercent,
          };
        }
        return seedPrice(s);
      }));
    };
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────
  const handleSymbolSelect = (yf: string) => {
    setSymbol(yf);
    setSearchQ('');
    setShowDrop(false);
    loadChart(yf, tf);
  };

  const handleTf = (t: string) => {
    setTf(t);
    loadChart(symbol, t);
  };

  const handleRange = (r: string) => {
    setRange(r);
    const tfMap: Record<string, string> = {
      '1D': '5m', '5D': '15m', '1M': '1h', '3M': '1D',
      '6M': '1D', 'YTD': '1D', '1Y': '1D', 'ALL': '1W',
    };
    const newTf = tfMap[r] || '1D';
    setTf(newTf);
    loadChart(symbol, newTf, r);
  };

  const toggleInd = (key: string) => {
    setActiveInds(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const searchResults = searchQ.trim()
    ? NSE_STOCKS.filter(s =>
        s.ticker.includes(searchQ.toUpperCase()) ||
        s.name.toUpperCase().includes(searchQ.toUpperCase())
      ).slice(0, 8)
    : [];

  const chgVal  = ohlc && prevOhlc ? ohlc.close - prevOhlc.close : null;
  const chgPct  = ohlc && prevOhlc && prevOhlc.close > 0 ? ((ohlc.close - prevOhlc.close) / prevOhlc.close) * 100 : null;
  const isUp    = (chgVal ?? 0) >= 0;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={styles.root}>

      {/* ── TOP BAR ──────────────────────────────────────────── */}
      <div style={styles.topBar}>
        {/* Symbol search */}
        <div style={styles.symbolArea}>
          <div style={{ position: 'relative' }}>
            <input
              style={styles.searchInput}
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setShowDrop(true); }}
              onFocus={() => setShowDrop(true)}
              onBlur={() => setTimeout(() => setShowDrop(false), 150)}
              placeholder="Search symbol…"
            />
            {showDrop && searchResults.length > 0 && (
              <div style={styles.dropdown}>
                {searchResults.map(s => (
                  <div key={s.yf} style={styles.dropItem} onMouseDown={() => handleSymbolSelect(s.yf)}>
                    <span style={styles.dropTicker}>{s.ticker}</span>
                    <span style={styles.dropName}>{s.name}</span>
                    <span style={styles.dropSector}>{s.sector}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <span style={styles.symLabel}>{currentStock.ticker}</span>
          <span style={styles.badge}>NSE</span>
          <span style={styles.badge}>{tf}</span>
        </div>

        {/* Timeframes */}
        <div style={styles.tfArea}>
          {TIMEFRAMES.map(t => (
            <button key={t} style={{ ...styles.tfBtn, ...(tf === t ? styles.tfBtnActive : {}) }}
              onClick={() => handleTf(t)}>{t}</button>
          ))}
        </div>

        {/* Actions */}
        <div style={styles.actionsArea}>
          <button style={styles.actionBtn} onClick={() => setShowIndModal(true)}>
            ⊞ Indicators
          </button>
        </div>
      </div>

      {/* ── MAIN LAYOUT ──────────────────────────────────────── */}
      <div style={styles.mainLayout}>

        {/* Left toolbar */}
        <div style={styles.leftBar}>
          {[
            { icon: '⊕', label: 'Crosshair' },
            { icon: '↗', label: 'Trend Line' },
            { icon: '—', label: 'H-Line' },
            { icon: '↕', label: 'V-Line' },
            { icon: '◇', label: 'Fibonacci' },
            { icon: '□', label: 'Rectangle' },
            { icon: 'T', label: 'Text' },
            { icon: '🔍', label: 'Zoom' },
          ].map(tool => (
            <button key={tool.label} title={tool.label} style={styles.toolBtn}>
              {tool.icon}
            </button>
          ))}
        </div>

        {/* Chart wrapper */}
        <div style={styles.chartWrapper}>

          {/* OHLC bar */}
          <div style={styles.ohlcBar}>
            <span style={styles.ohlcSymbol}>{currentStock.name} · {tf} · NSE</span>
            <div style={styles.ohlcVals}>
              <span style={styles.ohlcItem}>O <b>{fmt(ohlc?.open)}</b></span>
              <span style={styles.ohlcItem}>H <b style={{ color: '#26a69a' }}>{fmt(ohlc?.high)}</b></span>
              <span style={styles.ohlcItem}>L <b style={{ color: '#ef5350' }}>{fmt(ohlc?.low)}</b></span>
              <span style={styles.ohlcItem}>C <b>{fmt(ohlc?.close)}</b></span>
              {chgVal !== null && (
                <span style={{ color: isUp ? '#26a69a' : '#ef5350', fontWeight: 700, marginLeft: 8 }}>
                  {isUp ? '+' : ''}{fmt(chgVal)} ({isUp ? '+' : ''}{chgPct?.toFixed(2)}%)
                </span>
              )}
            </div>
            <div style={styles.emaLabels}>
              {activeInds.has('ema13')  && <span style={{ color: '#f59e0b' }}>EMA13</span>}
              {activeInds.has('ema34')  && <span style={{ color: '#3b82f6' }}>EMA34</span>}
              {activeInds.has('ema50')  && <span style={{ color: '#22c55e' }}>EMA50</span>}
              {activeInds.has('ema200') && <span style={{ color: '#ef4444' }}>EMA200</span>}
            </div>
          </div>

          {/* Chart canvas */}
          <div style={styles.chartArea}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
            {loading && (
              <div style={styles.loadingOverlay}>
                <div style={styles.spinner} />
                <span style={{ color: '#8b949e', fontSize: 13 }}>Loading data…</span>
              </div>
            )}
          </div>

          {/* Range bar */}
          <div style={styles.rangeBar}>
            {RANGES.map(r => (
              <button key={r} style={{ ...styles.rangeBtn, ...(range === r ? styles.rangeBtnActive : {}) }}
                onClick={() => handleRange(r)}>{r}</button>
            ))}
          </div>
        </div>

        {/* ── WATCHLIST ──────────────────────────────────────── */}
        <div style={styles.watchPanel}>
          <div style={styles.watchHeader}>
            <span style={{ fontWeight: 700, fontSize: 12, color: '#c9d1d9', letterSpacing: 1 }}>WATCHLIST</span>
          </div>
          <div style={styles.watchColRow}>
            <span style={{ flex: 1.6 }}>Symbol</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Last</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Chg%</span>
          </div>
          <div style={styles.watchBody}>
            {watchlist.map(s => {
              const up = s.chg >= 0;
              const hue = s.ticker.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
              return (
                <div
                  key={s.yf}
                  style={{
                    ...styles.watchItem,
                    ...(s.yf === symbol ? styles.watchItemActive : {}),
                  }}
                  onClick={() => handleSymbolSelect(s.yf)}
                >
                  <div style={{ flex: 1.6, display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <div style={{ ...styles.watchLogo, background: `hsl(${hue},55%,42%)` }}>
                      {s.ticker[0]}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={styles.watchTicker}>{s.ticker}</div>
                      <div style={styles.watchName}>{s.name}</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'right', fontSize: 12, color: '#c9d1d9', fontWeight: 500 }}>
                    {fmt(s.last)}
                  </div>
                  <div style={{
                    flex: 1, textAlign: 'right', fontSize: 11, fontWeight: 700,
                    color: up ? '#26a69a' : '#ef5350',
                    background: up ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)',
                    borderRadius: 4, padding: '2px 5px',
                  }}>
                    {up ? '+' : ''}{s.chgPct.toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── INDICATORS MODAL ─────────────────────────────────── */}
      {showIndModal && (
        <div style={styles.modalBg} onClick={() => setShowIndModal(false)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <span style={{ fontWeight: 700 }}>Indicators</span>
              <button style={styles.modalClose} onClick={() => setShowIndModal(false)}>✕</button>
            </div>
            {[
              { key: 'ema13',  label: 'EMA 13',   color: '#f59e0b' },
              { key: 'ema34',  label: 'EMA 34',   color: '#3b82f6' },
              { key: 'ema50',  label: 'EMA 50',   color: '#22c55e' },
              { key: 'ema200', label: 'EMA 200',  color: '#ef4444' },
            ].map(ind => (
              <div key={ind.key} style={styles.indRow} onClick={() => toggleInd(ind.key)}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: ind.color }} />
                <span style={{ flex: 1, color: '#c9d1d9' }}>{ind.label}</span>
                <div style={{
                  width: 36, height: 20, borderRadius: 10,
                  background: activeInds.has(ind.key) ? '#1f6feb' : '#30363d',
                  position: 'relative', transition: 'background 0.2s',
                }}>
                  <div style={{
                    position: 'absolute', top: 2,
                    left: activeInds.has(ind.key) ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column',
    height: 'calc(100vh - 60px)', // fits inside MMI layout (below topbar)
    background: '#0d1117', overflow: 'hidden',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  topBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '0 12px', height: 48, flexShrink: 0,
    background: '#161b22', borderBottom: '1px solid #21262d',
  },
  symbolArea: { display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12, borderRight: '1px solid #21262d' },
  searchInput: {
    background: '#21262d', border: '1px solid #30363d', borderRadius: 6,
    color: '#c9d1d9', fontSize: 13, padding: '5px 10px', outline: 'none', width: 160,
  },
  dropdown: {
    position: 'absolute', top: '110%', left: 0, width: 280, zIndex: 999,
    background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden',
  },
  dropItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #21262d',
  },
  dropTicker: { fontWeight: 700, color: '#fff', fontSize: 13, minWidth: 80 },
  dropName:   { flex: 1, color: '#8b949e', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dropSector: { color: '#58636d', fontSize: 10 },
  symLabel:   { fontSize: 14, fontWeight: 700, color: '#fff' },
  badge:      { fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#21262d', color: '#8b949e', fontWeight: 600 },
  tfArea:     { display: 'flex', alignItems: 'center', gap: 2, paddingLeft: 8 },
  tfBtn:      { background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '5px 9px', borderRadius: 5, fontSize: 12, fontWeight: 600 },
  tfBtnActive:{ background: 'rgba(31,111,235,0.15)', color: '#58a6ff' },
  actionsArea:{ marginLeft: 'auto', display: 'flex', gap: 6 },
  actionBtn:  {
    background: '#21262d', border: '1px solid #30363d', borderRadius: 6,
    color: '#c9d1d9', cursor: 'pointer', padding: '5px 12px', fontSize: 12,
  },
  mainLayout: { flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 },
  leftBar:    {
    width: 44, background: '#161b22', borderRight: '1px solid #21262d',
    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 4,
  },
  toolBtn:    {
    width: 34, height: 32, background: 'none', border: 'none',
    color: '#8b949e', cursor: 'pointer', borderRadius: 5, fontSize: 14,
  },
  chartWrapper: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  ohlcBar:    {
    height: 36, display: 'flex', alignItems: 'center', gap: 16,
    padding: '0 12px', borderBottom: '1px solid #21262d',
    fontSize: 12, flexShrink: 0, background: 'transparent', overflow: 'hidden',
  },
  ohlcSymbol: { color: '#c9d1d9', fontWeight: 600, whiteSpace: 'nowrap', marginRight: 4 },
  ohlcVals:   { display: 'flex', gap: 12, alignItems: 'center' },
  ohlcItem:   { color: '#8b949e', whiteSpace: 'nowrap' },
  emaLabels:  { display: 'flex', gap: 10, marginLeft: 8, fontSize: 11, fontWeight: 600 },
  chartArea:  { flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 },
  loadingOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(13,17,23,0.8)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  spinner: {
    width: 32, height: 32, border: '3px solid #21262d', borderTopColor: '#1f6feb',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  rangeBar: {
    height: 32, background: '#161b22', borderTop: '1px solid #21262d',
    display: 'flex', alignItems: 'center', padding: '0 8px', gap: 2, flexShrink: 0,
  },
  rangeBtn:       { background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 },
  rangeBtnActive: { background: 'rgba(31,111,235,0.15)', color: '#58a6ff' },
  watchPanel: {
    width: 268, background: '#161b22', borderLeft: '1px solid #21262d',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
  },
  watchHeader: { padding: '10px 10px 6px', borderBottom: '1px solid #21262d' },
  watchColRow: {
    display: 'flex', padding: '4px 10px', fontSize: 10,
    color: '#58636d', fontWeight: 600, letterSpacing: 0.5,
    borderBottom: '1px solid #21262d', textTransform: 'uppercase',
  },
  watchBody:  { flex: 1, overflowY: 'auto' },
  watchItem:  {
    display: 'flex', alignItems: 'center', padding: '6px 10px',
    cursor: 'pointer', borderBottom: '1px solid rgba(33,38,45,0.6)',
    transition: 'background 0.1s', position: 'relative',
  },
  watchItemActive: { background: 'rgba(31,111,235,0.08)', borderLeft: '2px solid #1f6feb' },
  watchLogo:  {
    width: 20, height: 20, borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0,
  },
  watchTicker: { fontSize: 12, fontWeight: 600, color: '#c9d1d9', lineHeight: 1.2 },
  watchName:   { fontSize: 9, color: '#58636d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 },
  modalBg:    {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalBox:   {
    background: '#161b22', border: '1px solid #30363d', borderRadius: 10,
    width: 320, padding: '0 0 8px', boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
  },
  modalHead:  {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', borderBottom: '1px solid #21262d', fontWeight: 700,
  },
  modalClose: { background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 16 },
  indRow:     {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
    cursor: 'pointer', borderBottom: '1px solid rgba(33,38,45,0.5)',
  },
};
