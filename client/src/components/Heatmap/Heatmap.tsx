import React, { useMemo, useState } from 'react';
import type { StockData } from '../../types';
import { formatPrice, formatVolume, formatPercent } from '../../utils/formatters';
import { useDashboard } from '../../contexts/DashboardContext';
import { audioAlerts } from '../../utils/audioAlerts';
import { StockLogo } from '../common/StockLogo';
import { CyberIcon } from '../common/CyberIcon';
import './Heatmap.css';

interface HeatmapProps {
  stocks: StockData[];
}

// Calibrated Luminescence Tier Classifier
function getLuminescenceTier(changePercent: number): string {
  if (changePercent >= 3.0) return 'tier-super-bull';
  if (changePercent >= 1.0) return 'tier-bull';
  if (changePercent > 0.1) return 'tier-mild-bull';
  if (changePercent >= -0.1) return 'tier-neutral';
  if (changePercent >= -1.0) return 'tier-mild-bear';
  if (changePercent >= -3.0) return 'tier-bear';
  return 'tier-super-bear';
}

export function Heatmap({ stocks }: HeatmapProps) {
  const [indexFilter, setIndexFilter] = useState<'ALL' | 'NIFTY50' | 'NIFTY500' | 'INDEX'>('ALL');
  const [groupMode, setGroupMode] = useState<'sector' | 'unified'>('sector');
  const [styleMode, setStyleMode] = useState<'cyber' | 'heat'>('cyber');
  const [sizingMode, setSizingMode] = useState<'dynamic' | 'equal'>('dynamic');
  const [search, setSearch] = useState<string>('');

  const { setActiveTab, setChartSymbol } = useDashboard();

  // 1. Filter stocks by index & local search query
  const filteredStocks = useMemo(() => {
    let list = stocks;
    if (indexFilter !== 'ALL') {
      list = stocks.filter(s => s.indexName === indexFilter);
    } else {
      list = stocks.filter(s => s.indexName !== 'INDEX');
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        s =>
          s.symbol.toLowerCase().includes(q) ||
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.sector && s.sector.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => b.changePercent - a.changePercent);
  }, [stocks, indexFilter, search]);

  // 2. High-volume top tickers for dynamic weighted sizing
  const heavyweights = useMemo(() => {
    if (sizingMode !== 'dynamic') return new Set<string>();
    const byVol = [...filteredStocks].sort((a, b) => (b.volume || 0) - (a.volume || 0));
    const topCount = Math.min(10, Math.ceil(filteredStocks.length * 0.08));
    return new Set(byVol.slice(0, topCount).map(s => s.symbol));
  }, [filteredStocks, sizingMode]);

  // 3. Telemetry calculations
  const telemetry = useMemo(() => {
    const total = filteredStocks.length;
    if (total === 0) return { total: 0, advancers: 0, decliners: 0, avgChange: 0, bullPct: 50 };
    const advancers = filteredStocks.filter(s => s.changePercent >= 0).length;
    const decliners = total - advancers;
    const avgChange = filteredStocks.reduce((acc, s) => acc + s.changePercent, 0) / total;
    const bullPct = Math.round((advancers / total) * 100);
    return { total, advancers, decliners, avgChange, bullPct };
  }, [filteredStocks]);

  // 4. Sector groupings
  const sectorGroups = useMemo(() => {
    const map = new Map<string, StockData[]>();
    for (const stock of filteredStocks) {
      const sec = stock.sector || 'Others';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(stock);
    }

    return Array.from(map.entries())
      .map(([sectorName, secStocks]) => {
        const count = secStocks.length;
        const avg = secStocks.reduce((a, b) => a + b.changePercent, 0) / (count || 1);
        const upCount = secStocks.filter(s => s.changePercent >= 0).length;
        return { sectorName, stocks: secStocks, count, avg, upCount };
      })
      .sort((a, b) => b.avg - a.avg);
  }, [filteredStocks]);

  const handleTileClick = (symbol: string) => {
    audioAlerts.playClickHaptic();
    setChartSymbol(symbol);
    setActiveTab('Charts');
  };

  // Render an individual stock tile (Zero-jitter, pure CSS hover)
  const renderTile = (stock: StockData) => {
    const tier = getLuminescenceTier(stock.changePercent);
    const isLarge = heavyweights.has(stock.symbol);
    const isUp = stock.changePercent >= 0;

    return (
      <div
        key={stock.symbol}
        className={`heatmap-tile ${tier} ${styleMode === 'heat' ? 'high-heat' : ''} ${
          isLarge ? 'weighted-large' : ''
        }`}
        onClick={() => handleTileClick(stock.symbol)}
        title={`Click to open ${stock.symbol} chart`}
      >
        {/* Top: Logo + Symbol + Volume Spike */}
        <div className="heatmap-tile-top">
          <div className="heatmap-tile-identity">
            <StockLogo symbol={stock.symbol} name={stock.name} size={isLarge ? 22 : 18} />
            <span className="heatmap-tile-symbol">{stock.symbol}</span>
          </div>
          {stock.volumeSpike && (
            <span className="heatmap-spike-pill" title={`${(stock.relativeVolume || 2).toFixed(1)}x Volume Spike`}>
              <CyberIcon name="spike" size={10} />
              <span>SPIKE</span>
            </span>
          )}
        </div>

        {/* Company Name */}
        <div className="heatmap-tile-name">
          {stock.name}
        </div>

        {/* Bottom: Tabular Price + Glowing Change Pill */}
        <div className="heatmap-tile-bottom">
          <span className="heatmap-tile-price tabular-nums">
            ₹{stock.price.toFixed(2)}
          </span>
          <span className="heatmap-tile-change-pill tabular-nums">
            {isUp ? '+' : ''}{stock.changePercent.toFixed(2)}%
          </span>
        </div>

        {/* Telemetry Hover HUD Tooltip (Pure CSS :hover - zero re-renders) */}
        <div className="heatmap-tooltip">
          <div className="heatmap-tooltip-head">
            <span className="heatmap-tooltip-title">{stock.symbol}</span>
            <span className="heatmap-tooltip-sector">{stock.sector || 'Equities'}</span>
          </div>
          <div className="heatmap-tooltip-row">
            <span className="heatmap-tooltip-label">LTP (Last Price)</span>
            <span className="heatmap-tooltip-val">₹{formatPrice(stock.price)}</span>
          </div>
          <div className="heatmap-tooltip-row">
            <span className="heatmap-tooltip-label">Day Net Change</span>
            <span className={`heatmap-tooltip-val ${isUp ? 'positive' : 'negative'}`}>
              {isUp ? '+' : ''}{stock.change.toFixed(2)} ({formatPercent(stock.changePercent)})
            </span>
          </div>
          <div className="heatmap-tooltip-row">
            <span className="heatmap-tooltip-label">Traded Volume</span>
            <span className="heatmap-tooltip-val">{formatVolume(stock.volume)}</span>
          </div>
          {stock.dayHigh && stock.dayLow && (
            <div className="heatmap-tooltip-row">
              <span className="heatmap-tooltip-label">Day Range</span>
              <span className="heatmap-tooltip-val" style={{ fontSize: 10 }}>
                ₹{stock.dayLow.toFixed(1)} - ₹{stock.dayHigh.toFixed(1)}
              </span>
            </div>
          )}
          {stock.relativeVolume > 0 && (
            <div className="heatmap-tooltip-row">
              <span className="heatmap-tooltip-label">Relative Volume</span>
              <span className="heatmap-tooltip-val" style={{ color: stock.relativeVolume >= 2 ? '#fbbf24' : '#e2e8f0' }}>
                {stock.relativeVolume.toFixed(2)}x
              </span>
            </div>
          )}
          <div className="heatmap-tooltip-hint">
            <CyberIcon name="charts" size={12} /> Click to open Interactive Pro Chart
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="heatmap-container">
      {/* 1. Header Controls Bar */}
      <div className="heatmap-controls-bar">
        {/* Left: Index Filters */}
        <div className="heatmap-controls-left">
          <div className="heatmap-tab-group">
            <button
              className={`heatmap-tab-btn ${indexFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => { audioAlerts.playClickHaptic(); setIndexFilter('ALL'); }}
            >
              All Stocks ({stocks.filter(s => s.indexName !== 'INDEX').length})
            </button>
            <button
              className={`heatmap-tab-btn ${indexFilter === 'NIFTY50' ? 'active' : ''}`}
              onClick={() => { audioAlerts.playClickHaptic(); setIndexFilter('NIFTY50'); }}
            >
              Nifty 50
            </button>
            <button
              className={`heatmap-tab-btn ${indexFilter === 'NIFTY500' ? 'active' : ''}`}
              onClick={() => { audioAlerts.playClickHaptic(); setIndexFilter('NIFTY500'); }}
            >
              Nifty 500
            </button>
            <button
              className={`heatmap-tab-btn ${indexFilter === 'INDEX' ? 'active' : ''}`}
              onClick={() => { audioAlerts.playClickHaptic(); setIndexFilter('INDEX'); }}
            >
              Indices
            </button>
          </div>

          {/* Grouping Mode Toggle */}
          <div className="heatmap-sub-toggle">
            <button
              className={`heatmap-sub-btn ${groupMode === 'sector' ? 'active' : ''}`}
              onClick={() => { audioAlerts.playClickHaptic(); setGroupMode('sector'); }}
              title="Organize stocks by Industry Sectors"
            >
              <CyberIcon name="sectors" size={13} />
              <span>Sectors</span>
            </button>
            <button
              className={`heatmap-sub-btn ${groupMode === 'unified' ? 'active' : ''}`}
              onClick={() => { audioAlerts.playClickHaptic(); setGroupMode('unified'); }}
              title="Continuous unified market grid"
            >
              <CyberIcon name="heatmap" size={13} />
              <span>Treemap</span>
            </button>
          </div>
        </div>

        {/* Right: Sizing, Style & Live Search */}
        <div className="heatmap-controls-right">
          {/* Style Toggle */}
          <div className="heatmap-sub-toggle">
            <button
              className={`heatmap-sub-btn ${styleMode === 'cyber' ? 'active' : ''}`}
              onClick={() => { audioAlerts.playClickHaptic(); setStyleMode('cyber'); }}
              title="Dark cyber-glass tiles with luminous gradients"
            >
              Cyber Glass
            </button>
            <button
              className={`heatmap-sub-btn ${styleMode === 'heat' ? 'active' : ''}`}
              onClick={() => { audioAlerts.playClickHaptic(); setStyleMode('heat'); }}
              title="Finviz saturated heat blocks"
            >
              High Heat
            </button>
          </div>

          {/* Sizing Toggle */}
          <div className="heatmap-sub-toggle">
            <button
              className={`heatmap-sub-btn ${sizingMode === 'dynamic' ? 'active' : ''}`}
              onClick={() => { audioAlerts.playClickHaptic(); setSizingMode('dynamic'); }}
              title="Sized dynamically by volume and weight"
            >
              Dynamic
            </button>
            <button
              className={`heatmap-sub-btn ${sizingMode === 'equal' ? 'active' : ''}`}
              onClick={() => { audioAlerts.playClickHaptic(); setSizingMode('equal'); }}
              title="Equal size grid"
            >
              Equal
            </button>
          </div>

          {/* Live Search */}
          <div className="heatmap-search-box">
            <CyberIcon name="overview" size={14} />
            <input
              type="text"
              placeholder="Search ticker or sector..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <span
                style={{ cursor: 'pointer', color: '#64748b', fontSize: 13 }}
                onClick={() => setSearch('')}
              >
                ✕
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Telemetry Metric Strip */}
      <div className="heatmap-telemetry-strip">
        <div className="heatmap-stat-item">
          <span className="heatmap-stat-label">Tracked:</span>
          <span className="heatmap-stat-val tabular-nums">{telemetry.total}</span>
        </div>
        <div className="heatmap-stat-item">
          <span className="heatmap-stat-label">Advancers:</span>
          <span className="heatmap-stat-val up tabular-nums">+{telemetry.advancers}</span>
        </div>
        <div className="heatmap-stat-item">
          <span className="heatmap-stat-label">Decliners:</span>
          <span className="heatmap-stat-val down tabular-nums">-{telemetry.decliners}</span>
        </div>
        <div className="heatmap-stat-item">
          <span className="heatmap-stat-label">Avg Return:</span>
          <span className={`heatmap-stat-val tabular-nums ${telemetry.avgChange >= 0 ? 'up' : 'down'}`}>
            {telemetry.avgChange >= 0 ? '+' : ''}{telemetry.avgChange.toFixed(2)}%
          </span>
        </div>
        <div className="heatmap-stat-item" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="heatmap-stat-label">Breadth:</span>
          <div className="heatmap-breadth-bar" title={`${telemetry.bullPct}% Bullish`}>
            <div className="heatmap-breadth-fill" style={{ width: `${telemetry.bullPct}%` }} />
          </div>
          <span className="heatmap-stat-val tabular-nums" style={{ fontSize: 11, color: telemetry.bullPct >= 50 ? '#00f59b' : '#f43f5e' }}>
            {telemetry.bullPct}% BULL
          </span>
        </div>
      </div>

      {/* 3. Main Content: Sector Clusters vs Unified Treemap */}
      {filteredStocks.length === 0 ? (
        <div className="heatmap-empty">
          <CyberIcon name="heatmap" size={36} />
          <div>No stocks matched your criteria.</div>
        </div>
      ) : groupMode === 'sector' ? (
        /* Sector Clusters View (Finviz Institutional) */
        <div className="heatmap-sectors-container">
          {sectorGroups.map(group => {
            const isUp = group.avg >= 0;
            return (
              <div key={group.sectorName} className="sector-cluster-card">
                <div className="sector-cluster-header">
                  <div className="sector-cluster-title-wrap">
                    <CyberIcon name="sectors" size={16} />
                    <span className="sector-cluster-name">{group.sectorName}</span>
                    <span className="sector-cluster-count">{group.count} Stocks</span>
                  </div>
                  <div className={`sector-cluster-badge ${isUp ? 'up' : 'down'} tabular-nums`}>
                    {isUp ? '+' : ''}{group.avg.toFixed(2)}% avg
                  </div>
                </div>

                <div className="sector-cluster-grid">
                  {group.stocks.map(renderTile)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Unified Treemap Grid View */
        <div className="heatmap-grid">
          {filteredStocks.map(renderTile)}
        </div>
      )}
    </div>
  );
}
