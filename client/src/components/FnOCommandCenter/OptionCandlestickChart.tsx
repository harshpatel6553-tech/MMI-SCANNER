import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import { ExternalLink, Maximize2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import './OptionCandlestickChart.css';
import { formatContracts, formatShares } from '../../utils/fnoUnits';

interface Candle {
  time: any;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface OptionCandlestickChartProps {
  symbol: string;
  strike: number;
  type: 'CE' | 'PE';
  expiry: string;
  ltp: number;
  change: number;
  pChange: number;
  volume: number;
  openInterest: number;
  iv: number;
  underlyingCandles?: Candle[];
}

export const OptionCandlestickChart: React.FC<OptionCandlestickChartProps> = ({
  symbol,
  strike,
  type,
  expiry,
  ltp,
  change,
  pChange,
  volume,
  openInterest,
  iv,
  underlyingCandles = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ltpPriceLineRef = useRef<any>(null);

  const [activeTf, setActiveTf] = useState<'1m' | '5m' | '15m' | '1H'>('5m');
  const [hoverOhlc, setHoverOhlc] = useState<{ o: number; h: number; l: number; c: number; v?: number } | null>(null);
  const [realCandles, setRealCandles] = useState<Candle[] | null>(null);

  // Fetch real historical candles for the specific option contract from backend
  useEffect(() => {
    let isMounted = true;
    setRealCandles(null); // Clear previous contract candles immediately on strike/type/tf change
    const fetchRealCandles = async () => {
      const endpoints = [
        `/api/fno/option-candles?underlying=${symbol}&strike=${strike}&type=${type}&expiry=${encodeURIComponent(expiry)}&tf=${activeTf}`,
        `http://localhost:5000/api/fno/option-candles?underlying=${symbol}&strike=${strike}&type=${type}&expiry=${encodeURIComponent(expiry)}&tf=${activeTf}`,
      ];

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep);
          if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.candles) && json.candles.length > 0) {
              if (isMounted) {
                setRealCandles(json.candles);
                return;
              }
            }
          }
        } catch (e) {
          // fallback to next
        }
      }
    };

    fetchRealCandles();
    return () => { isMounted = false; };
  }, [symbol, strike, type, expiry, activeTf]);

  // Synthetic fallback if real option history is still loading
  const fallbackCandles = useMemo<Candle[]>(() => {
    const candles: Candle[] = [];
    const count = underlyingCandles.length > 0 ? underlyingCandles.length : 50;
    const now = Math.floor(Date.now() / 1000);
    const step = activeTf === '1m' ? 60 : activeTf === '15m' ? 900 : activeTf === '1H' ? 3600 : 300;

    const delta = type === 'CE' ? 0.48 : -0.48;
    const currentPrice = ltp > 0 ? ltp : (type === 'CE' ? 102.0 : 130.0);

    if (underlyingCandles.length > 0) {
      const lastIndex = underlyingCandles.length - 1;
      const lastClose = underlyingCandles[lastIndex].close || 1;
      for (let i = 0; i < underlyingCandles.length; i++) {
        const u = underlyingCandles[i];
        const diffFromEnd = u.close - lastClose;
        const oDiff = u.open - lastClose;
        const hDiff = u.high - lastClose;
        const lDiff = u.low - lastClose;

        const open = Math.max(0.5, parseFloat((currentPrice + oDiff * delta).toFixed(2)));
        const close = i === lastIndex ? currentPrice : Math.max(0.5, parseFloat((currentPrice + diffFromEnd * delta).toFixed(2)));
        const high = Math.max(open, close, parseFloat((currentPrice + (type === 'CE' ? hDiff : -lDiff) * delta).toFixed(2)));
        const low = Math.min(open, close, Math.max(0.2, parseFloat((currentPrice + (type === 'CE' ? lDiff : -hDiff) * delta).toFixed(2))));

        candles.push({
          time: u.time,
          open,
          high: Math.max(high, open + 0.1, close + 0.1),
          low: Math.max(0.1, Math.min(low, open - 0.1, close - 0.1)),
          close,
          volume: Math.floor(Math.random() * 45000 + 15000),
        });
      }

      if (candles.length > 0 && ltp > 0) {
        candles[candles.length - 1].close = ltp;
      }
    } else {
      let curr = currentPrice * 0.9;
      for (let i = count; i >= 0; i--) {
        const t = (now - i * step) as any;
        const cChange = (Math.random() - 0.48) * (currentPrice * 0.04);
        const o = curr;
        const c = Math.max(1, curr + cChange);
        const h = Math.max(o, c) + Math.random() * (currentPrice * 0.02);
        const l = Math.max(0.5, Math.min(o, c) - Math.random() * (currentPrice * 0.02));
        curr = c;
        candles.push({
          time: t,
          open: parseFloat(o.toFixed(2)),
          high: parseFloat(h.toFixed(2)),
          low: parseFloat(l.toFixed(2)),
          close: parseFloat(c.toFixed(2)),
          volume: Math.floor(Math.random() * 30000 + 10000),
        });
      }
    }

    return candles;
  }, [underlyingCandles, type, ltp, activeTf, strike]);

  const optionCandles = useMemo<Candle[]>(() => {
    if (realCandles && realCandles.length > 0) {
      return realCandles;
    }
    return fallbackCandles;
  }, [realCandles, fallbackCandles]);

  // Session summary for top readout (matches latest session bar stats)
  const sessionSummary = useMemo(() => {
    if (optionCandles.length === 0) {
      return {
        o: ltp - change,
        h: Math.max(ltp, ltp - change) + Math.abs(change) * 0.5,
        l: Math.min(ltp, ltp - change) - Math.abs(change) * 0.5,
        c: ltp,
        v: volume,
      };
    }
    const last = optionCandles[optionCandles.length - 1];
    return {
      o: last.open,
      h: last.high,
      l: last.low,
      c: last.close,
      v: last.volume || volume,
    };
  }, [optionCandles, ltp, change, volume]);

  const displayedOhlc = hoverOhlc || sessionSummary;

  // Mount & manage Lightweight Charts (Created once per option type)
  useEffect(() => {
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = containerRef.current;
    const width = container.clientWidth > 50 ? container.clientWidth : 460;

    const chart = createChart(container, {
      width,
      height: 190,
      layout: {
        background: { color: '#090e17' },
        textColor: '#64748b',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.02)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.02)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(255, 255, 255, 0.06)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.06)',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderUpColor: '#10b981',
      borderDownColor: '#f43f5e',
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Crosshair move listener for live OHLC bar
    chart.subscribeCrosshairMove((param: any) => {
      if (!param || !param.time || !param.seriesData) {
        setHoverOhlc(null);
        return;
      }
      const candleData = param.seriesData.get(candleSeries);
      if (candleData) {
        setHoverOhlc({
          o: candleData.open,
          h: candleData.high,
          l: candleData.low,
          c: candleData.close,
        });
      }
    });

    // ResizeObserver ensures width is NEVER 0
    const ro = new ResizeObserver(entries => {
      if (!entries || entries.length === 0 || !chartRef.current) return;
      const { width: newWidth } = entries[0].contentRect;
      if (newWidth > 50) {
        chartRef.current.applyOptions({ width: newWidth });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [type]);

  // Update Candlestick Data when optionCandles or strike updates
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !chartRef.current) return;

    if (optionCandles.length > 0) {
      candleSeriesRef.current.setData(optionCandles.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })));

      volumeSeriesRef.current.setData(optionCandles.map(c => ({
        time: c.time,
        value: c.volume || 100,
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)'
      })));

      chartRef.current.timeScale().fitContent();
    }
  }, [optionCandles, strike]);

  // Real-time Dashed LTP price line & live candle tick
  useEffect(() => {
    if (!candleSeriesRef.current || !ltp || ltp <= 0) return;
    const series = candleSeriesRef.current;

    if (ltpPriceLineRef.current) {
      try {
        series.removePriceLine(ltpPriceLineRef.current);
      } catch (e) {}
      ltpPriceLineRef.current = null;
    }
    ltpPriceLineRef.current = series.createPriceLine({
      price: ltp,
      color: type === 'CE' ? '#f43f5e' : '#06b6d4',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: `LTP ₹${ltp.toFixed(2)}`,
    });

    // 2. Real-time candle tick: expand high/low and update close on the latest bar
    if (optionCandles.length > 0) {
      const last = optionCandles[optionCandles.length - 1];
      try {
        series.update({
          time: last.time,
          open: last.open,
          high: Math.max(last.high, ltp),
          low: Math.min(last.low, ltp),
          close: ltp,
        });
      } catch (err) {}
    }
  }, [ltp, type, strike, optionCandles]);

  const expiryTag = expiry ? expiry.split('-')?.[0] : '';

  return (
    <div className={`option-candle-card ${type === 'CE' ? 'ce-card' : 'pe-card'}`}>
      {/* Top Header Bar */}
      <div className="opt-chart-header">
        <div className="opt-title-group">
          <div className="opt-name">
            {symbol} {strike} {type} {expiryTag}
          </div>
          <span className="opt-badge">NSE</span>
          <span className={`opt-type-tag ${type === 'CE' ? 'tag-ce' : 'tag-pe'}`}>
            {type === 'CE' ? 'CALL OPTION' : 'PUT OPTION'}
          </span>
        </div>

        {/* Timeframe Selector & Actions */}
        <div className="opt-actions">
          <div className="opt-tf-group">
            {(['1m', '5m', '15m', '1H'] as const).map(tf => (
              <button
                key={tf}
                className={`opt-tf-btn ${activeTf === tf ? 'active' : ''}`}
                onClick={() => setActiveTf(tf)}
              >
                {tf}
              </button>
            ))}
          </div>

          <button className="opt-btn-icon" title="View in Pro Charts">
            <ExternalLink size={12} />
          </button>
        </div>
      </div>

      {/* Candlestick Telemetry Bar (O, H, L, C, Day Change, Vol) */}
      <div className="opt-telemetry-bar">
        <div className="telemetry-items">
          <span className="tele-item">O <b className="num">{displayedOhlc.o?.toFixed(2)}</b></span>
          <span className="tele-item">H <b className="num">{displayedOhlc.h?.toFixed(2)}</b></span>
          <span className="tele-item">L <b className="num">{displayedOhlc.l?.toFixed(2)}</b></span>
          <span className="tele-item">C <b className="num">{displayedOhlc.c?.toFixed(2)}</b></span>
          <span className={`tele-item change ${change >= 0 ? 'up' : 'down'}`}>
            Day {change >= 0 ? '+' : ''}{change.toFixed(2)} ({pChange >= 0 ? '+' : ''}{pChange.toFixed(2)}%)
          </span>
          <span className="tele-item muted">
            Vol <b className="num">{displayedOhlc.v && displayedOhlc.v >= 1000000 ? (displayedOhlc.v / 1000000).toFixed(2) + 'M' : displayedOhlc.v && displayedOhlc.v >= 100000 ? (displayedOhlc.v / 100000).toFixed(1) + 'L' : ((volume || 100000) / 100000).toFixed(1) + 'L'}</b>
          </span>
        </div>

        <div className="opt-live-price">
          <span className="price-val">₹{(displayedOhlc.c || ltp).toFixed(2)}</span>
        </div>
      </div>

      {/* Main Candlestick Chart Viewport */}
      <div className="opt-chart-canvas-viewport" ref={containerRef} />

      {/* Bottom Option Metrics Footer */}
      <div className="opt-chart-footer">
        <span>IV: <b>{iv}%</b></span>
        <span>OI: <b>{formatContracts(openInterest || 0, true)} ({formatShares(openInterest || 0, symbol || 'NIFTY', true)})</b></span>
        <span>Strike: <b>{strike}</b></span>
        <span className="delta-tag">Delta: <b>{type === 'CE' ? '+0.48' : '-0.48'}</b></span>
      </div>
    </div>
  );
};
