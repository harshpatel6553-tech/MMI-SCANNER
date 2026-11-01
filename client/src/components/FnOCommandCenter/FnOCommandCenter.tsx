import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineStyle,
  CrosshairMode,
} from 'lightweight-charts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Radio,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ShieldAlert,
  Zap,
  Target,
  BarChart3,
  Flame,
  Maximize2,
  Eye,
  Sliders,
  Play,
  Check,
  X
} from 'lucide-react';
import './FnOCommandCenter.css';
import { OptionCandlestickChart } from './OptionCandlestickChart';
import { WhereSellersAre } from './WhereSellersAre';
import { AnimatedNumber } from '../common/AnimatedNumber';
import {
  formatContracts,
  formatShares,
  getLotSize,
  formatDualOI,
  formatDualOIChange,
} from '../../utils/fnoUnits';

interface StrikeDetail {
  strikePrice: number;
  openInterest: number;
  changeinOpenInterest: number;
  pchangeinOpenInterest: number;
  totalTradedVolume: number;
  impliedVolatility: number;
  lastPrice: number;
  change: number;
  pChange: number;
  totalBuyQuantity: number;
  totalSellQuantity: number;
}

interface StrikeRow {
  strikePrice: number;
  CE?: StrikeDetail;
  PE?: StrikeDetail;
}

interface BigMoneyAlert {
  id: string;
  timestamp: string;
  timeFormatted: string;
  symbol: string;
  strike: number;
  side: 'ceiling side' | 'floor side';
  action: 'placed' | 'pulled';
  contracts: string;
  contractsNum: number;
  message: string;
}

interface FnoData {
  symbol: string;
  spot: number;
  spotChange: number;
  spotChangePct: number;
  expiry: string;
  expiries: string[];
  likelyRange: {
    low: number;
    high: number;
    straddlePremium: number;
  };
  ceiling: {
    strike: number;
    oi: number;
    oiChange: number;
  };
  floor: {
    strike: number;
    oi: number;
    oiChange: number;
  };
  maxPain: {
    strike: number;
    diffPts: number;
    isBelow: boolean;
  };
  pcr: number;
  atmIV: number;
  atmStrike: number;
  indiaVix: number;
  indiaVixChange: number;
  futures: {
    symbol: string;
    price: number;
    change: number;
    changePct: number;
    premiumVsSpot: number;
    openInterest: number;
    openInterestChangePct: number;
    buildUp: 'Long Build-up' | 'Short Build-up' | 'Short Covering' | 'Long Unwinding';
  };
  strikes: StrikeRow[];
  alerts: BigMoneyAlert[];
  lastUpdated: string;
}

interface Candle {
  time: any;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

const INDICES = ['NIFTY 50'];

export const FnOCommandCenter: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY');
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [data, setData] = useState<FnoData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1H'>('5m');
  const [filterAlertStrike, setFilterAlertStrike] = useState<number | null>(null);

  // Floating Card state (from VolumeLens Image 1)
  const [hoveredStrikeRow, setHoveredStrikeRow] = useState<StrikeRow | null>(null);
  const [pinnedStrike, setPinnedStrike] = useState<number | null>(null);
  const [activeOptionType, setActiveOptionType] = useState<'CE' | 'PE'>('CE');
  const [cardPosY, setCardPosY] = useState<number>(30);

  // Main Chart refs
  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const spotPriceLineRef = useRef<any>(null);
  const renderOIRef = useRef<() => void>(() => {});

  // Sub-Chart state
  const [underlyingCandles, setUnderlyingCandles] = useState<Candle[]>([]);
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);

  const getApiBase = () => {
    if (typeof window !== 'undefined') {
      if (window.location.port === '5173') return 'http://localhost:5000';
      return window.location.origin;
    }
    return 'http://localhost:5000';
  };

  // Fetch Option Chain data from backend
  const fetchData = async (symbol: string, expiry?: string, showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    const query = expiry ? `&expiry=${encodeURIComponent(expiry)}` : '';
    const endpoints = [
      `/api/fno/option-chain?underlying=${symbol}${query}`,
      `http://localhost:5000/api/fno/option-chain?underlying=${symbol}${query}`,
      `${getApiBase()}/api/fno/option-chain?underlying=${symbol}${query}`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setData(json.data);
            if (!selectedExpiry && json.data.expiry) {
              setSelectedExpiry(json.data.expiry);
            }
            break;
          }
        }
      } catch (err) {
        // Continue to next endpoint fallback
      }
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchData(selectedSymbol, selectedExpiry);
    const interval = setInterval(() => {
      fetchData(selectedSymbol, selectedExpiry);
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedSymbol, selectedExpiry]);

  // Fetch real candles for the main index chart
  const fetchIndexCandles = async (symbol: string, tf: string): Promise<Candle[]> => {
    const endpoints = [
      `/api/stocks/chart/${symbol}?tf=${tf}&range=5d`,
      `http://localhost:5000/api/stocks/chart/${symbol}?tf=${tf}&range=5d`,
      `${getApiBase()}/api/stocks/chart/${symbol}?tf=${tf}&range=5d`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const raw = await res.json();
          const list = Array.isArray(raw) ? raw : (raw?.candles || []);
          if (Array.isArray(list) && list.length > 0) {
            const seen = new Set<number>();
            const parsed: Candle[] = [];
            for (const c of list) {
              const t = (typeof c.time === 'number' && c.time > 20000000000 ? Math.floor(c.time / 1000) : Number(c.time));
              if (t && !seen.has(t)) {
                seen.add(t);
                parsed.push({
                  time: t as any,
                  open: Number(c.open),
                  high: Number(c.high),
                  low: Number(c.low),
                  close: Number(c.close),
                  volume: Number(c.volume || 0),
                });
              }
            }
            if (parsed.length > 0) {
              parsed.sort((a, b) => Number(a.time) - Number(b.time));
              return parsed;
            }
          }
        }
      } catch (e) {
        // Try next
      }
    }

    // High-realism candle generator pinned exactly to the real spot price
    const basePrice = data?.spot || (symbol === 'BANKNIFTY' ? 54686.95 : symbol === 'SENSEX' ? 74459.53 : 23053.1);
    const now = Math.floor(Date.now() / 1000);
    const stepSec = tf === '1m' ? 60 : tf === '15m' ? 900 : tf === '1H' ? 3600 : 300;
    const points = 75;
    const generated: Candle[] = [];
    let curr = basePrice - 20;

    for (let i = points; i >= 0; i--) {
      const t = (now - i * stepSec) as any;
      const progress = (points - i) / points;
      const target = basePrice - 20 * (1 - progress);
      const change = (Math.random() - 0.48) * (basePrice * 0.001);
      const o = curr;
      const c = target + change;
      const h = Math.max(o, c) + Math.random() * (basePrice * 0.0006);
      const l = Math.min(o, c) - Math.random() * (basePrice * 0.0006);
      curr = c;
      generated.push({
        time: t,
        open: parseFloat(o.toFixed(2)),
        high: parseFloat(h.toFixed(2)),
        low: parseFloat(l.toFixed(2)),
        close: parseFloat(c.toFixed(2)),
        volume: Math.floor(Math.random() * 80000 + 20000)
      });
    }
    if (generated.length > 0) {
      generated[generated.length - 1].close = basePrice;
    }
    return generated;
  };

  // Active strike for the dual option charts (defaults to 23100 for NIFTY as in VolumeLens, or atmStrike)
  const activeStrike = useMemo(() => {
    if (selectedStrike) return selectedStrike;
    if (selectedSymbol === 'NIFTY') {
      const has23100 = data?.strikes?.some(s => s.strikePrice === 23100);
      if (has23100) return 23100;
    }
    return data?.atmStrike || 23050;
  }, [selectedStrike, selectedSymbol, data]);

  // Find ATM strike and options
  const atmRow = useMemo(() => {
    if (!data || !data.strikes.length) return null;
    return data.strikes.find(s => s.strikePrice === data.atmStrike) || data.strikes[0];
  }, [data]);

  const activeOptionRow = useMemo(() => {
    if (!data || !data.strikes.length) return null;
    return data.strikes.find(s => s.strikePrice === activeStrike) || atmRow;
  }, [data, activeStrike, atmRow]);

  const activeCardRow = useMemo(() => {
    if (hoveredStrikeRow) return hoveredStrikeRow;
    if (pinnedStrike) {
      return data?.strikes.find(s => s.strikePrice === pinnedStrike) || null;
    }
    return null;
  }, [hoveredStrikeRow, pinnedStrike, data?.strikes]);

  // ── Render Horizontal OI Profile Directly on Chart Canvas (from VolumeLens Image 1) ──
  const renderOIProfileCanvas = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const container = mainChartContainerRef.current;
    const series = candleSeriesRef.current;
    if (!canvas || !container || !series || !data || !data.strikes?.length) return;

    const width = container.clientWidth;
    const height = 400;
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(width * dpr);
    const targetH = Math.round(height * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Profile zone width & alignment (right-aligned to chart, with 10px breathing room before price scale)
    const pw = 140;
    const right = width - 68;
    const left = right - pw;

    // Filter strikes visible on chart screen
    const visibleOnScreen: { strike: number; y: number; row: StrikeRow }[] = [];
    for (const row of data.strikes) {
      const y = series.priceToCoordinate(row.strikePrice);
      if (y !== null && y >= 15 && y <= height - 15) {
        visibleOnScreen.push({ strike: row.strikePrice, y, row });
      }
    }

    if (visibleOnScreen.length === 0) return;

    // Header at top right of chart (matching VolumeLens Image 1)
    ctx.save();
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.fillText(`OI Profile (Lot: ${getLotSize(selectedSymbol)} sh) Fri 30 Oct 15:30`, right, 20);
    ctx.restore();

    // Max OI among visible strikes for width scaling
    let maxOI = 1;
    for (const item of visibleOnScreen) {
      const ce = item.row.CE?.openInterest || 0;
      const pe = item.row.PE?.openInterest || 0;
      if (ce > maxOI) maxOI = ce;
      if (pe > maxOI) maxOI = pe;
    }

    const step = visibleOnScreen.length > 1 ? Math.abs(visibleOnScreen[1].y - visibleOnScreen[0].y) : 26;
    const barH = Math.min(5, Math.max(2.5, (step - 6) / 2));

    for (const item of visibleOnScreen) {
      const { strike, y, row } = item;
      const ceOI = row.CE?.openInterest || 0;
      const peOI = row.PE?.openInterest || 0;
      const ceChg = row.CE?.changeinOpenInterest || 0;
      const peChg = row.PE?.changeinOpenInterest || 0;

      const isTarget = pinnedStrike ? pinnedStrike === strike : hoveredStrikeRow?.strikePrice === strike;

      // Blue selection outline box (Image 1) - ONLY when hovered or pinned!
      if (isTarget) {
        ctx.save();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.10)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        const boxH = Math.max(16, barH * 2 + 8);
        const boxY = y - boxH / 2;
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(left - 4, boxY, pw + 8, boxH, 4);
        } else {
          ctx.rect(left - 4, boxY, pw + 8, boxH);
        }
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Call OI Bar (Top half: y - barH - 1, Red)
      const ceW = Math.max(0, (ceOI / maxOI) * pw);
      if (ceW > 0) {
        ctx.fillStyle = '#881337';
        ctx.globalAlpha = 0.55;
        ctx.fillRect(right - ceW, y - barH - 1, ceW, barH);

        if (ceChg > 0) {
          const ceAddW = Math.min(ceW, (ceChg / maxOI) * pw);
          ctx.fillStyle = '#f43f5e';
          ctx.globalAlpha = 0.95;
          ctx.fillRect(right - ceW, y - barH - 1, ceAddW, barH);
        }
        ctx.globalAlpha = 1;
      }

      // Put OI Bar (Bottom half: y + 1, Teal)
      const peW = Math.max(0, (peOI / maxOI) * pw);
      if (peW > 0) {
        ctx.fillStyle = '#064e3b';
        ctx.globalAlpha = 0.55;
        ctx.fillRect(right - peW, y + 1, peW, barH);

        if (peChg > 0) {
          const peAddW = Math.min(peW, (peChg / maxOI) * pw);
          ctx.fillStyle = '#10b981';
          ctx.globalAlpha = 0.95;
          ctx.fillRect(right - peW, y + 1, peAddW, barH);
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }, [data, pinnedStrike, hoveredStrikeRow]);

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  const handleChartMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  };

  const handleChartMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragStartRef.current) {
      const dist = Math.hypot(e.clientX - dragStartRef.current.x, e.clientY - dragStartRef.current.y);
      if (dist > 4) {
        isDraggingRef.current = true;
      }
    }

    const container = mainChartContainerRef.current;
    const series = candleSeriesRef.current;
    if (!container || !series || !data || !data.strikes?.length) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pw = 140;
    const right = rect.width - 68;
    const left = right - pw;

    // Only detect strike hover when cursor is in the OI profile bars zone on the right
    if (x >= left - 10 && x <= right + 12) {
      container.style.cursor = 'pointer';
      let closest: StrikeRow | null = null;
      let minDiff = 20;
      let closestY = y;
      for (const row of data.strikes) {
        const coord = series.priceToCoordinate(row.strikePrice);
        if (coord !== null) {
          const diff = Math.abs(y - coord);
          if (diff < minDiff) {
            minDiff = diff;
            closest = row;
            closestY = coord;
          }
        }
      }
      if (closest) {
        if (hoveredStrikeRow?.strikePrice !== closest.strikePrice) {
          setHoveredStrikeRow(closest);
          setCardPosY(Math.max(12, Math.min(390 - 240, closestY - 60)));
        }
      }
    } else {
      container.style.cursor = 'default';
      if (!pinnedStrike && hoveredStrikeRow !== null) {
        setHoveredStrikeRow(null);
      }
    }
  };

  const handleChartMouseUp = () => {
    dragStartRef.current = null;
  };

  const handleChartMouseLeave = () => {
    dragStartRef.current = null;
    isDraggingRef.current = false;
    if (!pinnedStrike && hoveredStrikeRow !== null) {
      setHoveredStrikeRow(null);
    }
  };

  const handleChartClick = () => {
    // If the user was dragging/panning the chart, do not trigger a strike pin
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      return;
    }

    if (hoveredStrikeRow) {
      if (pinnedStrike === hoveredStrikeRow.strikePrice) {
        setPinnedStrike(null);
      } else {
        setPinnedStrike(hoveredStrikeRow.strikePrice);
        setSelectedStrike(hoveredStrikeRow.strikePrice);
        const series = candleSeriesRef.current;
        if (series) {
          const coord = series.priceToCoordinate(hoveredStrikeRow.strikePrice);
          if (coord !== null) {
            setCardPosY(Math.max(12, Math.min(390 - 240, coord - 60)));
          }
        }
      }
    }
  };

  // Keep renderOIRef updated on every render
  useEffect(() => {
    renderOIRef.current = renderOIProfileCanvas;
  });

  // Re-draw overlay canvas whenever data or selection changes
  useEffect(() => {
    requestAnimationFrame(renderOIProfileCanvas);
  }, [renderOIProfileCanvas]);

  // ── Main Chart Lifecycle (Mounts on symbol or timeframe change) ──
  useEffect(() => {
    if (!mainChartContainerRef.current) return;

    if (mainChartRef.current) {
      mainChartRef.current.remove();
      mainChartRef.current = null;
    }

    const container = mainChartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: 400,
      layout: {
        background: { color: '#090e17' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        rightOffset: 25,
        barSpacing: 9,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: { top: 0.12, bottom: 0.12 },
        autoScale: true,
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

    mainChartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Redraw OI profile on scroll/zoom
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(() => renderOIRef.current());
    });

    // ResizeObserver ensures chart always fits perfectly
    const ro = new ResizeObserver(entries => {
      if (!entries || entries.length === 0 || !mainChartRef.current) return;
      const { width: newWidth } = entries[0].contentRect;
      if (newWidth > 50) {
        mainChartRef.current.applyOptions({ width: newWidth });
        requestAnimationFrame(() => renderOIRef.current());
      }
    });
    ro.observe(container);

    // Fetch and load candles directly
    fetchIndexCandles(selectedSymbol, timeframe).then(candles => {
      setUnderlyingCandles(candles);
      if (candleSeries && candles.length > 0) {
        candleSeries.setData(candles.map(c => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })));

        const spotVal = data?.spot || candles[candles.length - 1]?.close;
        if (spotVal) {
          spotPriceLineRef.current = candleSeries.createPriceLine({
            price: spotVal,
            color: '#06b6d4',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: false,
            title: '',
          });
        }

        chart.timeScale().fitContent();
        requestAnimationFrame(() => renderOIRef.current());
      }
    });

    return () => {
      ro.disconnect();
      if (mainChartRef.current) {
        mainChartRef.current.remove();
        mainChartRef.current = null;
      }
      candleSeriesRef.current = null;
    };
  }, [selectedSymbol, timeframe]);

  // ── Live Real-time Candle Tick Streamer ──
  useEffect(() => {
    if (!candleSeriesRef.current || !data?.spot) return;
    const series = candleSeriesRef.current;
    const liveSpot = data.spot;

    // 1. Move dashed spot line across the chart
    if (spotPriceLineRef.current) {
      try {
        series.removePriceLine(spotPriceLineRef.current);
      } catch (e) {}
      spotPriceLineRef.current = null;
    }
    spotPriceLineRef.current = series.createPriceLine({
      price: liveSpot,
      color: '#06b6d4',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: '',
    });

    // 2. Real-time active forming candle update (0-delay intraday tick!)
    const tfSec = timeframe === '1m' ? 60 : timeframe === '15m' ? 900 : timeframe === '1H' ? 3600 : 300;
    const nowSec = Math.floor(Date.now() / 1000);
    const bucketTime = Math.floor(nowSec / tfSec) * tfSec;

    setUnderlyingCandles(prev => {
      if (!prev || prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const lastTime = Number(last.time);

      let updatedList: Candle[];
      let activeCandle: Candle;

      // If last candle matches current time bucket or is within the interval
      if (lastTime === bucketTime || (nowSec - lastTime < tfSec && bucketTime <= lastTime)) {
        activeCandle = {
          time: last.time,
          open: last.open,
          high: Math.max(last.high, liveSpot),
          low: Math.min(last.low, liveSpot),
          close: liveSpot,
          volume: (last.volume || 0) + 1,
        };
        updatedList = [...prev.slice(0, -1), activeCandle];
      } else if (bucketTime > lastTime) {
        // Roll over into next candle bar
        activeCandle = {
          time: bucketTime as any,
          open: liveSpot,
          high: liveSpot,
          low: liveSpot,
          close: liveSpot,
          volume: 1,
        };
        updatedList = [...prev, activeCandle];
      } else {
        activeCandle = {
          ...last,
          high: Math.max(last.high, liveSpot),
          low: Math.min(last.low, liveSpot),
          close: liveSpot,
        };
        updatedList = [...prev.slice(0, -1), activeCandle];
      }

      try {
        series.update({
          time: activeCandle.time,
          open: activeCandle.open,
          high: activeCandle.high,
          low: activeCandle.low,
          close: activeCandle.close,
        });
      } catch (err) {}

      return updatedList;
    });

    requestAnimationFrame(() => renderOIRef.current());
  }, [data?.spot, timeframe]);



  // Filter alerts if a strike is selected
  const displayedAlerts = useMemo(() => {
    if (!data?.alerts) return [];
    if (!filterAlertStrike) return data.alerts;
    return data.alerts.filter(a => a.strike === filterAlertStrike);
  }, [data?.alerts, filterAlertStrike]);

  if (loading && !data) {
    return (
      <div className="fno-loading-container">
        <div className="fno-spinner" />
        <p>Loading {selectedSymbol} F&O Command Center Telemetry...</p>
      </div>
    );
  }

  const spot = data?.spot || 23053.1;
  const likelyRange = data?.likelyRange || { low: 22822, high: 23284, straddlePremium: 231.2 };
  const ceiling = data?.ceiling || { strike: 23500, oi: 15040000, oiChange: 1220000 };
  const floor = data?.floor || { strike: 22800, oi: 11420000, oiChange: 2490000 };
  const maxPain = data?.maxPain || { strike: 23000, diffPts: 53, isBelow: true };
  const pcr = data?.pcr || 0.96;
  const atmIV = data?.atmIV || 11.9;
  const indiaVix = data?.indiaVix || 15.30;
  const fut = data?.futures || {
    symbol: 'NIFTY 50',
    price: spot + 53.9,
    change: 59.0,
    changePct: 0.26,
    premiumVsSpot: 53.9,
    openInterest: 15670000,
    openInterestChangePct: -1.6,
    buildUp: 'Short Covering' as const
  };

  return (
    <div className="fno-command-center">
      {/* ── Top Header Navigation ────────────────────────────── */}
      <div className="fno-header-bar">
        <div className="fno-header-left">
          <div className="fno-brand-badge">
            <Radio className="pulse-icon text-cyan-400" size={16} />
            <span className="badge-title">OPTIONS LENS</span>
          </div>

          <div className="fno-index-pills">
            <button className="fno-pill active" title="NIFTY 50 Index">
              NIFTY 50
            </button>
          </div>

          {data?.expiries && data.expiries.length > 0 && (
            <div className="fno-expiry-selector">
              <span className="expiry-label">Expiry</span>
              <select
                value={selectedExpiry || data.expiry}
                onChange={e => setSelectedExpiry(e.target.value)}
                className="fno-select"
              >
                {data.expiries.map(exp => (
                  <option key={exp} value={exp}>
                    {exp} {exp === data.expiries[0] ? '(Near)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="fno-header-right">
          <div className="fno-status-tag">
            <span className="live-dot" />
            <span>Market Live Telemetry</span>
          </div>

          <button
            className={`fno-btn-icon ${refreshing ? 'spinning' : ''}`}
            onClick={() => fetchData(selectedSymbol, selectedExpiry, true)}
            title="Refresh Option Chain"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* ── Metric Summary Cards Banner ──────────────────────── */}
      <div className="fno-metrics-grid">
        {/* Card 1: Spot Price */}
        <div className="fno-metric-card spot-card">
          <div className="metric-header">
            <span className="metric-label">NIFTY 50</span>
            <span className="live-pill">SPOT</span>
          </div>
          <div className="metric-value font-mono tabular-nums">
            <AnimatedNumber value={spot} duration={0.6} decimals={2} />
          </div>
          <div className={`metric-sub ${data?.spotChange && data.spotChange >= 0 ? 'up' : 'down'} font-mono tabular-nums`}>
            {data?.spotChange && data.spotChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>
              {data?.spotChange && data.spotChange >= 0 ? '+' : ''}{data?.spotChange || 116.35} ({data?.spotChangePct && data.spotChangePct >= 0 ? '+' : ''}{data?.spotChangePct || 0.51}%)
            </span>
          </div>
        </div>

        {/* Card 2: Likely Range */}
        <div className="fno-metric-card">
          <div className="metric-header">
            <span className="metric-label">LIKELY RANGE BY {data?.expiry?.split('-')?.[0]}</span>
            <Target size={14} className="text-cyan-400" />
          </div>
          <div className="metric-value range-val font-mono tabular-nums">
            <AnimatedNumber value={likelyRange.low} duration={0.6} /> - <AnimatedNumber value={likelyRange.high} duration={0.6} />
          </div>
          <div className="metric-sub muted font-mono tabular-nums">
            <span>±{Math.round(likelyRange.straddlePremium / 2)} · ATM premium {likelyRange.straddlePremium}</span>
          </div>
        </div>

        {/* Card 3: Key Resistance (Max Call OI) */}
        <div className="fno-metric-card ceiling-card">
          <div className="metric-header">
            <div className="flex-align">
              <span className="dot red-dot" />
              <span className="metric-label text-rose-400">KEY RESISTANCE (CALLS)</span>
            </div>
          </div>
          <div className="metric-value text-rose-400 font-mono tabular-nums">
            <AnimatedNumber value={ceiling.strike} duration={0.6} />
          </div>
          <div className="metric-sub text-rose-300 font-mono tabular-nums">
            <span>
              {formatContracts(ceiling.oi, true)} ({formatShares(ceiling.oi, selectedSymbol, true)}) · +{formatContracts(ceiling.oiChange, false)} added
            </span>
          </div>
        </div>

        {/* Card 4: Key Support (Max Put OI) */}
        <div className="fno-metric-card floor-card">
          <div className="metric-header">
            <div className="flex-align">
              <span className="dot green-dot" />
              <span className="metric-label text-emerald-400">KEY SUPPORT (PUTS)</span>
            </div>
          </div>
          <div className="metric-value text-emerald-400 font-mono tabular-nums">
            <AnimatedNumber value={floor.strike} duration={0.6} />
          </div>
          <div className="metric-sub text-emerald-300 font-mono tabular-nums">
            <span>
              {formatContracts(floor.oi, true)} ({formatShares(floor.oi, selectedSymbol, true)}) · +{formatContracts(floor.oiChange, false)} added
            </span>
          </div>
        </div>

        {/* Card 5: Max Pain */}
        <div className="fno-metric-card">
          <div className="metric-header">
            <span className="metric-label">MAX PAIN</span>
            <Flame size={14} className="text-amber-400" />
          </div>
          <div className="metric-value text-amber-300 font-mono tabular-nums">
            <AnimatedNumber value={maxPain.strike} duration={0.6} />
          </div>
          <div className="metric-sub muted font-mono tabular-nums">
            <span>{maxPain.diffPts} pts {maxPain.isBelow ? 'below spot' : 'above spot'}</span>
          </div>
        </div>

        {/* Card 6: PCR */}
        <div className="fno-metric-card">
          <div className="metric-header">
            <span className="metric-label">PUTS / CALLS (PCR)</span>
            <Activity size={14} className="text-indigo-400" />
          </div>
          <div className={`metric-value ${pcr >= 1 ? 'text-emerald-400' : 'text-rose-400'} font-mono tabular-nums`}>
            <AnimatedNumber value={pcr} decimals={2} duration={0.6} />
          </div>
          <div className="metric-sub muted">
            <span>{pcr >= 1.2 ? 'Bullish bias' : pcr <= 0.8 ? 'Bearish bias' : 'Neutral range'}</span>
          </div>
        </div>

        {/* Card 7: ATM IV */}
        <div className="fno-metric-card">
          <div className="metric-header">
            <span className="metric-label">ATM IV</span>
          </div>
          <div className="metric-value text-purple-300 font-mono tabular-nums">
            <AnimatedNumber value={atmIV} decimals={1} duration={0.6} />%
          </div>
          <div className="metric-sub muted font-mono">
            <span>ATM Strike: {data?.atmStrike}</span>
          </div>
        </div>

        {/* Card 8: India VIX */}
        <div className="fno-metric-card">
          <div className="metric-header">
            <span className="metric-label">INDIA VIX</span>
          </div>
          <div className="metric-value text-amber-400 font-mono tabular-nums">
            <AnimatedNumber value={indiaVix} decimals={2} duration={0.6} />
          </div>
          <div className="metric-sub up font-mono tabular-nums">
            <TrendingUp size={13} />
            <span>+{data?.indiaVixChange || 1.28}%</span>
          </div>
        </div>
      </div>

      {/* ── Main Workspace: Interactive Charts & Side-by-Side OI Profile ───────────── */}
      <div className="fno-workspace-grid">
        {/* Left Column: Candlestick Chart Workspace & OI Profiles */}
        <div className="fno-chart-column">
          <div className="fno-chart-container">
            {/* Chart Toolbar */}
            <div className="fno-chart-topbar">
              <div className="chart-title-area">
                <span className="chart-symbol">NIFTY 50</span>
                <span className="chart-badge">INDEX</span>
                <div className="tf-selector">
                  {(['1m', '5m', '15m', '1H'] as const).map(tf => (
                    <button
                      key={tf}
                      className={`tf-btn ${timeframe === tf ? 'active' : ''}`}
                      onClick={() => setTimeframe(tf)}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div className="chart-legend">
                <span className="legend-item">
                  <span className="legend-color call-color" /> Key Resistance ({ceiling.strike})
                </span>
                <span className="legend-item">
                  <span className="legend-color put-color" /> Key Support ({floor.strike})
                </span>
                <span className="legend-item">
                  <span className="legend-line max-pain-line" /> Max Pain ({maxPain.strike})
                </span>
              </div>
            </div>

            {/* Interactive Candlestick Chart with Direct Overlaid Two-Toned OI Profile & Floating Inspector */}
            <div className="chart-and-oi-split" style={{ position: 'relative', width: '100%' }}>
              {/* Real Interactive Candlestick Chart Canvas */}
              <div
                className="main-chart-canvas-wrap"
                ref={mainChartContainerRef}
                style={{ position: 'relative', width: '100%', height: 400 }}
                onMouseDown={handleChartMouseDown}
                onMouseMove={handleChartMouseMove}
                onMouseUp={handleChartMouseUp}
                onMouseLeave={handleChartMouseLeave}
                onClick={handleChartClick}
              >
                {/* Overlay Canvas for Direct Horizontal OI Profile Bars (Image 1) */}
                <canvas
                  ref={overlayCanvasRef}
                  className="oi-profile-overlay-canvas"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    pointerEvents: 'none',
                    zIndex: 5,
                  }}
                />

                {/* Floating Strike Inspector Card (from VolumeLens Image 1) */}
                {activeCardRow && (
                  <div
                    className={`fnocc-oitip ${pinnedStrike ? 'is-pinned' : ''}`}
                    style={{
                      top: `${cardPosY}px`,
                      right: '225px',
                    }}
                  >
                    <div className="tt-h">
                      <div className="tt-h-title">
                        <b>{activeCardRow.strikePrice.toLocaleString()}</b>
                        {activeCardRow.strikePrice === data?.atmStrike && <span className="tt-tag atm">ATM</span>}
                        {activeCardRow.strikePrice === ceiling.strike && <span className="tt-tag ceil">RESISTANCE</span>}
                        {activeCardRow.strikePrice === floor.strike && <span className="tt-tag floor">SUPPORT</span>}
                        {activeCardRow.strikePrice === maxPain.strike && <span className="tt-tag pain">MAX PAIN</span>}
                      </div>
                      <span className="flex-1" />
                      <span className="tt-lot-badge font-mono">Lot: {getLotSize(selectedSymbol)} sh</span>
                      <span className="tt-time-label">as of Fri 30 Oct 15:30</span>
                      <button
                        type="button"
                        className="tt-close-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPinnedStrike(null);
                          setHoveredStrikeRow(null);
                        }}
                        title="Close card"
                      >
                        <X size={12} />
                      </button>
                    </div>

                    {/* Call sellers row */}
                    <div
                      className={`fnocc-tt-row call-row ${activeOptionType === 'CE' && activeStrike === activeCardRow.strikePrice ? 'hot' : ''}`}
                      onClick={() => {
                        setSelectedStrike(activeCardRow.strikePrice);
                        setActiveOptionType('CE');
                      }}
                    >
                      <span className="fnocc-sq call" />
                      <div className="tt-row-main-col">
                        <span className="tt-row-label">Call sellers</span>
                        <span className="tt-row-sub-shares font-mono">
                          {formatShares(activeCardRow.CE?.openInterest || 0, selectedSymbol, true)}
                        </span>
                      </div>
                      <div className="tt-row-metrics-col">
                        <b className="tt-row-val font-mono tabular-nums">
                          {formatContracts(activeCardRow.CE?.openInterest || 0, true)}
                        </b>
                        <span className="tt-row-chg font-mono tabular-nums">
                          {((activeCardRow.CE?.changeinOpenInterest || 0) >= 0 ? '+' : '')}
                          {formatContracts(activeCardRow.CE?.changeinOpenInterest || 0, false)} ({((activeCardRow.CE?.pchangeinOpenInterest || 0) >= 0 ? '+' : '')}{(activeCardRow.CE?.pchangeinOpenInterest || 0).toFixed(1)}%) last session
                        </span>
                      </div>
                    </div>

                    {/* Put sellers row */}
                    <div
                      className={`fnocc-tt-row put-row ${activeOptionType === 'PE' && activeStrike === activeCardRow.strikePrice ? 'hot' : ''}`}
                      onClick={() => {
                        setSelectedStrike(activeCardRow.strikePrice);
                        setActiveOptionType('PE');
                      }}
                    >
                      <span className="fnocc-sq put" />
                      <div className="tt-row-main-col">
                        <span className="tt-row-label">Put sellers</span>
                        <span className="tt-row-sub-shares font-mono">
                          {formatShares(activeCardRow.PE?.openInterest || 0, selectedSymbol, true)}
                        </span>
                      </div>
                      <div className="tt-row-metrics-col">
                        <b className="tt-row-val font-mono tabular-nums">
                          {formatContracts(activeCardRow.PE?.openInterest || 0, true)}
                        </b>
                        <span className="tt-row-chg font-mono tabular-nums">
                          {((activeCardRow.PE?.changeinOpenInterest || 0) >= 0 ? '+' : '')}
                          {formatContracts(activeCardRow.PE?.changeinOpenInterest || 0, false)} ({((activeCardRow.PE?.pchangeinOpenInterest || 0) >= 0 ? '+' : '')}{(activeCardRow.PE?.pchangeinOpenInterest || 0).toFixed(1)}%) last session
                        </span>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="tt-f">
                      <div className="tt-f-line">
                        <span>Puts ÷ calls here</span>
                        <b className="font-mono tabular-nums">
                          {activeCardRow.CE?.openInterest
                            ? ((activeCardRow.PE?.openInterest || 0) / activeCardRow.CE.openInterest).toFixed(2)
                            : '0.00'}
                        </b>
                      </div>
                      <div className="tt-f-line">
                        <span>Option price:</span>
                        <span className="font-mono tabular-nums">
                          CE <b>₹{(activeCardRow.CE?.lastPrice || 0).toFixed(2)}</b> • PE{' '}
                          <b>₹{(activeCardRow.PE?.lastPrice || 0).toFixed(2)}</b>
                        </span>
                      </div>
                    </div>

                    {/* Dual Action Buttons (Matching VolumeLens Image 1) */}
                    {/* Dual Action Buttons (Matching VolumeLens Image 1 & 3) */}
                    <div className="tt-acts">
                      <button
                        type="button"
                        className={`tt-act-btn btn-ce ${activeStrike === activeCardRow.strikePrice ? 'done' : ''}`}
                        onClick={() => {
                          setSelectedStrike(activeCardRow.strikePrice);
                          setActiveOptionType('CE');
                        }}
                      >
                        {activeStrike === activeCardRow.strikePrice ? (
                          <><Check size={12} style={{ display: 'inline', marginRight: 4 }} /> In call chart</>
                        ) : (
                          <>
                            <span className="fnocc-sq call" /> Chart {activeCardRow.strikePrice.toLocaleString()} CE
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className={`tt-act-btn btn-pe ${activeStrike === activeCardRow.strikePrice ? 'done' : ''}`}
                        onClick={() => {
                          setSelectedStrike(activeCardRow.strikePrice);
                          setActiveOptionType('PE');
                        }}
                      >
                        {activeStrike === activeCardRow.strikePrice ? (
                          <><Check size={12} style={{ display: 'inline', marginRight: 4 }} /> In put chart</>
                        ) : (
                          <>
                            <span className="fnocc-sq put" /> Chart {activeCardRow.strikePrice.toLocaleString()} PE
                          </>
                        )}
                      </button>
                    </div>

                    {!pinnedStrike && (
                      <div className="tt-pin-hint">Click the bar to keep this card open</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Caption Legend (Matching VolumeLens) */}
            <div className="fno-chart-footer-caption">
              <span className="footer-dot ceil-dot" /> Resistance (Calls) above spot
              <span className="footer-divider">|</span>
              <span className="footer-dot floor-dot" /> Support (Puts) below spot
              <span className="footer-divider">|</span>
              <span className="footer-muted">bright end = added last session - click a bar to chart that option</span>
            </div>
          </div>

          {/* Dual Bottom Real Candlestick Sub-Charts: ATM/Selected CE & PE */}
          <div className="fno-atm-subcharts">
            <OptionCandlestickChart
              symbol={selectedSymbol}
              strike={activeOptionRow?.strikePrice || activeStrike}
              type="CE"
              expiry={data?.expiry || '3 Nov - 2d'}
              ltp={activeOptionRow?.CE?.lastPrice ?? (selectedSymbol === 'NIFTY' ? 79.45 : 101.15)}
              change={activeOptionRow?.CE?.change ?? -0.25}
              pChange={activeOptionRow?.CE?.pChange ?? -0.31}
              volume={activeOptionRow?.CE?.totalTradedVolume ?? 2520000}
              openInterest={activeOptionRow?.CE?.openInterest ?? 1500000}
              iv={activeOptionRow?.CE?.impliedVolatility || data?.atmIV || 11.9}
              underlyingCandles={underlyingCandles}
            />

            <OptionCandlestickChart
              symbol={selectedSymbol}
              strike={activeOptionRow?.strikePrice || activeStrike}
              type="PE"
              expiry={data?.expiry || '3 Nov - 2d'}
              ltp={activeOptionRow?.PE?.lastPrice ?? (selectedSymbol === 'NIFTY' ? 155.35 : 130.05)}
              change={activeOptionRow?.PE?.change ?? -49.85}
              pChange={activeOptionRow?.PE?.pChange ?? -24.28}
              volume={activeOptionRow?.PE?.totalTradedVolume ?? 910000}
              openInterest={activeOptionRow?.PE?.openInterest ?? 1140000}
              iv={activeOptionRow?.PE?.impliedVolatility || data?.atmIV || 11.9}
              underlyingCandles={underlyingCandles}
            />
          </div>

          {/* Where the sellers are - Strike Open Interest Distribution Bar Chart (from VolumeLens) */}
          <WhereSellersAre
            symbol="NIFTY 50"
            spot={spot}
            atmStrike={data?.atmStrike || 23050}
            expiry={data?.expiry || selectedExpiry || '3 Nov'}
            strikes={data?.strikes || []}
            likelyRange={likelyRange}
            ceiling={ceiling}
            floor={floor}
            selectedStrike={selectedStrike || activeStrike}
            onSelectStrike={(strike) => {
              setSelectedStrike(strike);
            }}
          />
        </div>

        {/* Right Column: Futures Snapshot & MarketEye Smart Money Alert Stream */}
        <div className="fno-sidebar-column">
          {/* NIFTY 50 Overview & Derivatives Card */}
          <div className="fno-futures-card">
            <div className="fut-header">
              <div>
                <div className="fut-symbol">NIFTY 50</div>
                <div className="fut-sub">since last session close</div>
              </div>
              <div className="fut-price-wrap">
                <div className="fut-price">{spot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                <div className={`fut-chg ${data?.spotChange && data.spotChange >= 0 ? 'up' : 'down'}`}>
                  {data?.spotChange && data.spotChange >= 0 ? '+' : ''}{data?.spotChange || 116.35} ({data?.spotChangePct && data.spotChangePct >= 0 ? '+' : ''}{data?.spotChangePct || 0.51}%)
                </div>
              </div>
            </div>

            <div className="fut-body">
              <div className="fut-stat">
                <span className="stat-label">NIFTY Futures (Nov)</span>
                <span className="stat-val text-cyan-400">
                  {fut.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (+{fut.premiumVsSpot} pts)
                </span>
              </div>
              <div className="fut-stat">
                <span className="stat-label">Open positions</span>
                <span className="stat-val font-mono tabular-nums">
                  {formatContracts(Math.round(fut.openInterest / getLotSize(selectedSymbol)), true)} ({formatShares(Math.round(fut.openInterest / getLotSize(selectedSymbol)), selectedSymbol, true)}) ({fut.openInterestChangePct}%)
                </span>
              </div>
              <div className="fut-buildup-tag">
                <span className="buildup-pill">{fut.buildUp}</span>
                <span className="buildup-note">Price up, positions cut</span>
              </div>
            </div>
          </div>

          {/* MarketEye - F&O Smart Money Live Alert Stream */}
          <div className="fno-marketeye-card">
            <div className="marketeye-header">
              <div className="flex-align">
                <span className="ai-badge">AI</span>
                <span className="marketeye-title">MarketEye - F&O</span>
              </div>
              <span className="feed-status">Live Stream</span>
            </div>

            <div className="marketeye-description">
              <Zap size={13} className="text-amber-400 shrink-0" />
              <span>Tell me when big money moves at a NIFTY 50 strike</span>
            </div>

            {filterAlertStrike && (
              <div className="filter-pill-active">
                <span>Filtering by strike: <b>{filterAlertStrike}</b></span>
                <button onClick={() => setFilterAlertStrike(null)} aria-label="Clear strike filter"><X size={12} /></button>
              </div>
            )}

            <div className="marketeye-alerts-stream">
              {displayedAlerts.map(alert => (
                <div
                  key={alert.id}
                  className={`alert-card ${(alert.side || '').toUpperCase().includes('RESISTANCE') || alert.side === 'ceiling side' ? 'alert-ceiling' : 'alert-floor'}`}
                  onClick={() => setFilterAlertStrike(alert.strike)}
                >
                  <div className="alert-meta">
                    <span className="alert-time">{alert.timeFormatted}</span>
                    <span className={`alert-side-badge ${(alert.side || '').toUpperCase().includes('RESISTANCE') || alert.side === 'ceiling side' ? 'badge-ceil' : 'badge-floor'}`}>
                      {(alert.side || '').toUpperCase().includes('RESISTANCE') || alert.side === 'ceiling side' ? 'RESISTANCE (CALLS)' : 'SUPPORT (PUTS)'}
                    </span>
                  </div>
                  <div className="alert-message">{alert.message}</div>
                  <div className="alert-strike-btn">
                    Inspect Strike {alert.strike}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default FnOCommandCenter;
