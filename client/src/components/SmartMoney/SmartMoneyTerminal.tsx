import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, RefreshCw, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Layers, ShieldCheck, Activity, BarChart2, Clock, Zap } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useSocketContext } from '../../context/SocketContext';
import { audioAlerts } from '../../utils/audioAlerts';
import { SmartMoneyTimelineChart, type IntradayFlowPoint, type MarketSessionInfo } from './SmartMoneyTimelineChart';
import { StockLogo } from '../common/StockLogo';
import { computeClientSmartMoneyFlow } from '../../services/smartMoneyClientEngine';
import type { StockData } from '../../types';
import './SmartMoneyTerminal.css';

export type { IntradayFlowPoint, MarketSessionInfo };

export interface SmartMoneyTarget {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  turnoverCr: number;
  flowCr: number;
  relativeVolume: number;
  footprint: string;
  institution: string;
  sector: string;
  dealValueCr?: number;
}

export interface SectorRotationData {
  sector: string;
  inflowCr: number;
  outflowCr: number;
  netFlowCr: number;
  advancing: number;
  declining: number;
  sentiment: string;
  topAccumulator: string;
  topDistributor: string;
}

export interface EnrichedDeal {
  date: string;
  symbol: string;
  clientName: string;
  clientCategory: 'FII / FOREIGN' | 'DII / MUTUAL FUND' | 'PROP / QUANT DESK' | 'PROMOTER / CORP';
  type: 'BUY' | 'SELL';
  flowDirection: 'INFLOW' | 'OUTFLOW';
  quantity: number;
  price: number;
  valueCr: number;
}

export interface SmartMoneyFlowData {
  timestamp: string;
  marketSession?: MarketSessionInfo;
  intradayTimeline?: IntradayFlowPoint[];
  totalMarketTurnoverCr: number;
  totalInstitutionalInflowCr: number;
  totalInstitutionalOutflowCr: number;
  netSmartMoneyFlowCr: number;
  accumulationRatioPct: number;
  marketPhase: string;
  fiiNetEstimatedCr: number;
  diiNetEstimatedCr: number;
  advancingStocks: number;
  decliningStocks: number;
  neutralStocks: number;
  topAccumulators: SmartMoneyTarget[];
  topDistributors: SmartMoneyTarget[];
  sectorRotation: SectorRotationData[];
  derivativesPositioning: {
    longBuildupCount: number;
    shortBuildupCount: number;
    shortCoveringCount: number;
    longUnwindingCount: number;
    smartMoneyPutFloor: number;
    smartMoneyCallCeiling: number;
    pcr: number;
    maxPain: number;
    bias: string;
    recentBigMoneyAlerts: any[];
  };
  recentBlockDeals: EnrichedDeal[];
}

type SubTabMode = 'radar' | 'timeline' | 'inflows' | 'outflows' | 'sectors' | 'derivatives' | 'deals';

export const SmartMoneyTerminal: React.FC<{ stocks?: StockData[] }> = ({ stocks }) => {
  const { setSelectedStock, setActiveTab, setChartSymbol } = useDashboard();
  const { socket, isConnected } = useSocketContext();
  const [data, setData] = useState<SmartMoneyFlowData>(() => computeClientSmartMoneyFlow(stocks));
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<SubTabMode>('radar');
  const [searchQuery, setSearchQuery] = useState('');
  const [dealFilter, setDealFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'MEGA'>('ALL');
  const lastComputeTimeRef = useRef<number>(0);

  const fetchFlowData = async () => {
    try {
      setIsRefreshing(true);
      const socketUrl = import.meta.env.VITE_SOCKET_URL || '';
      const endpoints = [
        `/api/smart-money/flow`,
        `http://localhost:5000/api/smart-money/flow`,
        `${socketUrl.replace(/\/$/, '')}/api/smart-money/flow`,
      ].filter(Boolean);

      let fetched = false;
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep);
          if (res.ok) {
            const json = await res.json();
            if (json.status === 'success' && json.data && json.data.topAccumulators?.length > 0) {
              setData(json.data);
              fetched = true;
              break;
            }
          }
        } catch (e) {
          // try next endpoint fallback
        }
      }

      if (!fetched && stocks && stocks.length > 0) {
        setData(computeClientSmartMoneyFlow(stocks));
      }
    } catch (err) {
      console.error('Failed to load smart money flow from backend:', err);
      if (stocks && stocks.length > 0) {
        setData(computeClientSmartMoneyFlow(stocks));
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Smoothly re-compute client-side whenever live stock ticks arrive (throttled to 2.5s)
  useEffect(() => {
    if (stocks && stocks.length > 0) {
      const now = Date.now();
      if (now - lastComputeTimeRef.current >= 2500 || !data) {
        lastComputeTimeRef.current = now;
        setData(computeClientSmartMoneyFlow(stocks));
      }
    }
  }, [stocks]);

  // Real-time WebSocket listener for immediate sub-second flow updates
  useEffect(() => {
    if (!socket) return;
    const onFlowUpdate = (freshData: SmartMoneyFlowData) => {
      if (freshData) {
        setData(freshData);
        setLoading(false);
      }
    };
    socket.on('smart-money:flow', onFlowUpdate);
    return () => {
      socket.off('smart-money:flow', onFlowUpdate);
    };
  }, [socket]);

  // Initial fetch and standing fallback polling (every 5 seconds)
  useEffect(() => {
    fetchFlowData();
    const interval = setInterval(fetchFlowData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStockClick = (symbol: string) => {
    audioAlerts.playHapticClick();
    setSelectedStock(symbol);
    setChartSymbol(symbol);
  };

  const filteredAccumulators = useMemo(() => {
    if (!data?.topAccumulators) return [];
    if (!searchQuery.trim()) return data.topAccumulators;
    const q = searchQuery.toLowerCase();
    return data.topAccumulators.filter(s =>
      s.symbol.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.sector.toLowerCase().includes(q) ||
      s.institution.toLowerCase().includes(q)
    );
  }, [data?.topAccumulators, searchQuery]);

  const filteredDistributors = useMemo(() => {
    if (!data?.topDistributors) return [];
    if (!searchQuery.trim()) return data.topDistributors;
    const q = searchQuery.toLowerCase();
    return data.topDistributors.filter(s =>
      s.symbol.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.sector.toLowerCase().includes(q) ||
      s.institution.toLowerCase().includes(q)
    );
  }, [data?.topDistributors, searchQuery]);

  const filteredDeals = useMemo(() => {
    if (!data?.recentBlockDeals) return [];
    let list = data.recentBlockDeals;

    if (dealFilter === 'BUY') {
      list = list.filter(d => d.type === 'BUY');
    } else if (dealFilter === 'SELL') {
      list = list.filter(d => d.type === 'SELL');
    } else if (dealFilter === 'MEGA') {
      list = list.filter(d => d.valueCr >= 20);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d =>
        d.symbol.toLowerCase().includes(q) ||
        d.clientName.toLowerCase().includes(q) ||
        d.clientCategory.toLowerCase().includes(q)
      );
    }

    return list;
  }, [data?.recentBlockDeals, dealFilter, searchQuery]);

  const formatCr = (val: number) => {
    const abs = Math.abs(val);
    if (abs >= 1000) {
      return `₹${(val / 1000).toFixed(2)}K Cr`;
    }
    return `₹${val.toFixed(2)} Cr`;
  };

  const getTagClass = (footprint: string) => {
    if (footprint.includes('MEGA BLOCK BUY')) return 'mega-buy';
    if (footprint.includes('MEGA BLOCK DUMP') || footprint.includes('BREAKDOWN')) return 'mega-dump';
    if (footprint.includes('ALGO') || footprint.includes('QUANT')) return 'algo';
    return 'vol';
  };

  const getClientCategoryBadge = (cat: string) => {
    if (cat.includes('FII')) return 'fii';
    if (cat.includes('DII')) return 'dii';
    if (cat.includes('PROP')) return 'prop';
    return 'promoter';
  };

  const netFlow = data?.netSmartMoneyFlowCr ?? 0;
  const isNetPositive = netFlow >= 0;

  return (
    <div className="smart-money-terminal">
      {/* ── Top Institutional Macro Barometer ────────────────── */}
      <div className="sm-macro-banner">
        <div className="sm-macro-top">
          <div className="sm-macro-left">
            <div className={`sm-beacon ${data?.marketSession?.isMarketOpen ? 'live' : ''}`} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="sm-macro-title">Smart Money Capital Flow Telemetry</span>
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: 'rgba(40, 207, 255, 0.15)', color: '#28CFFF', border: '1px solid rgba(40, 207, 255, 0.35)', letterSpacing: '0.04em' }}>
                  SESSION: 09:15 — 15:30 IST
                </span>
                {isConnected && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, color: '#00D6A3', background: 'rgba(0, 214, 163, 0.12)', padding: '2px 7px', borderRadius: 4, border: '1px solid rgba(0, 214, 163, 0.3)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D6A3', boxShadow: '0 0 6px #00D6A3' }} />
                    REAL-TIME STREAM
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#9BAAC0', marginTop: 3 }}>
                {data?.marketSession?.sessionStatusLabel || 'Tracking real-time institutional allocation, delivery spikes & block liquidations across 500+ NSE equities'}
              </div>
            </div>
            {data && (
              <span className={`sm-phase-tag ${data.marketPhase.includes('ACCUMULATION') ? 'accumulation' : data.marketPhase.includes('DISTRIBUTION') || data.marketPhase.includes('LIQUIDATION') ? 'distribution' : 'neutral'}`}>
                {data.marketPhase.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          <button
            className="sm-refresh-btn"
            onClick={() => {
              audioAlerts.playHapticClick();
              fetchFlowData();
            }}
            disabled={isRefreshing}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Live Flow'}</span>
          </button>
        </div>

        {/* 4 Core Quantitative Barometer Metrics */}
        <div className="sm-stats-grid">
          <div className="sm-stat-box">
            <span className="sm-stat-label">Net Institutional Delta</span>
            <span className={`sm-stat-value ${isNetPositive ? 'up' : 'down'}`}>
              {isNetPositive ? '+' : ''}{formatCr(netFlow)}
            </span>
            <span className="sm-stat-sub">
              {isNetPositive ? 'Net Buying Inflow' : 'Net Liquidation Outflow'}
            </span>
          </div>

          <div className="sm-stat-box">
            <span className="sm-stat-label">Capital Entering (Buys)</span>
            <span className="sm-stat-value up">
              +{formatCr(data?.totalInstitutionalInflowCr ?? 0)}
            </span>
            <span className="sm-stat-sub">
              {data?.advancingStocks ?? 0} Accumulating Equities
            </span>
          </div>

          <div className="sm-stat-box">
            <span className="sm-stat-label">Capital Exiting (Sells)</span>
            <span className="sm-stat-value down">
              -{formatCr(data?.totalInstitutionalOutflowCr ?? 0)}
            </span>
            <span className="sm-stat-sub">
              {data?.decliningStocks ?? 0} Distributing Equities
            </span>
          </div>

          <div className="sm-stat-box">
            <span className="sm-stat-label">FII / DII Net Balance</span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <span className={`sm-stat-value ${(data?.fiiNetEstimatedCr ?? 0) >= 0 ? 'up' : 'down'}`} style={{ fontSize: 16 }}>
                FII: {(data?.fiiNetEstimatedCr ?? 0) >= 0 ? '+' : ''}{formatCr(data?.fiiNetEstimatedCr ?? 0)}
              </span>
              <span className={`sm-stat-value ${(data?.diiNetEstimatedCr ?? 0) >= 0 ? 'up' : 'down'}`} style={{ fontSize: 16 }}>
                DII: {(data?.diiNetEstimatedCr ?? 0) >= 0 ? '+' : ''}{formatCr(data?.diiNetEstimatedCr ?? 0)}
              </span>
            </div>
            <span className="sm-stat-sub">Estimated Cash Flow Bias</span>
          </div>
        </div>

        {/* Capital Allocation Laser Progress Bar */}
        <div className="sm-flow-bar-wrap">
          <div className="sm-flow-bar-head">
            <span style={{ color: '#00D6A3' }}>
              Institutional Accumulation: {data?.accumulationRatioPct ?? 50}%
            </span>
            <span style={{ color: '#FF4268' }}>
              Institutional Distribution: {(100 - (data?.accumulationRatioPct ?? 50)).toFixed(1)}%
            </span>
          </div>
          <div className="sm-flow-bar-track">
            <div
              className="sm-flow-bar-fill"
              style={{ width: `${data?.accumulationRatioPct ?? 50}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Sub-Navigation Tabs ───────────────────────────── */}
      <div className="sm-subtabs">
        <button
          className={`sm-subtab-btn ${activeSubTab === 'radar' ? 'active' : ''}`}
          onClick={() => {
            audioAlerts.playHapticClick();
            setActiveSubTab('radar');
          }}
        >
          <Activity size={14} />
          <span>Capital Flow Radar</span>
        </button>

        <button
          className={`sm-subtab-btn ${activeSubTab === 'timeline' ? 'active' : ''}`}
          onClick={() => {
            audioAlerts.playHapticClick();
            setActiveSubTab('timeline');
          }}
        >
          <Clock size={14} style={{ color: '#28CFFF' }} />
          <span>Intraday Timeline (9:15 — 3:30)</span>
          <span className="sm-tab-badge live">LIVE</span>
        </button>

        <button
          className={`sm-subtab-btn ${activeSubTab === 'inflows' ? 'active' : ''}`}
          onClick={() => {
            audioAlerts.playHapticClick();
            setActiveSubTab('inflows');
          }}
        >
          <TrendingUp size={14} style={{ color: '#00D6A3' }} />
          <span>Where Money Is Entering</span>
          <span className="sm-tab-badge up">{data?.topAccumulators?.length ?? 0}</span>
        </button>

        <button
          className={`sm-subtab-btn ${activeSubTab === 'outflows' ? 'active' : ''}`}
          onClick={() => {
            audioAlerts.playHapticClick();
            setActiveSubTab('outflows');
          }}
        >
          <TrendingDown size={14} style={{ color: '#FF4268' }} />
          <span>Where Money Is Leaving</span>
          <span className="sm-tab-badge down">{data?.topDistributors?.length ?? 0}</span>
        </button>

        <button
          className={`sm-subtab-btn ${activeSubTab === 'sectors' ? 'active' : ''}`}
          onClick={() => {
            audioAlerts.playHapticClick();
            setActiveSubTab('sectors');
          }}
        >
          <Layers size={14} />
          <span>Sector Rotation Map</span>
        </button>

        <button
          className={`sm-subtab-btn ${activeSubTab === 'derivatives' ? 'active' : ''}`}
          onClick={() => {
            audioAlerts.playHapticClick();
            setActiveSubTab('derivatives');
          }}
        >
          <BarChart2 size={14} style={{ color: '#28CFFF' }} />
          <span>Derivatives Buildup</span>
        </button>

        <button
          className={`sm-subtab-btn ${activeSubTab === 'deals' ? 'active' : ''}`}
          onClick={() => {
            audioAlerts.playHapticClick();
            setActiveSubTab('deals');
          }}
        >
          <ShieldCheck size={14} style={{ color: '#D4AF37' }} />
          <span>NSE Bulk & Block Deals</span>
          <span className="sm-tab-badge up" style={{ background: 'rgba(212, 175, 55, 0.2)', color: '#D4AF37' }}>
            {data?.recentBlockDeals?.length ?? 0}
          </span>
        </button>
      </div>

      {/* Global Filter & Search Bar */}
      <div className="sm-search-bar">
        <Search size={14} style={{ color: '#64748B' }} />
        <input
          placeholder="Filter by stock symbol, company, sector, or institutional buyer/seller (e.g. TRENT, SWIGGY, Morgan Stanley, B.V.)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 11 }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Sub-Terminal 1: Capital Flow Radar (Side-by-Side) ──── */}
      {activeSubTab === 'radar' && (
        <>
          {/* Intraday Flow Ribbon (09:15 to 15:30) */}
          <SmartMoneyTimelineChart
            timeline={data?.intradayTimeline || []}
            marketSession={data?.marketSession}
            isCompact={true}
          />

          <div className="sm-radar-grid">
          {/* Column 1: WHERE MONEY IS ENTERING */}
          <div className="sm-panel-card inflow-card">
            <div className="sm-panel-head">
              <div className="sm-panel-title up">
                <ArrowUpRight size={18} />
                <span>Where Money Is Entering (Top Inflows)</span>
              </div>
              <span style={{ fontSize: 11, color: '#64748B' }}>
                {filteredAccumulators.length} Targets
              </span>
            </div>

            <div className="sm-target-list">
              {filteredAccumulators.slice(0, 10).map((s) => (
                <div
                  key={s.symbol}
                  className="sm-target-row"
                  onClick={() => handleStockClick(s.symbol)}
                  title={`Click to open chart and analytics for ${s.symbol}`}
                >
                  <div className="sm-target-left" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StockLogo symbol={s.symbol} name={s.name} size={28} className="shrink-0" />
                    <div>
                      <div className="sm-symbol-line">
                        <span className="sm-symbol">{s.symbol}</span>
                        <span className={`sm-tag ${getTagClass(s.footprint)}`}>{s.footprint}</span>
                      </div>
                      <div className="sm-client-note">
                        <span>{s.name}</span>
                        <span>•</span>
                        <span style={{ color: '#28CFFF' }}>{s.institution}</span>
                      </div>
                    </div>
                  </div>

                  <div className="sm-target-right">
                    <span className="sm-flow-val up">+{formatCr(s.flowCr)}</span>
                    <div className="sm-price-meta">
                      <span>₹{s.price.toFixed(2)}</span>
                      <span style={{ color: '#00D6A3' }}>+{s.changePercent.toFixed(2)}%</span>
                      <span>RVol: {s.relativeVolume}x</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: WHERE MONEY IS LEAVING */}
          <div className="sm-panel-card outflow-card">
            <div className="sm-panel-head">
              <div className="sm-panel-title down">
                <ArrowDownRight size={18} />
                <span>Where Money Is Leaving (Top Outflows)</span>
              </div>
              <span style={{ fontSize: 11, color: '#64748B' }}>
                {filteredDistributors.length} Targets
              </span>
            </div>

            <div className="sm-target-list">
              {filteredDistributors.slice(0, 10).map((s) => (
                <div
                  key={s.symbol}
                  className="sm-target-row"
                  onClick={() => handleStockClick(s.symbol)}
                  title={`Click to open chart and analytics for ${s.symbol}`}
                >
                  <div className="sm-target-left" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StockLogo symbol={s.symbol} name={s.name} size={28} className="shrink-0" />
                    <div>
                      <div className="sm-symbol-line">
                        <span className="sm-symbol">{s.symbol}</span>
                        <span className={`sm-tag ${getTagClass(s.footprint)}`}>{s.footprint}</span>
                      </div>
                      <div className="sm-client-note">
                        <span>{s.name}</span>
                        <span>•</span>
                        <span style={{ color: '#FF4268' }}>{s.institution}</span>
                      </div>
                    </div>
                  </div>

                  <div className="sm-target-right">
                    <span className="sm-flow-val down">-{formatCr(s.flowCr)}</span>
                    <div className="sm-price-meta">
                      <span>₹{s.price.toFixed(2)}</span>
                      <span style={{ color: '#FF4268' }}>{s.changePercent.toFixed(2)}%</span>
                      <span>RVol: {s.relativeVolume}x</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </>
      )}

      {/* ── Sub-Terminal: Expanded Intraday Timeline (09:15 — 15:30) ──── */}
      {activeSubTab === 'timeline' && (
        <SmartMoneyTimelineChart
          timeline={data?.intradayTimeline || []}
          marketSession={data?.marketSession}
          isCompact={false}
        />
      )}

      {/* ── Sub-Terminal 2: Complete Inflows Table ──────────── */}
      {activeSubTab === 'inflows' && (
        <div className="sm-table-wrap">
          <table className="sm-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Company Name</th>
                <th>Sector</th>
                <th style={{ textAlign: 'right' }}>LTP</th>
                <th style={{ textAlign: 'right' }}>Change %</th>
                <th style={{ textAlign: 'right' }}>Institutional Inflow</th>
                <th style={{ textAlign: 'right' }}>Day Turnover</th>
                <th style={{ textAlign: 'right' }}>RVol</th>
                <th>Footprint Setup</th>
                <th>Key Institutional Buyer / Origin</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccumulators.map((s) => (
                <tr key={s.symbol} onClick={() => handleStockClick(s.symbol)} style={{ cursor: 'pointer' }}>
                  <td className="mono" style={{ fontWeight: 800, color: '#F1F5FC' }}>{s.symbol}</td>
                  <td>{s.name}</td>
                  <td style={{ color: '#64748B' }}>{s.sector}</td>
                  <td className="mono" style={{ textAlign: 'right', color: '#F1F5FC' }}>₹{s.price.toFixed(2)}</td>
                  <td className="mono" style={{ textAlign: 'right', color: '#00D6A3', fontWeight: 700 }}>
                    +{s.changePercent.toFixed(2)}%
                  </td>
                  <td className="mono" style={{ textAlign: 'right', color: '#00D6A3', fontWeight: 800 }}>
                    +{formatCr(s.flowCr)}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>{formatCr(s.turnoverCr)}</td>
                  <td className="mono" style={{ textAlign: 'right', color: s.relativeVolume >= 2 ? '#D4AF37' : '#9BAAC0' }}>
                    {s.relativeVolume}x
                  </td>
                  <td>
                    <span className={`sm-tag ${getTagClass(s.footprint)}`}>{s.footprint}</span>
                  </td>
                  <td style={{ color: '#28CFFF' }}>{s.institution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Sub-Terminal 3: Complete Outflows Table ─────────── */}
      {activeSubTab === 'outflows' && (
        <div className="sm-table-wrap">
          <table className="sm-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Company Name</th>
                <th>Sector</th>
                <th style={{ textAlign: 'right' }}>LTP</th>
                <th style={{ textAlign: 'right' }}>Change %</th>
                <th style={{ textAlign: 'right' }}>Institutional Outflow</th>
                <th style={{ textAlign: 'right' }}>Day Turnover</th>
                <th style={{ textAlign: 'right' }}>RVol</th>
                <th>Footprint Setup</th>
                <th>Key Institutional Seller / Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredDistributors.map((s) => (
                <tr key={s.symbol} onClick={() => handleStockClick(s.symbol)} style={{ cursor: 'pointer' }}>
                  <td className="mono" style={{ fontWeight: 800, color: '#F1F5FC' }}>{s.symbol}</td>
                  <td>{s.name}</td>
                  <td style={{ color: '#64748B' }}>{s.sector}</td>
                  <td className="mono" style={{ textAlign: 'right', color: '#F1F5FC' }}>₹{s.price.toFixed(2)}</td>
                  <td className="mono" style={{ textAlign: 'right', color: '#FF4268', fontWeight: 700 }}>
                    {s.changePercent.toFixed(2)}%
                  </td>
                  <td className="mono" style={{ textAlign: 'right', color: '#FF4268', fontWeight: 800 }}>
                    -{formatCr(s.flowCr)}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>{formatCr(s.turnoverCr)}</td>
                  <td className="mono" style={{ textAlign: 'right', color: s.relativeVolume >= 2 ? '#D4AF37' : '#9BAAC0' }}>
                    {s.relativeVolume}x
                  </td>
                  <td>
                    <span className={`sm-tag ${getTagClass(s.footprint)}`}>{s.footprint}</span>
                  </td>
                  <td style={{ color: '#FF4268' }}>{s.institution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Sub-Terminal 4: Sector Rotation Map ─────────────── */}
      {activeSubTab === 'sectors' && (
        <div className="sm-panel-card" style={{ gap: 16 }}>
          <div className="sm-panel-head">
            <div className="sm-panel-title">
              <Layers size={18} style={{ color: '#28CFFF' }} />
              <span>Institutional Sector Capital Rotation Breakdown</span>
            </div>
            <span style={{ fontSize: 11, color: '#64748B' }}>
              Ranked by Net Institutional Flow (₹ Cr)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data?.sectorRotation?.map((sec) => {
              const isPositive = sec.netFlowCr >= 0;
              const totalSec = sec.inflowCr + sec.outflowCr;
              const inRatio = totalSec > 0 ? (sec.inflowCr / totalSec) * 100 : 50;

              return (
                <div
                  key={sec.sector}
                  style={{
                    background: 'rgba(11, 18, 32, 0.7)',
                    border: '1px solid #1E2D42',
                    borderRadius: 10,
                    padding: '12px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: '#F1F5FC' }}>{sec.sector}</span>
                      <span className={`sm-tag ${isPositive ? 'mega-buy' : 'mega-dump'}`}>
                        {sec.sentiment.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontSize: 11, color: '#9BAAC0' }}>
                        Adv: <b style={{ color: '#00D6A3' }}>{sec.advancing}</b> | Dec: <b style={{ color: '#FF4268' }}>{sec.declining}</b>
                      </span>
                      <span className={`sm-stat-value ${isPositive ? 'up' : 'down'}`} style={{ fontSize: 15 }}>
                        {isPositive ? '+' : ''}{formatCr(sec.netFlowCr)}
                      </span>
                    </div>
                  </div>

                  {/* Flow comparison bar */}
                  <div style={{ height: 6, background: '#FF4268', borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${inRatio}%`, background: '#00D6A3', height: '100%' }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B' }}>
                    <span>Inflow: <b style={{ color: '#00D6A3' }}>+{formatCr(sec.inflowCr)}</b> (Top: <b style={{ color: '#F1F5FC' }}>{sec.topAccumulator}</b>)</span>
                    <span>Outflow: <b style={{ color: '#FF4268' }}>-{formatCr(sec.outflowCr)}</b> (Top: <b style={{ color: '#F1F5FC' }}>{sec.topDistributor}</b>)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Sub-Terminal 5: Derivatives & F&O Positioning ──── */}
      {activeSubTab === 'derivatives' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="sm-stats-grid">
            <div className="sm-stat-box">
              <span className="sm-stat-label">Long Buildup (Aggressive Buying)</span>
              <span className="sm-stat-value up">{data?.derivativesPositioning.longBuildupCount ?? 0} Stocks</span>
              <span className="sm-stat-sub">Price ▲ + Open Interest ▲</span>
            </div>

            <div className="sm-stat-box">
              <span className="sm-stat-label">Short Buildup (Aggressive Selling)</span>
              <span className="sm-stat-value down">{data?.derivativesPositioning.shortBuildupCount ?? 0} Stocks</span>
              <span className="sm-stat-sub">Price ▼ + Open Interest ▲</span>
            </div>

            <div className="sm-stat-box">
              <span className="sm-stat-label">Smart Money Support Base</span>
              <span className="sm-stat-value up" style={{ color: '#00D6A3' }}>
                {data?.derivativesPositioning.smartMoneyPutFloor} PE
              </span>
              <span className="sm-stat-sub">Institutional Put Writing Support (Floor)</span>
            </div>

            <div className="sm-stat-box">
              <span className="sm-stat-label">Smart Money Resistance Wall</span>
              <span className="sm-stat-value down" style={{ color: '#FF4268' }}>
                {data?.derivativesPositioning.smartMoneyCallCeiling} CE
              </span>
              <span className="sm-stat-sub">Institutional Call Writing Resistance (Cap)</span>
            </div>
          </div>

          {/* Big Money Orderflow Alerts Feed */}
          <div className="sm-panel-card">
            <div className="sm-panel-head">
              <div className="sm-panel-title">
                <Activity size={18} style={{ color: '#28CFFF' }} />
                <span>Live Institutional Derivatives Orderflow Moves</span>
              </div>
              <button
                className="sm-refresh-btn"
                onClick={() => {
                  audioAlerts.playHapticClick();
                  setActiveTab('OptionsLens');
                }}
              >
                <span>Open Options Lens →</span>
              </button>
            </div>

            <div className="sm-target-list">
              {data?.derivativesPositioning?.recentBigMoneyAlerts && data.derivativesPositioning.recentBigMoneyAlerts.length > 0 ? (
                data.derivativesPositioning.recentBigMoneyAlerts.map((alert: any, idx: number) => (
                  <div key={alert.id || idx} className="sm-target-row" style={{ cursor: 'default' }}>
                    <div className="sm-target-left">
                      <div className="sm-symbol-line">
                        <span className="sm-symbol">{alert.symbol}</span>
                        <span className="sm-tag algo">{alert.contracts} BETS</span>
                        <span style={{ fontSize: 11, color: '#9BAAC0' }}>Strike {alert.strike}</span>
                      </div>
                      <div className="sm-client-note">
                        <span>{alert.message}</span>
                      </div>
                    </div>
                    <div className="sm-target-right">
                      <span className="sm-price-meta">{alert.timeFormatted || '15:28 IST'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>
                  No high-volume institutional F&O deviations in the last 15 minutes.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-Terminal 6: NSE Bulk & Block Deals ──────────── */}
      {activeSubTab === 'deals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Quick filter buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className={`sm-refresh-btn ${dealFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setDealFilter('ALL')}
            >
              All Deals ({data?.recentBlockDeals?.length ?? 0})
            </button>
            <button
              className={`sm-refresh-btn ${dealFilter === 'MEGA' ? 'active' : ''}`}
              onClick={() => setDealFilter('MEGA')}
              style={{ color: '#D4AF37' }}
            >
              Mega Blocks (&gt; ₹20 Cr)
            </button>
            <button
              className={`sm-refresh-btn ${dealFilter === 'BUY' ? 'active' : ''}`}
              onClick={() => setDealFilter('BUY')}
              style={{ color: '#00D6A3' }}
            >
              Institutional Buys (Inflows)
            </button>
            <button
              className={`sm-refresh-btn ${dealFilter === 'SELL' ? 'active' : ''}`}
              onClick={() => setDealFilter('SELL')}
              style={{ color: '#FF4268' }}
            >
              Institutional Sells (Outflows)
            </button>
          </div>

          <div className="sm-table-wrap">
            <table className="sm-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Symbol</th>
                  <th>Client / Fund Name</th>
                  <th>Institutional Category</th>
                  <th>Action</th>
                  <th style={{ textAlign: 'right' }}>Quantity</th>
                  <th style={{ textAlign: 'right' }}>Trade Price</th>
                  <th style={{ textAlign: 'right' }}>Deal Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
                      No deals match the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredDeals.map((deal, idx) => (
                    <tr key={idx} onClick={() => handleStockClick(deal.symbol)} style={{ cursor: 'pointer' }}>
                      <td className="mono">{deal.date}</td>
                      <td className="mono" style={{ fontWeight: 800, color: '#F1F5FC' }}>{deal.symbol}</td>
                      <td style={{ fontWeight: 600, color: '#F1F5FC' }}>{deal.clientName}</td>
                      <td>
                        <span className={`sm-cat-badge ${getClientCategoryBadge(deal.clientCategory)}`}>
                          {deal.clientCategory}
                        </span>
                      </td>
                      <td>
                        <span className={`sm-tag ${deal.type === 'BUY' ? 'mega-buy' : 'mega-dump'}`}>
                          {deal.type} ({deal.flowDirection})
                        </span>
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {deal.quantity.toLocaleString()}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        ₹{deal.price.toFixed(2)}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: deal.type === 'BUY' ? '#00D6A3' : '#FF4268' }}>
                        {deal.type === 'BUY' ? '+' : '-'}{formatCr(deal.valueCr)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
