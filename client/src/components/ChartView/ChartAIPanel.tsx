import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Candle } from './ChartPane';
import './ChartAIPanel.css';

function getApiBase(): string {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (typeof window !== 'undefined' && window.location.port === '5173') return 'http://localhost:5000';
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000';
}

interface TradeSetup {
  bias: string;
  reasoning?: string;
  entry: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskReward: number;
  confidence: number;
}

interface FVG {
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  time: number;
}

interface BacktestResult {
  total: number;
  wins: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  verdict?: string;
}

interface ChartAnalysis {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  trend: string;
  structure?: string;
  emaAlignment?: string;
  emaSignal?: string;
  rsiSignal: string;
  rsiValue?: number;
  macdSignal: string;
  macdHistogram?: number;
  supports?: number[];
  keySupports?: number[];
  resistances?: number[];
  keyResistances?: number[];
  fvgs?: FVG[];
  fvgInsight?: string;
  tradeSetup?: TradeSetup;
  backtest?: BacktestResult;
  summary?: string;
}

interface ChartAIPanelProps {
  candles: Candle[];
  symbol: string;
  timeframe: string;
  isOpen: boolean;
  onToggle: () => void;
}

function fmt(v: number | undefined | null, dec = 2): string {
  if (v == null || isNaN(v)) return '-';
  return v.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function ChartAIPanel({ candles, symbol, timeframe, isOpen, onToggle }: ChartAIPanelProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ChartAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'gemini' | 'local' | null>(null);

  const runAnalysis = useCallback(async () => {
    if (candles.length < 10) {
      setError('Need at least 10 historical candles loaded on the chart to analyze.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBase()}/api/ai/chart-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          timeframe,
          candles: candles.slice(-120),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Chart analysis failed');
      }

      setAnalysis(data.analysis);
      setSource(data.source as 'gemini' | 'local');
    } catch (err: any) {
      setError(err.message || 'Failed to execute chart intelligence analysis');
    } finally {
      setLoading(false);
    }
  }, [candles, symbol, timeframe]);

  const trend = analysis?.trend?.toLowerCase() || '';
  const trendClass = trend.includes('bull') ? 'bullish' : trend.includes('bear') ? 'bearish' : 'neutral';
  const biasClass = (analysis?.tradeSetup?.bias || '').toLowerCase() === 'long'
    ? 'bullish'
    : (analysis?.tradeSetup?.bias || '').toLowerCase() === 'short'
    ? 'bearish'
    : 'neutral';

  const supports    = analysis?.keySupports    || analysis?.supports    || [];
  const resistances = analysis?.keyResistances || analysis?.resistances || [];
  const fvgs        = analysis?.fvgs || [];

  return (
    <div className="chart-ai-panel">
      {/* Header bar */}
      <div className="chart-ai-header" onClick={onToggle}>
        <span className="chart-ai-title">
          <span>🧠 ARIA Chart Quant Analyst</span>
          <span className="chart-ai-badge">AI AGENT</span>
          {source && (
            <span className={`chart-ai-source ${source}`}>
              {source === 'gemini' ? 'GEMINI FLASH' : 'LOCAL ENGINE'}
            </span>
          )}
        </span>

        {loading ? (
          <div className="chart-ai-spinner" style={{ marginLeft: 'auto', marginRight: 8 }} />
        ) : (
          <button
            className="chart-ai-analyze-btn"
            onClick={(e) => {
              e.stopPropagation();
              runAnalysis();
            }}
            disabled={loading || candles.length < 10}
            title={candles.length < 10 ? 'Load candles on chart' : `Analyze ${symbol} (${timeframe})`}
          >
            ⚡ Analyze {symbol}
          </button>
        )}

        <span style={{ color: '#58636d', fontSize: 11, marginLeft: loading ? 0 : 8, flexShrink: 0 }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {/* Expandable Body */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className="chart-ai-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {error && (
              <div style={{ color: '#FF4268', fontSize: 11.5, padding: '6px 10px', background: 'rgba(255, 66, 104, 0.08)', borderRadius: 7, border: '1px solid rgba(255, 66, 104, 0.2)' }}>
                ⚠ {error}
              </div>
            )}

            {!analysis && !error && !loading && (
              <div className="chart-ai-empty">
                <div className="chart-ai-empty-icon">📈</div>
                <div>
                  Click <strong style={{ color: '#28CFFF' }}>⚡ Analyze {symbol}</strong> to generate complete technical telemetry
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  Detects S/R zones, Fair Value Gaps (FVG), EMA/DMA structural flow, MACD crosses, generates recommended entry/exit parameters, and runs automated forward backtesting.
                </div>
              </div>
            )}

            {loading && (
              <div className="chart-ai-empty">
                <div className="chart-ai-spinner" style={{ width: 24, height: 24 }} />
                <div>Computing S/R, Fair Value Gaps, momentum matrices & backtesting historical candles for {symbol}…</div>
              </div>
            )}

            {analysis && !loading && (
              <>
                {/* Row 1: Structural & Momentum Health */}
                <div className="chart-ai-row">
                  <div className="chart-ai-card">
                    <div className="chart-ai-card-label">Market Structure</div>
                    <div className={`chart-ai-card-value ${trendClass}`}>
                      {analysis.trend || '—'}
                    </div>
                    {analysis.structure && (
                      <div style={{ fontSize: 10, color: '#9BAAC0', marginTop: 3, lineHeight: 1.4 }}>
                        {analysis.structure}
                      </div>
                    )}
                  </div>

                  <div className="chart-ai-card">
                    <div className="chart-ai-card-label">RSI (14) Momentum</div>
                    <div className={`chart-ai-card-value ${(analysis.rsiValue ?? 50) >= 70 ? 'bearish' : (analysis.rsiValue ?? 50) <= 30 ? 'bullish' : 'neutral'}`}>
                      {analysis.rsiValue != null ? analysis.rsiValue.toFixed(1) : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: '#9BAAC0', marginTop: 3 }}>
                      {analysis.rsiSignal}
                    </div>
                  </div>

                  <div className="chart-ai-card">
                    <div className="chart-ai-card-label">MACD Dynamics</div>
                    <div className={`chart-ai-card-value ${(analysis.macdHistogram ?? 0) > 0 ? 'bullish' : 'bearish'}`}>
                      {analysis.macdSignal || '—'}
                    </div>
                    {analysis.macdHistogram != null && (
                      <div style={{ fontSize: 10, color: '#9BAAC0', marginTop: 3 }}>
                        Histogram: {analysis.macdHistogram.toFixed(3)}
                      </div>
                    )}
                  </div>

                  {analysis.emaAlignment && (
                    <div className="chart-ai-card">
                      <div className="chart-ai-card-label">EMA / DMA Trend Alignment</div>
                      <div className={`chart-ai-card-value ${analysis.emaAlignment.includes('BULLISH') ? 'bullish' : analysis.emaAlignment.includes('BEARISH') ? 'bearish' : 'neutral'}`} style={{ fontSize: 11.5 }}>
                        {analysis.emaAlignment}
                      </div>
                      {analysis.emaSignal && (
                        <div style={{ fontSize: 10, color: '#9BAAC0', marginTop: 3 }}>
                          {analysis.emaSignal}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Row 2: Support and Resistance Pivots */}
                {(supports.length > 0 || resistances.length > 0) && (
                  <div className="chart-ai-levels">
                    <div className="chart-ai-levels-col">
                      <div className="chart-ai-levels-title support">▲ INSTITUTIONAL SUPPORTS</div>
                      {supports.slice(0, 4).map((s, i) => (
                        <div key={i} className="chart-ai-level-item">
                          <span style={{ color: '#00D6A3' }}>₹{fmt(s)}</span>
                          <span style={{ color: '#64748B', fontSize: 9.5 }}>S{i + 1}</span>
                        </div>
                      ))}
                    </div>
                    <div className="chart-ai-levels-col">
                      <div className="chart-ai-levels-title resistance">▼ OVERHEAD RESISTANCES</div>
                      {resistances.slice(0, 4).map((r, i) => (
                        <div key={i} className="chart-ai-level-item">
                          <span style={{ color: '#FF4268' }}>₹{fmt(r)}</span>
                          <span style={{ color: '#64748B', fontSize: 9.5 }}>R{i + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fair Value Gaps (FVG) / Order Flow */}
                {fvgs.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748B', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>
                      ORDER FLOW: FAIR VALUE GAPS (FVG)
                    </div>
                    <div className="chart-ai-fvg-list">
                      {fvgs.map((fvg, i) => (
                        <div key={i} className={`chart-ai-fvg-item ${fvg.type}`}>
                          <span>{fvg.type === 'bullish' ? '▲ Bullish FVG Imbalance' : '▼ Bearish FVG Imbalance'}</span>
                          <span>₹{fmt(fvg.bottom)} – ₹{fmt(fvg.top)}</span>
                        </div>
                      ))}
                    </div>
                    {analysis.fvgInsight && (
                      <div style={{ fontSize: 10.5, color: '#9BAAC0', marginTop: 5 }}>
                        {analysis.fvgInsight}
                      </div>
                    )}
                  </div>
                )}

                {/* Recommended Trade Setup */}
                {analysis.tradeSetup && (
                  <div
                    className="chart-ai-setup"
                    style={{
                      borderLeftColor: biasClass === 'bullish' ? '#00D6A3' : biasClass === 'bearish' ? '#FF4268' : '#28CFFF',
                    }}
                  >
                    <div className="chart-ai-setup-title">
                      <span>🎯 RECOMMENDED TRADE SETUP</span>
                      <span className={`chart-ai-card-value ${biasClass}`} style={{ fontSize: 12 }}>
                        {analysis.tradeSetup.bias?.toUpperCase()} POSITION
                      </span>
                    </div>

                    {analysis.tradeSetup.reasoning && (
                      <div style={{ fontSize: 11, color: '#9BAAC0', marginBottom: 8, lineHeight: 1.5 }}>
                        {analysis.tradeSetup.reasoning}
                      </div>
                    )}

                    <div className="chart-ai-setup-grid">
                      <div className="chart-ai-setup-item">
                        <span className="chart-ai-setup-label">Ideal Entry</span>
                        <span className="chart-ai-setup-val entry">₹{fmt(analysis.tradeSetup.entry)}</span>
                      </div>
                      <div className="chart-ai-setup-item">
                        <span className="chart-ai-setup-label">Stop Loss</span>
                        <span className="chart-ai-setup-val sl">₹{fmt(analysis.tradeSetup.stopLoss)}</span>
                      </div>
                      <div className="chart-ai-setup-item">
                        <span className="chart-ai-setup-label">Target 1 (1.5R)</span>
                        <span className="chart-ai-setup-val target">₹{fmt(analysis.tradeSetup.target1)}</span>
                      </div>
                      <div className="chart-ai-setup-item">
                        <span className="chart-ai-setup-label">Target 2 (2.8R)</span>
                        <span className="chart-ai-setup-val target">₹{fmt(analysis.tradeSetup.target2)}</span>
                      </div>
                    </div>

                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <span style={{ fontSize: 10.5, color: '#9BAAC0' }}>
                        Risk-to-Reward: <strong style={{ color: '#28CFFF' }}>1 : {analysis.tradeSetup.riskReward}</strong>
                      </span>
                      <div className="chart-ai-confidence">
                        <span>Model Confidence:</span>
                        <div className="chart-ai-confidence-bar" style={{ width: 80 }}>
                          <div className="chart-ai-confidence-fill" style={{ width: `${analysis.tradeSetup.confidence}%` }} />
                        </div>
                        <strong style={{ color: analysis.tradeSetup.confidence >= 70 ? '#00D6A3' : analysis.tradeSetup.confidence >= 50 ? '#f59e0b' : '#FF4268' }}>
                          {analysis.tradeSetup.confidence}%
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Backtesting Simulator Outcome */}
                {analysis.backtest && analysis.backtest.total > 0 && (
                  <div className="chart-ai-backtest">
                    <div className="chart-ai-backtest-title">
                      🔬 QUANT BACKTEST SIMULATION (Sampled over Visible Candles)
                    </div>
                    <div className="chart-ai-backtest-stats">
                      <div className="chart-ai-backtest-stat">
                        <span className="chart-ai-backtest-stat-label">Win Rate</span>
                        <span
                          className="chart-ai-backtest-stat-val"
                          style={{
                            color: analysis.backtest.winRate >= 60 ? '#00D6A3' : analysis.backtest.winRate >= 45 ? '#f59e0b' : '#FF4268',
                          }}
                        >
                          {analysis.backtest.winRate}%
                        </span>
                      </div>
                      <div className="chart-ai-backtest-stat">
                        <span className="chart-ai-backtest-stat-label">Simulated Trades</span>
                        <span className="chart-ai-backtest-stat-val">
                          {analysis.backtest.wins} Wins / {analysis.backtest.total} Setups
                        </span>
                      </div>
                      <div className="chart-ai-backtest-stat">
                        <span className="chart-ai-backtest-stat-label">Average Win</span>
                        <span className="chart-ai-backtest-stat-val" style={{ color: '#00D6A3' }}>
                          +{analysis.backtest.avgWinPct}%
                        </span>
                      </div>
                      <div className="chart-ai-backtest-stat">
                        <span className="chart-ai-backtest-stat-label">Average Risk/Loss</span>
                        <span className="chart-ai-backtest-stat-val" style={{ color: '#FF4268' }}>
                          -{analysis.backtest.avgLossPct}%
                        </span>
                      </div>
                    </div>
                    {analysis.backtest.verdict && (
                      <div style={{ fontSize: 10.5, color: '#9BAAC0', marginTop: 6, fontStyle: 'italic' }}>
                        {analysis.backtest.verdict}
                      </div>
                    )}
                  </div>
                )}

                {/* Plain-English Executive Summary */}
                {analysis.summary && (
                  <div className="chart-ai-summary">
                    {analysis.summary}
                  </div>
                )}

                {/* Regulatory Disclaimer */}
                <div style={{ fontSize: 9.5, color: '#64748B', textAlign: 'center', paddingBottom: 2 }}>
                  ⚠ Algorithmic simulations & AI telemetry are for research and educational purposes only. Always execute with disciplined risk management.
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
