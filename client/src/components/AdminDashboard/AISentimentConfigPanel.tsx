import React, { useState, useEffect } from 'react';
import './AISentimentConfigPanel.css';

interface AISentimentConfig {
  model: string;
  temperature: number;
  sensitivity: 'Aggressive' | 'Balanced' | 'Conservative';
  companyPerspectivePrompt: string;
  indiaMacroLensPrompt: string;
  fallbackHeuristic: boolean;
  hasKey?: boolean;
  maskedKey?: string;
}

interface TestResult {
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  affectedStocks: string[];
  reasoning?: string;
  perspective?: 'Company' | 'IndiaMacro' | 'General';
  confidence?: number;
}

interface TestResponse {
  success: boolean;
  model: string;
  latencyMs: number;
  result: TestResult;
  usedHeuristic: boolean;
  error?: string;
}

const DEFAULT_COMPANY_PROMPT = `Analyze news primarily from the perspective of the affected company's balance sheet, operational revenue, order pipeline, and cash flows:
- BULLISH if: Order wins, earnings beats, capacity expansion, debt reduction, cost efficiencies, favorable litigation/regulatory approvals, or positive forward guidance.
- BEARISH if: Fines, penalties, investigations, plant shutdowns, client losses, executive resignations, accounting discrepancies, downgrades, or margin contraction.
- NEUTRAL only if: Routine procedural announcements with zero financial or directional enterprise value impact.`;

const DEFAULT_INDIA_MACRO_PROMPT = `For global news and macroeconomic developments (e.g., US Federal Reserve, global central banks, crude oil, commodity cycles, geopolitics, forex/USDINR):
- STRICTLY evaluate through the lens of Indian markets (Dalal Street) and Indian equities.
- Examples: 
  * Crude oil price drops -> BULLISH for Indian Oil Marketing Companies (IOC, BPCL), paints (ASIANPAINT, BERGEPAINT), tyres, and overall Indian fiscal deficit.
  * Rising US treasury yields / hawkish Fed -> BEARISH for Indian IT exporters and foreign institutional investment (FII) flows.
  * China economic stimulus/slowdown -> evaluate direct export/import substitution impact on Indian chemicals, steel, and textiles.`;

const PRESETS = [
  { label: '🛢️ Crude Oil Drop (India Macro)', text: 'Crude oil plunges 4.5% following unexpected surge in global inventories' },
  { label: '☀️ Order Win (Company Micro)', text: 'Tata Power bags ₹1,200 Cr EPC order for 400MW solar project' },
  { label: '🏦 US Fed Hawkish (India Macro)', text: 'US Federal Reserve indicates higher-for-longer rates amid persistent wage inflation' },
  { label: '⚖️ SEBI Probe (Company Micro)', text: 'SEBI orders forensic audit of smallcap firm over financial disclosure lapses' },
];

export function AISentimentConfigPanel() {
  const [config, setConfig] = useState<AISentimentConfig>({
    model: 'gemini-3.5-flash',
    temperature: 0.1,
    sensitivity: 'Aggressive',
    companyPerspectivePrompt: DEFAULT_COMPANY_PROMPT,
    indiaMacroLensPrompt: DEFAULT_INDIA_MACRO_PROMPT,
    fallbackHeuristic: true,
  });

  const [newApiKey, setNewApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Live Test State
  const [testHeadline, setTestHeadline] = useState(PRESETS[0].text);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResponse | null>(null);

  const getApiUrl = (endpoint: string) => {
    const base = import.meta.env.VITE_SOCKET_URL || '';
    return base ? `${base}/api${endpoint}` : `/api${endpoint}`;
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch(getApiUrl('/settings/ai-sentiment'));
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to load AI config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);

      const payload: any = {
        model: config.model,
        temperature: config.temperature,
        sensitivity: config.sensitivity,
        companyPerspectivePrompt: config.companyPerspectivePrompt,
        indiaMacroLensPrompt: config.indiaMacroLensPrompt,
        fallbackHeuristic: config.fallbackHeuristic,
      };

      if (newApiKey.trim()) {
        payload.GEMINI_API_KEY = newApiKey.trim();
      }

      const res = await fetch(getApiUrl('/settings/ai-sentiment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setSaveMessage({ text: 'Parameters successfully saved and active in real-time!', type: 'success' });
        setNewApiKey('');
        fetchConfig();
      } else {
        setSaveMessage({ text: data.error || 'Failed to save configuration', type: 'error' });
      }
    } catch (err: any) {
      setSaveMessage({ text: err.message || 'Network error while saving', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const handleRunTest = async () => {
    if (!testHeadline.trim()) return;
    try {
      setTesting(true);
      setTestResult(null);

      const res = await fetch(getApiUrl('/settings/ai-sentiment/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: testHeadline.trim(),
          config: {
            model: config.model,
            temperature: config.temperature,
            sensitivity: config.sensitivity,
            companyPerspectivePrompt: config.companyPerspectivePrompt,
            indiaMacroLensPrompt: config.indiaMacroLensPrompt,
            apiKey: newApiKey.trim() || undefined,
          },
        }),
      });

      const data: TestResponse = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        model: config.model,
        latencyMs: 0,
        result: { sentiment: 'Neutral', affectedStocks: [], reasoning: err.message },
        usedHeuristic: true,
        error: err.message,
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="ai-card" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>Loading AI Sentiment Configuration...</div>
      </div>
    );
  }

  return (
    <div className="ai-config-panel">
      {/* Overview & Model Status Card */}
      <div className="ai-card">
        <div className="ai-card-head">
          <div>
            <div className="ai-card-title">
              <span>🧠</span> AI Sentiment Engine & Parameter Tuning
            </div>
            <div className="ai-card-sub">
              Dual-layer intelligence: Company balance sheet impact + Global-to-India macro lens.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {config.hasKey ? (
              <span className="badge-pill up" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="telemetry-dot live" style={{ width: 8, height: 8 }} />
                <span>Gemini API Connected ({config.maskedKey})</span>
              </span>
            ) : (
              <span className="badge-pill down" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⚠️ Gemini Key Required</span>
              </span>
            )}
          </div>
        </div>

        {/* Engine Parameters Grid */}
        <div className="ai-grid-2">
          {/* Model Selection */}
          <div className="ai-field-group">
            <label className="ai-field-label">AI Model Backend</label>
            <select
              className="ai-select"
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
            >
              <option value="gemini-3.5-flash">Google Gemini 3.5 Flash (Recommended: Production High Accuracy & Speed)</option>
              <option value="gemini-3.8-flash">Google Gemini 3.8 Flash (Latest Flagship Model)</option>
              <option value="gemini-2.5-flash">Google Gemini 2.5 Flash</option>
              <option value="gemini-1.5-flash">Google Gemini 1.5 Flash (Legacy)</option>
            </select>
          </div>

          {/* Sensitivity Calibration */}
          <div className="ai-field-group">
            <label className="ai-field-label">Signal Sensitivity</label>
            <div className="ai-pills">
              {(['Aggressive', 'Balanced', 'Conservative'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`ai-pill-btn ${config.sensitivity === s ? 'active' : ''}`}
                  onClick={() => setConfig({ ...config, sensitivity: s })}
                >
                  {s === 'Aggressive' && '⚡ '}
                  {s === 'Balanced' && '⚖️ '}
                  {s === 'Conservative' && '🛡️ '}
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Temperature Slider */}
          <div className="ai-field-group">
            <div className="ai-field-label">
              <span>Temperature (Determinism vs Randomness)</span>
              <span className="ai-slider-val">{config.temperature.toFixed(2)}</span>
            </div>
            <div className="ai-slider-wrap">
              <input
                type="range"
                className="ai-slider"
                min="0.0"
                max="1.0"
                step="0.05"
                value={config.temperature}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
              />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              0.0 = Purely analytical & deterministic (recommended). 0.7 = More creative associations.
            </span>
          </div>

          {/* Update Gemini API Key */}
          <div className="ai-field-group">
            <label className="ai-field-label">Update Gemini API Key</label>
            <input
              type="password"
              className="ai-input"
              placeholder={config.hasKey ? 'Enter new key to update or leave empty' : 'Enter AIzaSy... key'}
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
            />
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Get a free API key at <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--up)' }}>aistudio.google.com</a>
            </span>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-2)' }}>
            <input
              type="checkbox"
              checked={config.fallbackHeuristic}
              onChange={(e) => setConfig({ ...config, fallbackHeuristic: e.target.checked })}
              style={{ accentColor: 'var(--up)' }}
            />
            <span>Enable Local Keyword Heuristic Fallback if Gemini quota is exceeded</span>
          </label>
        </div>
      </div>

      {/* Perspective Directives Tuning Card */}
      <div className="ai-card">
        <div className="ai-card-head">
          <div>
            <div className="ai-card-title">
              <span>🎯</span> Perspective Analysis Directives
            </div>
            <div className="ai-card-sub">
              Fine-tune how the AI analyzes news from the company's financial perspective and translates global macro news into Indian sector signals.
            </div>
          </div>
        </div>

        <div className="ai-grid-2">
          {/* Directive 1: Company Perspective */}
          <div className="ai-field-group">
            <div className="ai-field-label">
              <span>1. Company Financial Perspective Directive</span>
              <button
                type="button"
                className="ai-preset-chip"
                onClick={() => setConfig({ ...config, companyPerspectivePrompt: DEFAULT_COMPANY_PROMPT })}
              >
                Reset Default
              </button>
            </div>
            <textarea
              className="ai-textarea"
              value={config.companyPerspectivePrompt}
              onChange={(e) => setConfig({ ...config, companyPerspectivePrompt: e.target.value })}
              rows={8}
            />
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Instructs the model how to evaluate order wins, capacity expansion, debt, vs fines, investigations, and margin contraction.
            </span>
          </div>

          {/* Directive 2: Global-to-India Macro Lens */}
          <div className="ai-field-group">
            <div className="ai-field-label">
              <span>2. Global-to-India Macro Lens Directive</span>
              <button
                type="button"
                className="ai-preset-chip"
                onClick={() => setConfig({ ...config, indiaMacroLensPrompt: DEFAULT_INDIA_MACRO_PROMPT })}
              >
                Reset Default
              </button>
            </div>
            <textarea
              className="ai-textarea"
              value={config.indiaMacroLensPrompt}
              onChange={(e) => setConfig({ ...config, indiaMacroLensPrompt: e.target.value })}
              rows={8}
            />
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Instructs the model to evaluate global macroeconomic developments (Fed rates, crude oil, forex) strictly through the lens of Indian markets.
            </span>
          </div>
        </div>

        {/* Save Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, borderTop: '1px solid var(--border-soft)', paddingTop: 16 }}>
          {saveMessage ? (
            <div style={{ color: saveMessage.type === 'success' ? 'var(--up)' : 'var(--down)', fontSize: 13, fontWeight: 600 }}>
              {saveMessage.type === 'success' ? '✓ ' : '✕ '} {saveMessage.text}
            </div>
          ) : (
            <div style={{ color: 'var(--text-3)', fontSize: 12 }}>
              Changes take effect immediately across all background sentiment workers.
            </div>
          )}
          <button
            type="button"
            className="beast-btn primary"
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '10px 24px' }}
          >
            {saving ? 'Saving...' : '💾 Save & Apply Parameters'}
          </button>
        </div>
      </div>

      {/* Live Test Sandbox */}
      <div className="ai-card">
        <div className="ai-card-head">
          <div>
            <div className="ai-card-title">
              <span>🔬</span> Live Sentiment Sandbox Tester
            </div>
            <div className="ai-card-sub">
              Test any custom headline or global macro scenario in real-time to see how Gemini evaluates it.
            </div>
          </div>
        </div>

        <div className="ai-sandbox-presets">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              type="button"
              className="ai-preset-chip"
              onClick={() => setTestHeadline(p.text)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="text"
            className="ai-input"
            style={{ flex: 1, minWidth: 260 }}
            value={testHeadline}
            onChange={(e) => setTestHeadline(e.target.value)}
            placeholder="Type any financial news headline or global event..."
          />
          <button
            type="button"
            className="beast-btn"
            onClick={handleRunTest}
            disabled={testing}
            style={{ borderColor: 'var(--up)', color: 'var(--up)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span>⚡</span> {testing ? 'Analyzing...' : 'Test Headline'}
          </button>
        </div>

        {/* Test Result Display */}
        {testResult && (
          <div className="ai-test-result-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`ai-test-badge ${testResult.result.sentiment.toLowerCase()}`}>
                  {testResult.result.sentiment === 'Bullish' && '▲ '}
                  {testResult.result.sentiment === 'Bearish' && '▼ '}
                  {testResult.result.sentiment}
                </span>
                {testResult.result.perspective && (
                  <span className="badge-pill cyan" style={{ fontSize: 11 }}>
                    {testResult.result.perspective === 'Company' ? '🏢 Company Perspective' : '🌐 India Macro Lens'}
                  </span>
                )}
                {testResult.result.confidence && (
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    Confidence: {testResult.result.confidence}%
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {testResult.model} · {testResult.latencyMs}ms {testResult.usedHeuristic && '(Heuristic fallback)'}
              </div>
            </div>

            {testResult.error && (
              <div style={{ padding: '8px 12px', background: 'rgba(255, 68, 88, 0.1)', color: 'var(--down)', borderRadius: 6, fontSize: 12, marginBottom: 10 }}>
                ⚠️ {testResult.error}
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                Reasoning (Company / India Lens):
              </div>
              <div style={{ color: 'var(--text-1)', fontSize: 13, lineHeight: 1.5 }}>
                {testResult.result.reasoning || 'No explanation provided.'}
              </div>
            </div>

            {testResult.result.affectedStocks && testResult.result.affectedStocks.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                  Affected Indian Equities:
                </div>
                <div>
                  {testResult.result.affectedStocks.map((sym, i) => (
                    <span key={i} className="ai-stock-tag">
                      {sym}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
