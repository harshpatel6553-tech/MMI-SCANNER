import React, { useState, useEffect, useCallback } from 'react';
import type { Candle } from './ChartPane';
import {
  executePineScript,
  PINE_TEMPLATES,
  type PineExecutionResult,
} from '../../utils/pineRunner';
import { formatPrice, formatTime } from '../../utils/formatters';
import './PineStudio.css';

interface PineStudioProps {
  candles: Candle[];
  activeSymbol: string;
  activeTimeframe: string;
  onApplyResult: (result: PineExecutionResult | null) => void;
  onClose: () => void;
}

export function PineStudio({
  candles,
  activeSymbol,
  activeTimeframe,
  onApplyResult,
  onClose,
}: PineStudioProps) {
  const [activeTab, setActiveTab] = useState<'editor' | 'tester' | 'logs'>('editor');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(PINE_TEMPLATES[0].id);
  const [scriptCode, setScriptCode] = useState<string>(PINE_TEMPLATES[0].code);
  const [isCompiling, setIsCompiling] = useState(false);
  const [lastResult, setLastResult] = useState<PineExecutionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load last saved script from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mmi_pine_script_custom');
      if (saved) {
        setScriptCode(saved);
        setSelectedTemplateId('custom');
      }
    } catch {
      // ignore
    }
  }, []);

  // Handle template selection
  const handleSelectTemplate = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tId = e.target.value;
    setSelectedTemplateId(tId);
    if (tId === 'custom') return;
    const found = PINE_TEMPLATES.find(t => t.id === tId);
    if (found) {
      setScriptCode(found.code);
      setErrorMessage(null);
    }
  };

  // Run script
  const handleRunScript = useCallback(async () => {
    if (!candles || candles.length === 0) {
      setErrorMessage('No candle data loaded for this chart.');
      return;
    }

    setIsCompiling(true);
    setErrorMessage(null);

    try {
      const result = await executePineScript(scriptCode, candles);
      setLastResult(result);
      if (result.success) {
        onApplyResult(result);
        if (result.strategy && result.strategy.totalTrades > 0) {
          setActiveTab('tester');
        }
      } else {
        setErrorMessage(result.error || 'Execution failed.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || String(err));
    } finally {
      setIsCompiling(false);
    }
  }, [scriptCode, candles, onApplyResult]);

  // Clear script & overlays
  const handleClear = () => {
    setLastResult(null);
    setErrorMessage(null);
    onApplyResult(null);
  };

  // Save script to localStorage
  const handleSave = () => {
    try {
      localStorage.setItem('mmi_pine_script_custom', scriptCode);
      setSelectedTemplateId('custom');
      alert('Pine Script saved to local storage!');
    } catch {
      // ignore
    }
  };

  const strategy = lastResult?.strategy;

  return (
    <div className="pine-studio-drawer">
      {/* Top Header Bar */}
      <div className="pine-studio-header">
        <div className="pine-studio-tabs">
          <button
            className={`pine-tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            <span>📜</span> Pine Editor
          </button>
          <button
            className={`pine-tab-btn ${activeTab === 'tester' ? 'active' : ''}`}
            onClick={() => setActiveTab('tester')}
          >
            <span>📊</span> Strategy Tester
            {strategy && strategy.totalTrades > 0 && (
              <span style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 10,
                background: strategy.netProfit >= 0 ? '#10b981' : '#ef4444',
                color: '#000',
                fontWeight: 700,
              }}>
                {strategy.totalTrades}
              </span>
            )}
          </button>
          <button
            className={`pine-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <span>💻</span> Output & Logs
          </button>
        </div>

        {/* Right Header Actions */}
        <div className="pine-actions">
          <select
            className="pine-template-select"
            value={selectedTemplateId}
            onChange={handleSelectTemplate}
            title="Load Pre-built Pine Script Template"
          >
            <option value="custom">✏️ Custom Pine Script</option>
            <optgroup label="Templates & Strategies">
              {PINE_TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>
                  {t.type === 'strategy' ? '🎯' : '📈'} {t.name}
                </option>
              ))}
            </optgroup>
          </select>

          <button
            className="pine-btn-primary"
            onClick={handleRunScript}
            disabled={isCompiling}
            title="Compile and apply indicator/strategy to active chart"
          >
            {isCompiling ? '⏳ Compiling...' : '▶ Apply to Chart'}
          </button>

          <button
            className="pine-btn-secondary"
            onClick={handleSave}
            title="Save script to browser storage"
          >
            💾 Save
          </button>

          <button
            className="pine-btn-secondary"
            onClick={handleClear}
            title="Remove all Pine plots and markers from chart"
          >
            ✕ Reset
          </button>

          <button
            className="pine-close-btn"
            onClick={onClose}
            title="Close Pine Script Studio"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="pine-body">
        {/* TAB 1: PINE SCRIPT EDITOR */}
        {activeTab === 'editor' && (
          <div className="pine-editor-container">
            <textarea
              className="pine-editor-textarea"
              value={scriptCode}
              onChange={(e) => {
                setScriptCode(e.target.value);
                if (selectedTemplateId !== 'custom') {
                  setSelectedTemplateId('custom');
                }
              }}
              spellCheck={false}
              placeholder="// Paste or write your Pine Script (v5/v6) here..."
            />
            {errorMessage && (
              <div className="pine-error-banner">
                <span>⚠️ {errorMessage}</span>
                <button
                  style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer' }}
                  onClick={() => setErrorMessage(null)}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STRATEGY TESTER */}
        {activeTab === 'tester' && (
          <div className="pine-tester-container">
            {!strategy ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: '#8b949e', fontSize: 13 }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>🎯</div>
                <strong>No Strategy Backtest Results Yet</strong>
                <p style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
                  Use a <code>strategy(...)</code> script and click <strong>Apply to Chart</strong> to run full historical backtesting on {activeSymbol} ({activeTimeframe}).
                </p>
              </div>
            ) : (
              <>
                {/* Scorecards */}
                <div className="pine-scorecards-grid">
                  <div className="pine-card">
                    <span className="pine-card-label">Net Profit</span>
                    <span className={`pine-card-value ${strategy.netProfit >= 0 ? 'green' : 'red'}`}>
                      {strategy.netProfit >= 0 ? '+' : ''}₹{strategy.netProfit.toLocaleString('en-IN')}
                      <span style={{ fontSize: 11, marginLeft: 4 }}>
                        ({strategy.netProfitPercent >= 0 ? '+' : ''}{strategy.netProfitPercent.toFixed(2)}%)
                      </span>
                    </span>
                  </div>

                  <div className="pine-card">
                    <span className="pine-card-label">Win Rate</span>
                    <span className="pine-card-value">
                      {strategy.winRate.toFixed(1)}%
                    </span>
                  </div>

                  <div className="pine-card">
                    <span className="pine-card-label">Total Trades</span>
                    <span className="pine-card-value">
                      {strategy.totalTrades}
                      <span style={{ fontSize: 10, color: '#8b949e', marginLeft: 6 }}>
                        ({strategy.winTrades}W / {strategy.lossTrades}L)
                      </span>
                    </span>
                  </div>

                  <div className="pine-card">
                    <span className="pine-card-label">Profit Factor</span>
                    <span className="pine-card-value">
                      {strategy.profitFactor >= 999 ? '∞' : strategy.profitFactor.toFixed(2)}
                    </span>
                  </div>

                  <div className="pine-card">
                    <span className="pine-card-label">Max Drawdown</span>
                    <span className="pine-card-value red">
                      {strategy.maxDrawdown.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Trade History Table */}
                <div className="pine-trades-table-wrap">
                  <table className="pine-trades-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Type</th>
                        <th>Entry Time</th>
                        <th>Entry Price</th>
                        <th>Exit Time</th>
                        <th>Exit Price</th>
                        <th>Profit / Loss</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {strategy.trades.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '16px', color: '#6e7681' }}>
                            No trades triggered in the current historical window.
                          </td>
                        </tr>
                      ) : (
                        strategy.trades.map((trade, idx) => (
                          <tr key={trade.id || idx}>
                            <td>{idx + 1}</td>
                            <td>
                              <span style={{
                                color: trade.entryId.toLowerCase().includes('short') ? '#ef4444' : '#10b981',
                                fontWeight: 600,
                              }}>
                                {trade.entryId}
                              </span>
                            </td>
                            <td>{formatTime(new Date(trade.entryTime * 1000).toISOString())}</td>
                            <td>₹{trade.entryPrice.toFixed(2)}</td>
                            <td>
                              {trade.exitTime
                                ? formatTime(new Date(trade.exitTime * 1000).toISOString())
                                : '—'}
                            </td>
                            <td>{trade.exitPrice ? `₹${trade.exitPrice.toFixed(2)}` : '—'}</td>
                            <td style={{
                              fontWeight: 700,
                              color: (trade.profit ?? 0) >= 0 ? '#10b981' : '#ef4444',
                            }}>
                              {trade.profit !== undefined ? (
                                <>
                                  {(trade.profit >= 0 ? '+' : '')}₹{trade.profit.toFixed(2)}{' '}
                                  <span style={{ fontSize: 10, opacity: 0.8 }}>
                                    ({trade.profitPercent !== undefined && trade.profitPercent >= 0 ? '+' : ''}{trade.profitPercent}%)
                                  </span>
                                </>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td>
                              <span style={{
                                fontSize: 9,
                                padding: '2px 5px',
                                borderRadius: 3,
                                background: trade.status === 'open' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                                color: trade.status === 'open' ? '#60a5fa' : '#8b949e',
                                textTransform: 'uppercase',
                              }}>
                                {trade.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: CONSOLE & LOGS */}
        {activeTab === 'logs' && (
          <div className="pine-console-container">
            {(!lastResult || lastResult.logs.length === 0) ? (
              <div style={{ color: '#484f58' }}>// Console output will appear here after execution...</div>
            ) : (
              lastResult.logs.map((line, i) => (
                <div key={i} className={`pine-log-entry ${line.toLowerCase().includes('error') ? 'error' : ''}`}>
                  [{new Date().toLocaleTimeString('en-IN')}] {line}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
