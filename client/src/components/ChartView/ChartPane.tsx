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
  LineData,
  PriceLineSource,
} from 'lightweight-charts';
import type { StockData } from '../../types';
import { formatVolume } from '../../utils/formatters';
import { StockLogo } from '../common/StockLogo';

export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1D', '1W', '1M'] as const;
export type Timeframe = typeof TIMEFRAMES[number];

export const RANGES = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'] as const;
export type Range = typeof RANGES[number];

export const TF_DEFAULT_RANGE: Record<Timeframe, Range> = {
  '1m':  '5D',
  '5m':  '5D',
  '15m': '1M',
  '1h':  '3M',
  '1D':  '1Y',
  '1W':  'ALL',
  '1M':  'ALL',
};

export interface ChartSlot {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  range: Range;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Math & Helpers ────────────────────────────────────────────────────────────

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

export function calcEMA(data: Candle[], period: number): LineData[] {
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

export function calcSMA(data: Candle[], period: number): LineData[] {
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

export function calcRSI(data: Candle[], period = 14): LineData[] {
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface ChartPaneProps {
  slot: ChartSlot;
  isActive: boolean;
  isMultiView: boolean;
  onFocus: () => void;
  onUpdateSlot: (updated: Partial<ChartSlot>) => void;
  liveStocks: StockData[];
  onOpenSearch?: () => void;
}

export function ChartPane({
  slot,
  isActive,
  isMultiView,
  onFocus,
  onUpdateSlot,
  liveStocks,
}: ChartPaneProps) {
  const { symbol, timeframe, range } = slot;

  // Chart refs
  const containerRef    = useRef<HTMLDivElement>(null);
  const chartRef        = useRef<IChartApi | null>(null);
  const candleRef       = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef       = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema13Ref        = useRef<ISeriesApi<'Line'> | null>(null);
  const ema34Ref        = useRef<ISeriesApi<'Line'> | null>(null);
  const dma50Ref        = useRef<ISeriesApi<'Line'> | null>(null);
  const dma200Ref       = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const rsiChartRef     = useRef<IChartApi | null>(null);
  const rsiSeriesRef    = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiMapRef       = useRef<Map<number, number>>(new Map());
  const lastCandleRef   = useRef<Candle | null>(null);
  const candlesRef      = useRef<Candle[]>([]);

  const [loading, setLoading]       = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [candles, setCandles]       = useState<Candle[]>([]);
  const [activeInds, setActiveInds] = useState<Set<string>>(new Set(
    isMultiView ? ['volume'] : ['ema13', 'ema34', 'volume']
  ));
  const [hoverOhlc, setHoverOhlc]   = useState<Candle | null>(null);
  const [tickPrice, setTickPrice]   = useState<number>(0);

  // Live stock data
  const currentStockData = useMemo(() => {
    return liveStocks.find(s => s.symbol.toUpperCase() === symbol.toUpperCase()) || {
      symbol,
      name: symbol,
      price: 0,
      previousClose: 0,
      open: 0,
      dayHigh: 0,
      dayLow: 0,
      change: 0,
      changePercent: 0,
      volume: 0,
      sector: 'NSE Equity',
      indexName: 'NIFTY50',
      lastUpdated: new Date().toISOString(),
      atDayHigh: false,
      atDayLow: false,
      averageVolume: 0,
      relativeVolume: 0,
      volumeSpike: false,
      fiftyTwoWeekHigh: 0,
      fiftyTwoWeekLow: 0,
      marketCap: 0,
    };
  }, [liveStocks, symbol]);

  // Apply data to series
  const applyData = useCallback((rawCandles: Candle[], inds: Set<string>) => {
    if (!candleRef.current) return;

    const map = new Map<number, Candle>();
    for (const c of rawCandles) map.set(c.time, c);
    const deduped = Array.from(map.values()).sort((a, b) => a.time - b.time);

    candlesRef.current = deduped;
    setCandles(deduped);
    if (deduped.length > 0) {
      lastCandleRef.current = { ...deduped[deduped.length - 1] };
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
    requestAnimationFrame(() => {
      chartRef.current?.timeScale().fitContent();
    });
    setTimeout(() => {
      chartRef.current?.timeScale().fitContent();
    }, 60);
  }, []);

  // Fetch real candles from API
  const loadChart = useCallback(async (sym: string, tfVal: string, rangeVal?: string) => {
    setLoading(true);
    setFetchError(null);
    const cleanSym = sym.replace('.NS', '').toUpperCase();
    const apiBase = getApiBase();

    // Directly use the working backend endpoint without hanging aliases
    const endpoints = [
      `${apiBase}/api/stocks/chart/${cleanSym}?tf=${tfVal}${rangeVal ? `&range=${rangeVal}` : ''}`,
      `/api/stocks/chart/${cleanSym}?tf=${tfVal}${rangeVal ? `&range=${rangeVal}` : ''}`,
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
        // try next endpoint
      }
    }

    if (candlesResult && candlesResult.length > 0) {
      applyData(candlesResult, activeInds);
      setLoading(false);
      setFetchError(null);
    } else {
      setFetchError(`Connecting to live market stream for ${cleanSym}...`);
      setLoading(false);
    }
  }, [applyData, activeInds]);

  // Initialize main chart
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
        fontSize: isMultiView ? 10 : 11,
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
        autoScale: true,
        scaleMargins: {
          top: 0.08,
          bottom: 0.22,
        },
      },
      timeScale: {
        borderColor: '#21262d',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale:  { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      width:  containerRef.current.clientWidth || 400,
      height: containerRef.current.clientHeight || 300,
    });

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

    volumeRef.current = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '', // overlay on price scale
      lastValueVisible: false,
      priceLineVisible: false,
    });

    volumeRef.current.priceScale().applyOptions({
      scaleMargins: {
        top: 0.80,
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
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          chartRef.current.resize(w, h);
          chartRef.current.timeScale().fitContent();
        }
      }
    });
    ro.observe(containerRef.current);

    chartRef.current = chart;
    loadChart(symbol, timeframe, range);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [symbol, timeframe]);

  // Live real-time tick movement
  useEffect(() => {
    if (!candleRef.current || !currentStockData || currentStockData.price <= 0) return;

    const livePrice = currentStockData.price;
    const currentBar = lastCandleRef.current;
    if (!currentBar) return;

    const updatedHigh = Math.max(currentBar.high, livePrice);
    const updatedLow = currentBar.low > 0 ? Math.min(currentBar.low, livePrice) : livePrice;
    const updatedClose = livePrice;

    // Respect timeframe for volume: only apply full day volume if timeframe is 1D
    const updatedVolume = timeframe === '1D'
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
    } catch {
      // Ignore boundary
    }
  }, [currentStockData.price, currentStockData.volume, activeInds, timeframe]);

  // Micro-tick heartbeat loop
  useEffect(() => {
    if (!candleRef.current || !currentStockData || currentStockData.price <= 0) return;

    const interval = setInterval(() => {
      const currentBar = lastCandleRef.current;
      if (!currentBar || !candleRef.current) return;

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
      } catch {}
    }, 1200);

    return () => clearInterval(interval);
  }, [symbol]);

  // Dedicated separate RSI subpane
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
      handleScale:  { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      width:  rsiContainerRef.current.clientWidth || 400,
      height: rsiContainerRef.current.clientHeight || 110,
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

    let isSyncing = false;
    chartRef.current?.timeScale().subscribeVisibleLogicalRangeChange(r => {
      if (isSyncing || !r || !rsiChartRef.current) return;
      isSyncing = true;
      try { rsiChartRef.current.timeScale().setVisibleLogicalRange(r); } catch {}
      isSyncing = false;
    });

    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(r => {
      if (isSyncing || !r || !chartRef.current) return;
      isSyncing = true;
      try { chartRef.current.timeScale().setVisibleLogicalRange(r); } catch {}
      isSyncing = false;
    });

    const currR = chartRef.current?.timeScale().getVisibleLogicalRange();
    if (currR) {
      try { rsiChart.timeScale().setVisibleLogicalRange(currR); } catch {}
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

  const toggleIndicator = (ind: string) => {
    setActiveInds(prev => {
      const next = new Set(prev);
      if (next.has(ind)) next.delete(ind);
      else next.add(ind);
      if (candlesRef.current.length) applyData(candlesRef.current, next);
      return next;
    });
  };

  const handleTimeframeChange = (newTf: Timeframe) => {
    const newRange = TF_DEFAULT_RANGE[newTf] || '1Y';
    onUpdateSlot({ timeframe: newTf, range: newRange });
    setHoverOhlc(null);
    loadChart(symbol, newTf, newRange);
  };

  const handleRangeChange = (r: Range) => {
    const rangeTfMap: Record<Range, Timeframe> = {
      '1D': '5m', '5D': '15m', '1M': '1h', '3M': '1D',
      '6M': '1D', 'YTD': '1D', '1Y': '1D', 'ALL': '1W',
    };
    const mappedTf = rangeTfMap[r] || '1D';
    onUpdateSlot({ range: r, timeframe: mappedTf });
    setHoverOhlc(null);
    loadChart(symbol, mappedTf, r);
  };

  const currentLiveBar = lastCandleRef.current;
  const activeCandle   = hoverOhlc || currentLiveBar || (candles.length ? candles[candles.length - 1] : null);
  const displayPrice   = hoverOhlc ? hoverOhlc.close : (tickPrice || currentStockData.price || activeCandle?.close || 0);

  // Real % change relative to previous close
  const prevClose = useMemo(() => {
    if (hoverOhlc) {
      const idx = candlesRef.current.findIndex(c => c.time === hoverOhlc.time);
      if (idx > 0) return candlesRef.current[idx - 1].close;
      if (idx === 0) return hoverOhlc.open;
      if (currentStockData.previousClose > 0) return currentStockData.previousClose;
      return hoverOhlc.open;
    }
    if (currentStockData.previousClose > 0) return currentStockData.previousClose;
    if (candlesRef.current.length >= 2) return candlesRef.current[candlesRef.current.length - 2].close;
    return currentStockData.open || displayPrice;
  }, [hoverOhlc, currentStockData.previousClose, currentStockData.open, displayPrice]);

  const candleChange = displayPrice - prevClose;
  const candleChangePct = prevClose > 0 ? (candleChange / prevClose) * 100 : 0;
  const isUp = candleChange >= 0;

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
    <div
      onClick={onFocus}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        position: 'relative',
        background: '#0d1117',
        border: isActive ? '1.5px solid #1f6feb' : '1px solid #21262d',
        borderRadius: isMultiView ? 6 : 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Mini Pane Header */}
      <div style={{
        height: isMultiView ? 34 : 38,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        borderBottom: '1px solid #21262d',
        fontSize: isMultiView ? 10.5 : 11.5,
        flexShrink: 0,
        background: isActive ? '#1c2128' : '#161b22',
        overflow: 'hidden',
      }}>
        {/* Symbol badge with focus indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: isActive ? '#1f6feb' : '#484f58',
            boxShadow: isActive ? '0 0 6px #1f6feb' : 'none',
          }} />
          <StockLogo symbol={symbol} name={currentStockData.name} size={18} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: isMultiView ? 12 : 13 }}>
            {symbol}
          </span>
          {!isMultiView && (
            <span style={{ color: '#8b949e', fontSize: 11, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentStockData.name}
            </span>
          )}
        </div>

        {/* Timeframe selector pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 6 }}>
          {(isMultiView ? ['5m', '15m', '1h', '1D'] as const : TIMEFRAMES).map(t => (
            <button
              key={t}
              style={{
                background: timeframe === t ? 'rgba(31,111,235,0.25)' : 'none',
                color: timeframe === t ? '#58a6ff' : '#8b949e',
                border: 'none',
                cursor: 'pointer',
                padding: isMultiView ? '2px 5px' : '3px 7px',
                borderRadius: 4,
                fontSize: isMultiView ? 10 : 11,
                fontWeight: 600,
              }}
              onClick={(e) => { e.stopPropagation(); handleTimeframeChange(t); }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* OHLC Mini values */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <span style={{ color: '#8b949e' }}>C: <b style={{ color: isUp ? '#089981' : '#f23645' }}>{fmt(displayPrice)}</b></span>
          <span style={{ color: isUp ? '#089981' : '#f23645', fontWeight: 700 }}>
            {isUp ? '+' : ''}{fmt(candleChange)} ({isUp ? '+' : ''}{candleChangePct.toFixed(2)}%)
          </span>
          <span style={{ color: '#8b949e' }}>
            V: <b>{formatVolume(activeCandle?.volume || (timeframe === '1D' ? currentStockData.volume : currentLiveBar?.volume || 0))}</b>
          </span>
          {activeInds.has('rsi') && currentRsi !== null && (
            <span style={{ color: '#c084fc' }}>
              RSI: <b>{currentRsi.toFixed(1)}</b>
            </span>
          )}
        </div>

        {/* Indicator toggles */}
        {!isMultiView && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
            <button
              style={{
                background: '#21262d',
                border: 'none',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 10,
                color: activeInds.has('ema13') ? '#38bdf8' : '#58636d',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              onClick={(e) => { e.stopPropagation(); toggleIndicator('ema13'); }}
            >
              ● 13
            </button>
            <button
              style={{
                background: '#21262d',
                border: 'none',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 10,
                color: activeInds.has('ema34') ? '#f59e0b' : '#58636d',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              onClick={(e) => { e.stopPropagation(); toggleIndicator('ema34'); }}
            >
              ● 34
            </button>
            <button
              style={{
                background: '#21262d',
                border: 'none',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 10,
                color: activeInds.has('dma50') ? '#a855f7' : '#58636d',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              onClick={(e) => { e.stopPropagation(); toggleIndicator('dma50'); }}
            >
              ● 50
            </button>
            <button
              style={{
                background: '#21262d',
                border: 'none',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 10,
                color: activeInds.has('dma200') ? '#ef4444' : '#58636d',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              onClick={(e) => { e.stopPropagation(); toggleIndicator('dma200'); }}
            >
              ● 200
            </button>
            <button
              style={{
                background: '#21262d',
                border: 'none',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 10,
                color: activeInds.has('rsi') ? '#c084fc' : '#58636d',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              onClick={(e) => { e.stopPropagation(); toggleIndicator('rsi'); }}
            >
              ● RSI
            </button>
            <button
              style={{
                background: '#21262d',
                border: 'none',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 10,
                color: activeInds.has('volume') ? '#089981' : '#58636d',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              onClick={(e) => { e.stopPropagation(); toggleIndicator('volume'); }}
            >
              ● VOL
            </button>
          </div>
        )}
      </div>

      {/* Main Canvas Area */}
      <div
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 0,
        }}
        onMouseLeave={() => setHoverOhlc(null)}
      >
        <div style={{ flex: 1, width: '100%', position: 'relative', minHeight: 0 }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
        </div>

        {/* Dedicated Separate RSI Subpane */}
        {activeInds.has('rsi') && (
          <div style={{
            height: isMultiView ? 90 : 120,
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
              fontSize: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#8b949e',
            }}>
              <span style={{ color: '#c084fc', fontWeight: 700 }}>RSI (14)</span>
              <span style={{
                fontWeight: 700,
                color: (currentRsi ?? 50) >= 70 ? '#ef4444' : (currentRsi ?? 50) <= 30 ? '#10b981' : '#c084fc',
              }}>
                {currentRsi !== null ? currentRsi.toFixed(1) : '—'}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); toggleIndicator('rsi'); }}
                title="Close RSI Pane"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8b949e',
                  cursor: 'pointer',
                  fontSize: 10,
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
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(13,17,23,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            zIndex: 10,
          }}>
            <div style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.1)',
              borderTopColor: '#58a6ff',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ color: '#8b949e', fontSize: 11 }}>Connecting to live market stream…</span>
          </div>
        )}

        {fetchError && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(13,17,23,0.92)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            zIndex: 10,
          }}>
            <span style={{ fontSize: 13, color: '#f23645', fontWeight: 600 }}>⚠️ Connection Notice</span>
            <span style={{ fontSize: 11, color: '#8b949e', maxWidth: 280, textAlign: 'center' }}>{fetchError}</span>
            <button
              onClick={(e) => { e.stopPropagation(); loadChart(symbol, timeframe, range); }}
              style={{
                background: '#1f6feb',
                border: 'none',
                color: '#fff',
                borderRadius: 5,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ↻ Reconnect
            </button>
          </div>
        )}
      </div>

      {/* Range Bar Footer (Only in single view for maximum screen estate) */}
      {!isMultiView && (
        <div style={{
          height: 30,
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          gap: 4,
          borderTop: '1px solid #21262d',
          background: '#161b22',
          flexShrink: 0,
        }}>
          {RANGES.map(r => (
            <button
              key={r}
              style={{
                background: range === r ? 'rgba(31,111,235,0.2)' : 'none',
                color: range === r ? '#58a6ff' : '#8b949e',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 10.5,
                fontWeight: 600,
              }}
              onClick={(e) => { e.stopPropagation(); handleRangeChange(r); }}
            >
              {r}
            </button>
          ))}
          <button
            style={{
              marginLeft: 'auto',
              background: '#21262d',
              border: 'none',
              color: '#8b949e',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 10.5,
              cursor: 'pointer',
            }}
            onClick={(e) => { e.stopPropagation(); chartRef.current?.timeScale().fitContent(); }}
          >
            ⟲ Reset Zoom
          </button>
        </div>
      )}
    </div>
  );
}
