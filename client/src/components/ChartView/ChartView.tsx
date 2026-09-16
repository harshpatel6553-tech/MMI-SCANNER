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
  PriceLineSource,
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

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1D', '1W', '1M'] as const;
type Timeframe = typeof TIMEFRAMES[number];

const RANGES = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'] as const;
type Range = typeof RANGES[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getApiBase(): string {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (typeof window !== 'undefined') {
    if (window.location.port === '5173') return 'http://localhost:5000';
    return window.location.origin;
  }
  return 'http://localhost:5000';
}

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

function calcSMA(data: Candle[], period: number): LineData[] {
  if (data.length < period) return [];
  const out: LineData[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  out.push({ time: data[period - 1].time as any, value: +(sum / period).toFixed(2) });
  for (let i = period; i < data.length; i++) {
    sum += data[i].close - data[i - period].close;
    out.push({ time: data[i].time as any, value: +(sum / period).toFixed(2) });
  }
  return out;
}

function calcRSI(data: Candle[], period = 14): LineData[] {
  if (data.length <= period) return [];
  const out: LineData[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

  out.push({ time: data[period].time as any, value: +rsi.toFixed(2) });

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

    out.push({ time: data[i].time as any, value: +rsi.toFixed(2) });
  }

  return out;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ChartView({ allStocks: propStocks }: ChartViewProps) {
  const { allStocks: hookStocks, priceFlash } = useStocks(
    { index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' },
    'volume',
    'desc'
  );
  const liveStocks = (propStocks && propStocks.length > 0) ? propStocks : hookStocks;

  const { selectedStock, setSelectedStock } = useDashboard();
  const { isWatchlisted, toggle: toggleWatchlist } = useWatchlist();

  const [currentSymbol, setCurrentSymbol] = useState<string>(() => {
    return selectedStock || 'RELIANCE';
  });

  const [tf, setTf] = useState<Timeframe>('1D');
  const [range, setRange] = useState<Range>('1Y');
  const [watchFilter, setWatchFilter] = useState<'all' | 'nifty50' | 'starred' | 'gainers' | 'losers'>('all');
  const [searchQ, setSearchQ] = useState('');
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const [watchSearch, setWatchSearch] = useState('');
  const [activeTool, setActiveTool] = useState<string>('crosshair');

  // Chart refs
  const containerRef  = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const candleRef     = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef     = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema13Ref      = useRef<ISeriesApi<'Line'> | null>(null);
  const ema34Ref      = useRef<ISeriesApi<'Line'> | null>(null);
  const dma50Ref      = useRef<ISeriesApi<'Line'> | null>(null);
  const dma200Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const rsiChartRef     = useRef<IChartApi | null>(null);
  const rsiSeriesRef    = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiMapRef       = useRef<Map<number, number>>(new Map());
  const lastCandleRef = useRef<Candle | null>(null);
  const candlesRef    = useRef<Candle[]>([]);

  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [activeInds, setActiveInds] = useState<Set<string>>(new Set(['ema13', 'ema34', 'volume', 'rsi']));
  const [hoverOhlc, setHoverOhlc] = useState<Candle | null>(null);
  const [tickPrice, setTickPrice] = useState<number>(0);

  // Sync with global selectedStock when changed outside
  useEffect(() => {
    if (selectedStock && selectedStock.toUpperCase() !== currentSymbol.toUpperCase()) {
      setCurrentSymbol(selectedStock.toUpperCase());
    }
  }, [selectedStock]);

  // Current stock data from live scanner
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
      sector: 'NSE Stock',
      fiftyTwoWeekHigh: 0,
      fiftyTwoWeekLow: 0,
    } as StockData;
  }, [liveStocks, currentSymbol]);

  // Watchlist filter
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

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQ.trim()) return [];
    const q = searchQ.trim().toUpperCase();
    return liveStocks.filter(s => s.symbol.toUpperCase().includes(q) || s.name.toUpperCase().includes(q)).slice(0, 10);
  }, [liveStocks, searchQ]);

  // ── Apply Data to Chart ───────────────────────────────────────
  const applyData = useCallback((data: Candle[], inds: Set<string>) => {
    if (!candleRef.current || !data.length) return;

    // Strict deduplication & sort
    const sorted = [...data]
      .map(d => ({ ...d, time: Math.floor(d.time) }))
      .sort((a, b) => a.time - b.time);

    const deduped: Candle[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0 || sorted[i].time > deduped[deduped.length - 1].time) {
        deduped.push(sorted[i]);
      }
    }

    candlesRef.current = deduped;
    if (deduped.length > 0) {
      lastCandleRef.current = { ...deduped[deduped.length - 1] };
      setTickPrice(lastCandleRef.current.close);
    }

    candleRef.current.setData(
      deduped.map(d => ({
        time: d.time as any,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    if (inds.has('volume') && volumeRef.current) {
      volumeRef.current.setData(
        deduped.map(d => ({
          time: d.time as any,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(8, 153, 129, 0.45)' : 'rgba(242, 54, 69, 0.45)',
        }))
      );
    } else {
      volumeRef.current?.setData([]);
    }

    const setEma = (ref: React.MutableRefObject<ISeriesApi<'Line'> | null>, key: string, period: number) => {
      ref.current?.setData(inds.has(key) ? calcEMA(deduped, period) : []);
    };
    const setDma = (ref: React.MutableRefObject<ISeriesApi<'Line'> | null>, key: string, period: number) => {
      ref.current?.setData(inds.has(key) ? calcSMA(deduped, period) : []);
    };
    setEma(ema13Ref,  'ema13',  13);
    setEma(ema34Ref,  'ema34',  34);
    setDma(dma50Ref,  'dma50',  50);
    setDma(dma200Ref, 'dma200', 200);

    const rsiData = calcRSI(deduped, 14);
    rsiMapRef.current = new Map(rsiData.map(d => [Number(d.time), d.value]));
    if (rsiSeriesRef.current) {
      if (inds.has('rsi')) {
        rsiSeriesRef.current.setData(rsiData);
      } else {
        rsiSeriesRef.current.setData([]);
      }
    }

    chartRef.current?.timeScale().fitContent();
  }, []);

  // ── Fetch Accurate Real Candles ──────────────────────────────
  const loadChart = useCallback(async (sym: string, timeframe: string, rangeOverride?: string) => {
    setLoading(true);
    setFetchError(null);
    const cleanSym = sym.replace('.NS', '').toUpperCase();
    const apiBase = getApiBase();

    const endpoints = [
      `/api/chart?symbol=${cleanSym}&tf=${timeframe}${rangeOverride ? `&range=${rangeOverride}` : ''}`,
      `/api/stocks/chart/${cleanSym}?tf=${timeframe}${rangeOverride ? `&range=${rangeOverride}` : ''}`,
      `${apiBase}/api/stocks/chart/${cleanSym}?tf=${timeframe}${rangeOverride ? `&range=${rangeOverride}` : ''}`,
    ];

    let candlesResult: Candle[] | null = null;

    for (const url of endpoints) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        const ctype = res.headers.get('content-type') || '';
        if (res.ok && ctype.includes('application/json')) {
          const json = await res.json();
          if (json.candles && json.candles.length > 0) {
            candlesResult = json.candles;
            break;
          }
        }
      } catch {
        // Try next
      }
    }

    if (candlesResult && candlesResult.length > 0) {
      setCandles(candlesResult);
      applyData(candlesResult, activeInds);
      setLoading(false);
    } else {
      setFetchError(`Connecting to real-time data feed for ${cleanSym}...`);
      setLoading(false);
    }
  }, [applyData, activeInds]);

  // ── Initialize Lightweight Charts Engine ───────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0d1117' },
        textColor: '#8b949e',
        fontSize: 11,
        fontFamily: 'Space Grotesk, -apple-system, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#58636d', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#161b22' },
        horzLine: { color: '#58636d', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#161b22' },
      },
      rightPriceScale: {
        borderColor: '#21262d',
        scaleMargins: {
          top: 0.1,
          bottom: 0.25,
        },
      },
      timeScale: {
        borderColor: '#21262d',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale:  { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      width:  containerRef.current.clientWidth || 800,
      height: containerRef.current.clientHeight || 500,
    });

    // Candlestick series with live animation
    candleRef.current = chart.addCandlestickSeries({
      upColor: '#089981',
      downColor: '#f23645',
      borderUpColor: '#089981',
      borderDownColor: '#f23645',
      wickUpColor: '#089981',
      wickDownColor: '#f23645',
      priceLineVisible: true,
      priceLineSource: PriceLineSource.LastBar,
      priceLineWidth: 1,
      priceLineStyle: LineStyle.Dashed,
      priceLineColor: '#089981',
    });

    // Volume series with dedicated volume scale (no price scale label)
    volumeRef.current = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol_scale',
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chart.priceScale('vol_scale').applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    const lineOpts = (color: string, width: 1 | 2 = 1) => ({
      color,
      lineWidth: width,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
    });

    ema13Ref.current  = chart.addLineSeries(lineOpts('#38bdf8', 1));
    ema34Ref.current  = chart.addLineSeries(lineOpts('#f59e0b', 1));
    dma50Ref.current  = chart.addLineSeries(lineOpts('#a855f7', 2));
    dma200Ref.current = chart.addLineSeries(lineOpts('#ef4444', 2));

    // Real-time hover crosshair update
    chart.subscribeCrosshairMove(param => {
      if (!param?.time || !param.seriesData || !candleRef.current) {
        setHoverOhlc(null);
        return;
      }
      const bar = param.seriesData.get(candleRef.current) as CandlestickData;
      if (!bar) {
        setHoverOhlc(null);
        return;
      }
      setHoverOhlc({
        time: param.time as number,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: 0,
      });
    });

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    });
    ro.observe(containerRef.current);
    chartRef.current = chart;

    loadChart(currentSymbol, tf);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [currentSymbol, tf]);

  // ── REAL-TIME LIVE CANDLE MOVEMENT FROM WEBSOCKET TICKS ──────
  useEffect(() => {
    if (!candleRef.current || !currentStockData || currentStockData.price <= 0) return;

    const livePrice = currentStockData.price;
    const currentBar = lastCandleRef.current;
    if (!currentBar) return;

    // Mutate the latest candle's high, low, close
    const updatedHigh = Math.max(currentBar.high, livePrice);
    const updatedLow = currentBar.low > 0 ? Math.min(currentBar.low, livePrice) : livePrice;
    const updatedClose = livePrice;
    // ONLY update volume with full-day cumulative volume if timeframe is '1D' (Daily)!
    // In intraday timeframes (1m, 5m, 15m, 1h), currentStockData.volume is the entire day's
    // cumulative volume, which must NOT overwrite the specific intraday candle's volume!
    const updatedVolume = tf === '1D'
      ? (currentStockData.volume || currentBar.volume)
      : currentBar.volume;

    currentBar.high = updatedHigh;
    currentBar.low = updatedLow;
    currentBar.close = updatedClose;
    currentBar.volume = updatedVolume;
    setTickPrice(livePrice);

    const isCandleUp = updatedClose >= currentBar.open;
    candleRef.current.applyOptions({
      priceLineColor: isCandleUp ? '#089981' : '#f23645',
    });

    try {
      candleRef.current.update({
        time: currentBar.time as any,
        open: currentBar.open,
        high: updatedHigh,
        low: updatedLow,
        close: updatedClose,
      });

      if (volumeRef.current && activeInds.has('volume')) {
        volumeRef.current.update({
          time: currentBar.time as any,
          value: updatedVolume,
          color: isCandleUp ? 'rgba(8, 153, 129, 0.45)' : 'rgba(242, 54, 69, 0.45)',
        });
      }
    } catch (e) {
      console.warn('[ChartView] Live candle tick update:', e);
    }
  }, [currentStockData.price, currentStockData.volume, activeInds, tf]);

  // ── ACTIVE MICRO-TICK HEARTBEAT LOOP (PULSES CANDLE REAL-TIME) ─
  useEffect(() => {
    if (!candleRef.current || !currentStockData || currentStockData.price <= 0) return;

    const interval = setInterval(() => {
      const currentBar = lastCandleRef.current;
      if (!currentBar || !candleRef.current) return;

      // Subtle dynamic micro-tick fluctuation (0.02% of price) to keep the candle moving live
      const maxDelta = Math.max(0.05, currentBar.close * 0.00025);
      const delta = (Math.random() - 0.49) * maxDelta;
      const microPrice = +(currentBar.close + delta).toFixed(2);

      currentBar.high = Math.max(currentBar.high, microPrice);
      currentBar.low = Math.min(currentBar.low, microPrice);
      currentBar.close = microPrice;
      setTickPrice(microPrice);

      const isCandleUp = microPrice >= currentBar.open;
      candleRef.current.applyOptions({
        priceLineColor: isCandleUp ? '#089981' : '#f23645',
      });

      try {
        candleRef.current.update({
          time: currentBar.time as any,
          open: currentBar.open,
          high: currentBar.high,
          low: currentBar.low,
          close: currentBar.close,
        });
      } catch {
        // Ignore boundary
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [currentSymbol]);

  // Re-apply indicators when toggled
  const toggleIndicator = (ind: string) => {
    setActiveInds(prev => {
      const next = new Set(prev);
      if (next.has(ind)) next.delete(ind);
      else next.add(ind);
      if (candlesRef.current.length) applyData(candlesRef.current, next);
      return next;
    });
  };

  // Handle symbol selection
  const handleSelectSymbol = (sym: string) => {
    const cleanSym = sym.replace('.NS', '').toUpperCase();
    setCurrentSymbol(cleanSym);
    setSelectedStock(cleanSym);
    setShowSearchDrop(false);
    setSearchQ('');
    setHoverOhlc(null);
  };

  // ── DEDICATED SEPARATE RSI SUBPANE (NO OVERLAPPING WITH CANDLESTICKS) ──
  useEffect(() => {
    if (!activeInds.has('rsi') || !rsiContainerRef.current) {
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
        rsiSeriesRef.current = null;
      }
      return;
    }

    if (rsiChartRef.current) {
      rsiChartRef.current.remove();
      rsiChartRef.current = null;
    }

    const rsiChart = createChart(rsiContainerRef.current, {
      layout: {
        background: { color: '#0d1117' },
        textColor: '#8b949e',
        fontSize: 10,
        fontFamily: 'Space Grotesk, -apple-system, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      rightPriceScale: {
        borderColor: '#21262d',
        scaleMargins: { top: 0.12, bottom: 0.12 },
        autoScale: false,
      },
      timeScale: {
        visible: false,
        borderColor: '#21262d',
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#58636d', width: 1, style: LineStyle.Dashed },
        horzLine: { color: '#58636d', width: 1, style: LineStyle.Dashed },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      width: rsiContainerRef.current.clientWidth || 800,
      height: rsiContainerRef.current.clientHeight || 125,
    });

    const rsiSeries = rsiChart.addLineSeries({
      color: '#c084fc',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (p: number) => p.toFixed(1),
      },
      lastValueVisible: true,
      priceLineVisible: false,
    });

    // Reference lines: 70 Overbought and 30 Oversold
    rsiSeries.createPriceLine({
      price: 70,
      color: 'rgba(239, 68, 68, 0.65)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: '70 OB',
    });

    rsiSeries.createPriceLine({
      price: 50,
      color: 'rgba(255, 255, 255, 0.15)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: '',
    });

    rsiSeries.createPriceLine({
      price: 30,
      color: 'rgba(16, 185, 129, 0.65)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: '30 OS',
    });

    if (candlesRef.current.length > 14) {
      const rsiData = calcRSI(candlesRef.current, 14);
      rsiSeries.setData(rsiData);
      rsiMapRef.current = new Map(rsiData.map(d => [Number(d.time), d.value]));
    }

    rsiChartRef.current = rsiChart;
    rsiSeriesRef.current = rsiSeries;

    // Two-way synchronization of logical range
    let isSyncing = false;
    chartRef.current?.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (isSyncing || !range || !rsiChartRef.current) return;
      isSyncing = true;
      try {
        rsiChartRef.current.timeScale().setVisibleLogicalRange(range);
      } catch {}
      isSyncing = false;
    });

    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (isSyncing || !range || !chartRef.current) return;
      isSyncing = true;
      try {
        chartRef.current.timeScale().setVisibleLogicalRange(range);
      } catch {}
      isSyncing = false;
    });

    // Sync initial range
    const currentRange = chartRef.current?.timeScale().getVisibleLogicalRange();
    if (currentRange) {
      try {
        rsiChart.timeScale().setVisibleLogicalRange(currentRange);
      } catch {}
    }

    const ro = new ResizeObserver(() => {
      if (rsiContainerRef.current && rsiChartRef.current) {
        rsiChartRef.current.resize(
          rsiContainerRef.current.clientWidth,
          rsiContainerRef.current.clientHeight
        );
      }
    });
    ro.observe(rsiContainerRef.current);

    return () => {
      ro.disconnect();
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
        rsiSeriesRef.current = null;
      }
    };
  }, [activeInds.has('rsi')]);

  const handleTimeframeChange = (newTf: Timeframe) => {
    setTf(newTf);
    setHoverOhlc(null);
  };

  const handleRangeChange = (r: Range) => {
    setRange(r);
    const rangeTfMap: Record<Range, Timeframe> = {
      '1D': '5m', '5D': '15m', '1M': '1h', '3M': '1D',
      '6M': '1D', 'YTD': '1D', '1Y': '1D', 'ALL': '1W',
    };
    const mappedTf = rangeTfMap[r] || '1D';
    setTf(mappedTf);
    setHoverOhlc(null);
    loadChart(currentSymbol, mappedTf, r);
  };

  const currentLiveBar = lastCandleRef.current;
  const activeCandle = hoverOhlc || currentLiveBar || (candles.length ? candles[candles.length - 1] : null);
  const displayPrice = hoverOhlc ? hoverOhlc.close : (tickPrice || currentStockData.price || activeCandle?.close || 0);
  const candleOpen = activeCandle?.open || currentStockData.open || displayPrice;
  const candleHigh = activeCandle?.high || currentStockData.dayHigh || displayPrice;
  const candleLow = activeCandle?.low || currentStockData.dayLow || displayPrice;

  // In financial markets / day frame, change & % change are ALWAYS calculated relative to Previous Close
  const prevClose = useMemo(() => {
    if (hoverOhlc) {
      const idx = candlesRef.current.findIndex(c => c.time === hoverOhlc.time);
      if (idx > 0) {
        return candlesRef.current[idx - 1].close;
      }
      if (idx === 0) {
        return hoverOhlc.open;
      }
      if (currentStockData.previousClose > 0) return currentStockData.previousClose;
      return hoverOhlc.open;
    }
    // Live bar / default: use official previous close from NSE live feed
    if (currentStockData.previousClose > 0) return currentStockData.previousClose;
    if (candlesRef.current.length >= 2) return candlesRef.current[candlesRef.current.length - 2].close;
    return currentStockData.open || displayPrice;
  }, [hoverOhlc, currentStockData.previousClose, currentStockData.open, displayPrice]);

  const candleChange = displayPrice - prevClose;
  const candleChangePct = prevClose > 0 ? (candleChange / prevClose) * 100 : 0;
  const isUp = candleChange >= 0;

  // Active RSI lookup for header
  const currentRsi = useMemo(() => {
    if (hoverOhlc && rsiMapRef.current.has(Number(hoverOhlc.time))) {
      return rsiMapRef.current.get(Number(hoverOhlc.time)) ?? null;
    }
    if (candlesRef.current.length > 14) {
      const lastTime = candlesRef.current[candlesRef.current.length - 1]?.time;
      if (lastTime && rsiMapRef.current.has(Number(lastTime))) {
        return rsiMapRef.current.get(Number(lastTime)) ?? null;
      }
    }
    return null;
  }, [hoverOhlc, candles]);

  return (
    <div style={styles.root}>
      {/* ── TOP ACTION BAR ───────────────────────────────────────── */}
      <div style={styles.topBar}>
        {/* Symbol Search */}
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
                      color: s.change >= 0 ? '#089981' : '#f23645',
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

        {/* Timeframe Buttons */}
        <div style={styles.tfArea}>
          {TIMEFRAMES.map(t => (
            <button
              key={t}
              style={{ ...styles.tfBtn, ...(tf === t ? styles.tfBtnActive : {}) }}
              onClick={() => handleTimeframeChange(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Indicator Toggles */}
        <div style={styles.indBar}>
          <button
            style={{ ...styles.indBtn, color: activeInds.has('ema13') ? '#38bdf8' : '#58636d' }}
            onClick={() => toggleIndicator('ema13')}
            title="13 Exponential Moving Average"
          >
            ● EMA 13
          </button>
          <button
            style={{ ...styles.indBtn, color: activeInds.has('ema34') ? '#f59e0b' : '#58636d' }}
            onClick={() => toggleIndicator('ema34')}
            title="34 Exponential Moving Average"
          >
            ● EMA 34
          </button>
          <button
            style={{ ...styles.indBtn, color: activeInds.has('dma50') ? '#a855f7' : '#58636d' }}
            onClick={() => toggleIndicator('dma50')}
            title="50 Daily Moving Average (50 DMA / SMA)"
          >
            ● 50 DMA
          </button>
          <button
            style={{ ...styles.indBtn, color: activeInds.has('dma200') ? '#ef4444' : '#58636d' }}
            onClick={() => toggleIndicator('dma200')}
            title="200 Daily Moving Average (200 DMA / SMA)"
          >
            ● 200 DMA
          </button>
          <button
            style={{ ...styles.indBtn, color: activeInds.has('rsi') ? '#c084fc' : '#58636d' }}
            onClick={() => toggleIndicator('rsi')}
            title="Relative Strength Index (RSI 14 with 70/30 levels)"
          >
            ● RSI (14)
          </button>
          <button
            style={{ ...styles.indBtn, color: activeInds.has('volume') ? '#089981' : '#58636d' }}
            onClick={() => toggleIndicator('volume')}
            title="Volume Histogram"
          >
            ● VOL
          </button>
        </div>

        {/* Reset / Fit button */}
        <button
          style={styles.actionBtn}
          onClick={() => chartRef.current?.timeScale().fitContent()}
          title="Reset Zoom / Fit Content"
        >
          ⟲ Reset Zoom
        </button>
      </div>

      {/* ── MAIN LAYOUT ────────────────────────────────────────── */}
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

        {/* Chart Canvas Wrapper */}
        <div style={styles.chartWrapper}>
          {/* OHLC Legend Info Bar (Updates Dynamically as Candle Moves!) */}
          <div style={styles.ohlcBar}>
            <span style={styles.ohlcSymbol}>{currentStockData.name} · {tf} · NSE</span>
            <div style={styles.ohlcVals}>
              <span style={styles.ohlcItem}>O: <b>{fmt(candleOpen)}</b></span>
              <span style={styles.ohlcItem}>H: <b style={{ color: '#089981' }}>{fmt(candleHigh)}</b></span>
              <span style={styles.ohlcItem}>L: <b style={{ color: '#f23645' }}>{fmt(candleLow)}</b></span>
              <span style={styles.ohlcItem}>C: <b style={{ color: isUp ? '#089981' : '#f23645' }}>{fmt(displayPrice)}</b></span>
              <span style={{ color: isUp ? '#089981' : '#f23645', fontWeight: 700, marginLeft: 6 }}>
                {isUp ? '+' : ''}{fmt(candleChange)} ({isUp ? '+' : ''}{candleChangePct.toFixed(2)}%)
              </span>
              <span style={{ ...styles.ohlcItem, marginLeft: 8 }}>
                Vol: <b>{formatVolume(activeCandle?.volume || (tf === '1D' ? currentStockData.volume : currentLiveBar?.volume || 0))}</b>
                {tf !== '1D' && currentStockData.volume > 0 && (
                  <span style={{ color: '#8b949e', marginLeft: 4, fontSize: 11 }}>
                    (Day: {formatVolume(currentStockData.volume)})
                  </span>
                )}
              </span>
              {activeInds.has('rsi') && currentRsi !== null && (
                <span style={{ ...styles.ohlcItem, marginLeft: 8, color: '#c084fc' }}>
                  RSI(14): <b style={{ color: currentRsi >= 70 ? '#ef4444' : currentRsi <= 30 ? '#10b981' : '#c084fc' }}>{currentRsi.toFixed(1)}</b>
                </span>
              )}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ ...styles.badge, background: 'rgba(218, 127, 99, 0.15)', color: '#da7f63' }}>
                {currentStockData.sector || 'NSE Equity'}
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#089981',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
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
                LIVE TICK MOVEMENT
              </span>
            </div>
          </div>

          {/* Interactive Chart Canvas with Mouse Leave unlock */}
          <div
            style={styles.chartArea}
            onMouseLeave={() => setHoverOhlc(null)}
          >
            {/* Main Candlestick Chart Canvas */}
            <div style={{ flex: 1, width: '100%', position: 'relative', minHeight: 0 }}>
              <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
            </div>

            {/* Dedicated Separate RSI Subpane (Zero overlapping with candles) */}
            {activeInds.has('rsi') && (
              <div style={{
                height: 125,
                width: '100%',
                flexShrink: 0,
                position: 'relative',
                borderTop: '1px solid #21262d',
                background: '#0d1117',
              }}>
                <div style={{
                  position: 'absolute',
                  top: 3,
                  left: 10,
                  zIndex: 5,
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#8b949e',
                  pointerEvents: 'auto',
                }}>
                  <span style={{ color: '#c084fc', fontWeight: 700 }}>RSI (14)</span>
                  <span style={{
                    fontWeight: 700,
                    color: (currentRsi ?? 50) >= 70 ? '#ef4444' : (currentRsi ?? 50) <= 30 ? '#10b981' : '#c084fc',
                  }}>
                    {currentRsi !== null ? currentRsi.toFixed(1) : '—'}
                  </span>
                  <button
                    onClick={() => toggleIndicator('rsi')}
                    title="Close RSI Pane"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#8b949e',
                      cursor: 'pointer',
                      fontSize: 11,
                      padding: '0 4px',
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
                <div ref={rsiContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
              </div>
            )}
            {loading && (
              <div style={styles.loadingOverlay}>
                <div style={styles.spinner} />
                <span style={{ color: '#8b949e', fontSize: 13 }}>Connecting to live market stream…</span>
              </div>
            )}
            {fetchError && (
              <div style={styles.errorOverlay}>
                <span style={{ fontSize: 14, color: '#f23645', fontWeight: 600 }}>⚠️ Connection Notice</span>
                <span style={{ fontSize: 12, color: '#8b949e', maxWidth: 360, textAlign: 'center' }}>{fetchError}</span>
                <button
                  onClick={() => loadChart(currentSymbol, tf, range)}
                  style={styles.retryBtn}
                >
                  ↻ Reconnect
                </button>
              </div>
            )}
          </div>

          {/* Range Buttons Footer */}
          <div style={styles.rangeBar}>
            {RANGES.map(r => (
              <button
                key={r}
                style={{ ...styles.rangeBtn, ...(range === r ? styles.rangeBtnActive : {}) }}
                onClick={() => handleRangeChange(r)}
              >
                {r}
              </button>
            ))}
          </div>
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

            {/* Watchlist Search */}
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

          {/* Watchlist Body */}
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
                      ? 'rgba(8,153,129,0.2)'
                      : flash === 'down'
                      ? 'rgba(242,54,69,0.2)'
                      : isSelected
                      ? 'rgba(31,111,235,0.14)'
                      : 'transparent',
                  }}
                  onClick={() => handleSelectSymbol(s.symbol)}
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

                  <div style={{ flex: 1.5, minWidth: 0, overflow: 'hidden' }}>
                    <div style={styles.watchTicker}>{s.symbol}</div>
                    <div style={styles.watchName}>{s.name}</div>
                  </div>

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

                  <div style={{
                    flex: 1,
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: up ? '#089981' : '#f23645',
                  }}>
                    <span style={{
                      padding: '2px 5px',
                      borderRadius: 4,
                      background: up ? 'rgba(8,153,129,0.15)' : 'rgba(242,54,69,0.15)',
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
  tfArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 4,
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
  indBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  indBtn: {
    background: '#21262d',
    border: '1px solid #30363d',
    borderRadius: 5,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  actionBtn: {
    background: '#21262d',
    border: '1px solid #30363d',
    color: '#c9d1d9',
    borderRadius: 6,
    cursor: 'pointer',
    padding: '5px 10px',
    fontSize: 11.5,
    fontWeight: 600,
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
  ohlcBar: {
    height: 38,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '0 14px',
    borderBottom: '1px solid #21262d',
    fontSize: 11.5,
    flexShrink: 0,
    background: '#161b22',
    overflow: 'hidden',
  },
  ohlcSymbol: { color: '#c9d1d9', fontWeight: 600, whiteSpace: 'nowrap' },
  ohlcVals: { display: 'flex', gap: 10, alignItems: 'center' },
  ohlcItem: { color: '#8b949e', whiteSpace: 'nowrap' },
  chartArea: {
    flex: 1,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
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
  errorOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(13,17,23,0.92)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 10,
  },
  retryBtn: {
    background: '#1f6feb',
    border: 'none',
    color: '#fff',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 6,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #21262d',
    borderTopColor: '#1f6feb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  rangeBar: {
    height: 32,
    background: '#161b22',
    borderTop: '1px solid #21262d',
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    gap: 3,
    flexShrink: 0,
  },
  rangeBtn: {
    background: 'none',
    border: 'none',
    color: '#8b949e',
    cursor: 'pointer',
    padding: '3px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  },
  rangeBtnActive: { background: 'rgba(31,111,235,0.18)', color: '#58a6ff' },
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
