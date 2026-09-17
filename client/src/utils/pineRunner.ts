import { PineTS } from 'pinets';
import type { Candle } from '../components/ChartView/ChartPane';
import type { LineData, SeriesMarker, Time } from 'lightweight-charts';

export interface PinePlotSeries {
  id: string;
  title: string;
  color: string;
  lineWidth?: number;
  data: LineData[];
}

export interface PineTrade {
  id: string;
  entryId: string;
  entryTime: number;
  entryPrice: number;
  exitTime?: number;
  exitPrice?: number;
  profit?: number;
  profitPercent?: number;
  size: number;
  status: 'open' | 'closed';
}

export interface PineStrategyStats {
  netProfit: number;
  netProfitPercent: number;
  winTrades: number;
  lossTrades: number;
  evenTrades: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  trades: PineTrade[];
}

export interface PineExecutionResult {
  success: boolean;
  error?: string;
  plots: PinePlotSeries[];
  markers: SeriesMarker<Time>[];
  strategy?: PineStrategyStats;
  logs: string[];
}

// ── Built-in Pine Script Presets ──────────────────────────────────────────────

export interface PineTemplate {
  id: string;
  name: string;
  description: string;
  type: 'indicator' | 'strategy';
  code: string;
}

export const PINE_TEMPLATES: PineTemplate[] = [
  {
    id: 'ema-cross-strategy',
    name: 'EMA 9/21 Trend Crossover',
    description: 'Classic trend-following strategy with EMA 9 & EMA 21 crossover signals and backtest scorecard.',
    type: 'strategy',
    code: `//@version=5
strategy("EMA 9/21 Crossover Strategy", overlay=true)

fastEMA = ta.ema(close, 9)
slowEMA = ta.ema(close, 21)

plot(fastEMA, "Fast EMA (9)", color.green)
plot(slowEMA, "Slow EMA (21)", color.red)

longCondition = ta.crossover(fastEMA, slowEMA)
shortCondition = ta.crossunder(fastEMA, slowEMA)

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")
`,
  },
  {
    id: 'supertrend-strategy',
    name: 'Supertrend Trend Rider',
    description: 'ATR-based trend detection indicator with colored trailing stop line and buy/sell signals.',
    type: 'strategy',
    code: `//@version=5
strategy("Supertrend Strategy", overlay=true)

atrPeriod = 10
factor = 3.0

[supertrend, direction] = ta.supertrend(factor, atrPeriod)

plot(direction < 0 ? supertrend : na, "Supertrend Up", color.green)
plot(direction > 0 ? supertrend : na, "Supertrend Down", color.red)

buySignal = ta.change(direction) < 0
sellSignal = ta.change(direction) > 0

if (buySignal)
    strategy.entry("Long", strategy.long)

if (sellSignal)
    strategy.close("Long")
`,
  },
  {
    id: 'rsi-reversal-strategy',
    name: 'RSI 14 Mean Reversion',
    description: 'Buys when RSI crosses above oversold (30) and closes when RSI reaches overbought (70).',
    type: 'strategy',
    code: `//@version=5
strategy("RSI Reversal Strategy", overlay=true)

rsiVal = ta.rsi(close, 14)
ema50 = ta.ema(close, 50)

plot(ema50, "50 EMA Baseline", color.blue)

buySignal = ta.crossover(rsiVal, 30)
sellSignal = ta.crossunder(rsiVal, 70)

if (buySignal)
    strategy.entry("RSI-Buy", strategy.long)

if (sellSignal)
    strategy.close("RSI-Buy")
`,
  },
  {
    id: 'bollinger-breakout',
    name: 'Bollinger Bands Breakout',
    description: 'Upper and Lower standard deviation volatility channel with breakout entries.',
    type: 'strategy',
    code: `//@version=5
strategy("Bollinger Bands Breakout", overlay=true)

[basis, upper, lower] = ta.bb(close, 20, 2)

plot(basis, "Basis (SMA 20)", color.orange)
plot(upper, "Upper Band", color.green)
plot(lower, "Lower Band", color.red)

longCondition = ta.crossover(close, upper)
shortCondition = ta.crossunder(close, basis)

if (longCondition)
    strategy.entry("BB-Long", strategy.long)

if (shortCondition)
    strategy.close("BB-Long")
`,
  },
  {
    id: 'custom-indicator-clean',
    name: 'Multi-EMA Ribbon Indicator',
    description: 'Clean overlay with EMA 9, 21, 55, and 200 for full trend alignment analysis.',
    type: 'indicator',
    code: `//@version=5
indicator("EMA Ribbon", overlay=true)

e9 = ta.ema(close, 9)
e21 = ta.ema(close, 21)
e55 = ta.ema(close, 55)
e200 = ta.ema(close, 200)

plot(e9, "EMA 9", color.green)
plot(e21, "EMA 21", color.teal)
plot(e55, "EMA 55", color.orange)
plot(e200, "EMA 200", color.red)

buy = ta.crossover(e9, e21) and close > e200
plotshape(buy, "Trend Buy", shape.triangleup, location.belowbar, color.green, "BUY")
`,
  },
];

// ── Runner Function ───────────────────────────────────────────────────────────

export async function executePineScript(
  code: string,
  candles: Candle[]
): Promise<PineExecutionResult> {
  const logs: string[] = [];

  if (!candles || candles.length === 0) {
    return {
      success: false,
      error: 'No candle data available to execute script.',
      plots: [],
      markers: [],
      logs: ['Error: Empty candle series.'],
    };
  }

  // Pre-process code: strip leading indentation on line 1 or any tab traps
  const cleanedCode = code.trim();

  // Convert candles to PineTS format:
  // candles have time in seconds (e.g. 1786938300).
  // PineTS expects milliseconds for openTime.
  const pineCandles = candles.map(c => ({
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: Number(c.volume || 0),
    openTime: c.time > 1e11 ? c.time : c.time * 1000,
  }));

  try {
    const startTime = performance.now();
    const pineTS = new PineTS(pineCandles);
    const result = await pineTS.run(cleanedCode);
    const duration = (performance.now() - startTime).toFixed(1);

    logs.push(`Compiled & executed in ${duration}ms across ${pineCandles.length} bars.`);

    // 1. Extract Plots
    const plots: PinePlotSeries[] = [];
    const internalKeys = new Set([
      '__labels__',
      '__lines__',
      '__boxes__',
      '__linefills__',
      '__polylines__',
      '__tables__',
    ]);

    const defaultColors = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];
    let colorIdx = 0;

    const rawPlots = result.plots || {};
    for (const [title, plotObj] of Object.entries(rawPlots)) {
      if (internalKeys.has(title)) continue;
      const plotData = (plotObj as any)?.data;
      if (!Array.isArray(plotData) || plotData.length === 0) continue;

      // Check if this plot is a boolean marker (from plotshape/plotchar) rather than a continuous numeric series
      const isBooleanMarker = plotData.some(
        d => d.value === true || d.value === false || d.options?.shape || d.options?.char
      );
      if (isBooleanMarker) continue;

      const seriesData: LineData[] = [];
      let detectedColor = (plotObj as any)?.options?.color || defaultColors[colorIdx % defaultColors.length];
      colorIdx++;

      for (const pt of plotData) {
        if (pt.value == null || isNaN(pt.value) || typeof pt.value !== 'number') continue;
        const timeInSec = Math.floor(pt.time > 1e11 ? pt.time / 1000 : pt.time);
        seriesData.push({
          time: timeInSec as any,
          value: +pt.value.toFixed(2),
        });
        if (pt.options?.color && typeof pt.options.color === 'string') {
          detectedColor = pt.options.color;
        }
      }

      if (seriesData.length > 0) {
        plots.push({
          id: `pine-plot-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          title,
          color: detectedColor,
          lineWidth: 2,
          data: seriesData,
        });
        logs.push(`Plot "${title}": ${seriesData.length} valid points.`);
      }
    }

    // 2. Extract Markers (from plotshape, plotchar, or strategy entries/exits)
    const markers: SeriesMarker<Time>[] = [];

    // 2a. From shape plots
    for (const [title, plotObj] of Object.entries(rawPlots)) {
      if (internalKeys.has(title)) continue;
      const plotData = (plotObj as any)?.data;
      if (!Array.isArray(plotData)) continue;

      for (const pt of plotData) {
        if (pt.value === true || (pt.value && typeof pt.value === 'object')) {
          const timeInSec = Math.floor(pt.time > 1e11 ? pt.time / 1000 : pt.time);
          const isUp = pt.options?.shape?.includes('up') || title.toLowerCase().includes('buy');
          markers.push({
            time: timeInSec as any,
            position: isUp ? 'belowBar' : 'aboveBar',
            color: pt.options?.color || (isUp ? '#10b981' : '#ef4444'),
            shape: isUp ? 'arrowUp' : 'arrowDown',
            text: pt.options?.text || (isUp ? 'BUY' : 'SELL'),
          });
        }
      }
    }

    // 2b. From Strategy Execution
    let strategyStats: PineStrategyStats | undefined;

    if (result.strategy) {
      const s = result.strategy;
      const closedTradesRaw = s.closedtrades || [];
      const openTradesRaw = s.opentrades || [];

      const initialCapital = s.initial_capital || 100000;
      const netProfit = s.netprofit || 0;
      const netProfitPercent = initialCapital > 0 ? (netProfit / initialCapital) * 100 : 0;
      const winTrades = s.wintrades || 0;
      const lossTrades = s.losstrades || 0;
      const evenTrades = s.eventrades || 0;
      const totalTrades = winTrades + lossTrades + evenTrades;
      const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;

      const grossProfit = s.grossprofit || 0;
      const grossLoss = Math.abs(s.grossloss || 0);
      const profitFactor = grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? 999 : 0;

      const maxDrawdown = Math.abs((s.max_drawdown_percent_value || 0) * 100);

      const trades: PineTrade[] = [];

      for (const t of closedTradesRaw) {
        const entryTimeSec = Math.floor(t.entry_time > 1e11 ? t.entry_time / 1000 : t.entry_time);
        const exitTimeSec = t.exit_time ? Math.floor(t.exit_time > 1e11 ? t.exit_time / 1000 : t.exit_time) : undefined;
        const profit = t.profit || 0;
        const exitPrice = t.exit_price != null ? t.exit_price : t.entry_price;
        const pnlPct = t.entry_price > 0 ? ((exitPrice - t.entry_price) / t.entry_price) * 100 : 0;

        trades.push({
          id: t.id || `trade-${trades.length + 1}`,
          entryId: t.entry_id || 'Long',
          entryTime: entryTimeSec,
          entryPrice: +t.entry_price.toFixed(2),
          exitTime: exitTimeSec,
          exitPrice: t.exit_price ? +t.exit_price.toFixed(2) : undefined,
          profit: +profit.toFixed(2),
          profitPercent: +pnlPct.toFixed(2),
          size: t.size || 1,
          status: 'closed',
        });

        // Add visual strategy markers
        markers.push({
          time: entryTimeSec as any,
          position: 'belowBar',
          color: '#10b981',
          shape: 'arrowUp',
          text: `BUY @ ₹${t.entry_price.toFixed(1)}`,
        });

        if (exitTimeSec) {
          markers.push({
            time: exitTimeSec as any,
            position: 'aboveBar',
            color: profit >= 0 ? '#10b981' : '#ef4444',
            shape: 'arrowDown',
            text: `SELL @ ₹${t.exit_price?.toFixed(1)} (${profit >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`,
          });
        }
      }

      // Add active open trades
      for (const t of openTradesRaw) {
        const entryTimeSec = Math.floor(t.entry_time > 1e11 ? t.entry_time / 1000 : t.entry_time);
        trades.push({
          id: t.id || `open-trade-${trades.length + 1}`,
          entryId: t.entry_id || 'Long',
          entryTime: entryTimeSec,
          entryPrice: +t.entry_price.toFixed(2),
          size: t.size || 1,
          status: 'open',
        });

        markers.push({
          time: entryTimeSec as any,
          position: 'belowBar',
          color: '#3b82f6',
          shape: 'arrowUp',
          text: `OPEN LONG @ ₹${t.entry_price.toFixed(1)}`,
        });
      }

      strategyStats = {
        netProfit: +netProfit.toFixed(2),
        netProfitPercent: +netProfitPercent.toFixed(2),
        winTrades,
        lossTrades,
        evenTrades,
        totalTrades,
        winRate: +winRate.toFixed(1),
        profitFactor,
        maxDrawdown: +maxDrawdown.toFixed(2),
        trades,
      };

      logs.push(`Strategy: ${totalTrades} trades closed (${winTrades}W / ${lossTrades}L), Net P&L: ₹${netProfit.toFixed(2)} (${netProfitPercent.toFixed(2)}%).`);
    }

    // Sort markers by time
    markers.sort((a, b) => Number(a.time) - Number(b.time));

    return {
      success: true,
      plots,
      markers,
      strategy: strategyStats,
      logs,
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logs.push(`Compilation error: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
      plots: [],
      markers: [],
      logs,
    };
  }
}
