import React, { useState, useEffect } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useSocketContext } from '../../context/SocketContext';
import { audioAlerts } from '../../utils/audioAlerts';
import { ArrowUpRight, ArrowDownRight, Layers, ChevronRight, Activity } from 'lucide-react';
import { StockLogo } from '../common/StockLogo';
import { computeClientSmartMoneyFlow } from '../../services/smartMoneyClientEngine';

interface SmartMoneySummary {
  netSmartMoneyFlowCr: number;
  totalInstitutionalInflowCr: number;
  totalInstitutionalOutflowCr: number;
  marketPhase: string;
  accumulationRatioPct: number;
  marketSession?: {
    isMarketOpen: boolean;
    sessionStatusLabel: string;
  };
  topAccumulators: Array<{
    symbol: string;
    name: string;
    price: number;
    changePercent: number;
    flowCr: number;
    footprint: string;
    institution: string;
  }>;
  topDistributors: Array<{
    symbol: string;
    name: string;
    price: number;
    changePercent: number;
    flowCr: number;
    footprint: string;
    institution: string;
  }>;
  sectorRotation: Array<{
    sector: string;
    netFlowCr: number;
    sentiment: string;
  }>;
}

const API_BASE = '/api';

export function SmartMoneyRadarWidget() {
  const { setActiveTab, setSelectedStock, setChartSymbol } = useDashboard();
  const { socket, isConnected } = useSocketContext();
  const [summary, setSummary] = useState<SmartMoneySummary>(() => computeClientSmartMoneyFlow(null) as any);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || '';
    const endpoints = [
      `/api/smart-money/flow`,
      `http://localhost:5000/api/smart-money/flow`,
      `${socketUrl.replace(/\/$/, '')}/api/smart-money/flow`,
    ].filter(Boolean);

    let fetched = false;
    (async () => {
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep);
          if (res.ok) {
            const json = await res.json();
            if (json.status === 'success' && json.data && json.data.topAccumulators?.length > 0) {
              setSummary(json.data);
              fetched = true;
              break;
            }
          }
        } catch (e) {
          // try next endpoint
        }
      }

      if (!fetched) {
        setSummary(computeClientSmartMoneyFlow(null) as any);
      }
    })();
  }, []);

  // Real-time WebSocket updates
  useEffect(() => {
    if (!socket) return;
    const onFlow = (fresh: any) => {
      if (fresh) setSummary(fresh);
    };
    socket.on('smart-money:flow', onFlow);
    return () => {
      socket.off('smart-money:flow', onFlow);
    };
  }, [socket]);

  const handleStockClick = (symbol: string) => {
    audioAlerts.playHapticClick();
    setSelectedStock(symbol);
    setChartSymbol(symbol);
  };

  const handleOpenTerminal = () => {
    audioAlerts.playHapticClick();
    setActiveTab('Promoter');
  };

  const formatCr = (val: number) => {
    const abs = Math.abs(val);
    if (abs >= 1000) return `₹${(val / 1000).toFixed(2)}K Cr`;
    return `₹${val.toFixed(2)} Cr`;
  };

  if (!summary) return null;

  const netFlow = summary.netSmartMoneyFlowCr;
  const isNetPositive = netFlow >= 0;

  return (
    <div
      className="ad-hardware-shell"
      style={{
        marginBottom: 20,
        background: 'linear-gradient(135deg, rgba(16, 26, 43, 0.95) 0%, rgba(11, 18, 32, 0.98) 100%)',
        border: '1px solid #243249',
        borderRadius: 14,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'rgba(40, 207, 255, 0.12)',
              border: '1px solid rgba(40, 207, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#28CFFF'
            }}
          >
            <Activity size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#F1F5FC' }}>
                INSTITUTIONAL SMART MONEY RADAR
              </span>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: 'rgba(40, 207, 255, 0.15)', color: '#28CFFF', border: '1px solid rgba(40, 207, 255, 0.3)' }}>
                09:15 — 15:30 IST
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: isNetPositive ? 'rgba(0, 214, 163, 0.15)' : 'rgba(255, 66, 104, 0.15)',
                  color: isNetPositive ? '#00D6A3' : '#FF4268',
                  border: `1px solid ${isNetPositive ? 'rgba(0, 214, 163, 0.3)' : 'rgba(255, 66, 104, 0.3)'}`
                }}
              >
                {summary.marketPhase.replace(/_/g, ' ')}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#64748B' }}>
              Real-time tracking of institutional capital injection vs fund removals across 500+ NSE equities
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenTerminal}
          style={{
            background: 'rgba(20, 33, 55, 0.9)',
            border: '1px solid #28CFFF',
            color: '#28CFFF',
            padding: '6px 14px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s ease'
          }}
        >
          <span>Open Smart Money Terminal</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Metrics Barometer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{ background: 'rgba(11, 18, 32, 0.6)', border: '1px solid #1E2D42', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Net Smart Money Flow</div>
          <div className="font-mono tabular-nums" style={{ fontSize: 18, fontWeight: 800, color: isNetPositive ? '#00D6A3' : '#FF4268' }}>
            {isNetPositive ? '+' : ''}{formatCr(netFlow)}
          </div>
          <div style={{ fontSize: 10, color: '#9BAAC0' }}>{isNetPositive ? 'Institutions are net buyers' : 'Institutions are net distributing'}</div>
        </div>

        <div style={{ background: 'rgba(11, 18, 32, 0.6)', border: '1px solid #1E2D42', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Capital Entering (Inflows)</div>
          <div className="font-mono tabular-nums" style={{ fontSize: 18, fontWeight: 800, color: '#00D6A3' }}>
            +{formatCr(summary.totalInstitutionalInflowCr)}
          </div>
          <div style={{ fontSize: 10, color: '#9BAAC0' }}>{summary.accumulationRatioPct}% market allocation</div>
        </div>

        <div style={{ background: 'rgba(11, 18, 32, 0.6)', border: '1px solid #1E2D42', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Capital Leaving (Outflows)</div>
          <div className="font-mono tabular-nums" style={{ fontSize: 18, fontWeight: 800, color: '#FF4268' }}>
            -{formatCr(summary.totalInstitutionalOutflowCr)}
          </div>
          <div style={{ fontSize: 10, color: '#9BAAC0' }}>{(100 - summary.accumulationRatioPct).toFixed(1)}% market liquidation</div>
        </div>
      </div>

      {/* Mini Side-by-Side: Top 3 Inflows vs Top 3 Outflows */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Inflows */}
        <div style={{ background: 'rgba(16, 26, 43, 0.6)', border: '1px solid rgba(0, 214, 163, 0.25)', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#00D6A3', marginBottom: 8 }}>
            <ArrowUpRight size={14} />
            <span>WHERE MONEY IS ENTERING</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {summary.topAccumulators?.slice(0, 3).map(s => (
              <div
                key={s.symbol}
                onClick={() => handleStockClick(s.symbol)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 10px',
                  background: 'rgba(11, 18, 32, 0.8)',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StockLogo symbol={s.symbol} name={s.name} size={22} className="shrink-0" />
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 12, color: '#F1F5FC' }}>{s.symbol}</span>
                    <div style={{ fontSize: 10, color: '#64748B' }}>{s.institution}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="font-mono tabular-nums" style={{ fontSize: 12, fontWeight: 700, color: '#00D6A3' }}>
                    +{formatCr(s.flowCr)}
                  </div>
                  <div className="font-mono tabular-nums" style={{ fontSize: 10, color: '#00D6A3' }}>
                    +{s.changePercent.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Outflows */}
        <div style={{ background: 'rgba(16, 26, 43, 0.6)', border: '1px solid rgba(255, 66, 104, 0.25)', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#FF4268', marginBottom: 8 }}>
            <ArrowDownRight size={14} />
            <span>WHERE MONEY IS LEAVING</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {summary.topDistributors?.slice(0, 3).map(s => (
              <div
                key={s.symbol}
                onClick={() => handleStockClick(s.symbol)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 10px',
                  background: 'rgba(11, 18, 32, 0.8)',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StockLogo symbol={s.symbol} name={s.name} size={22} className="shrink-0" />
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 12, color: '#F1F5FC' }}>{s.symbol}</span>
                    <div style={{ fontSize: 10, color: '#64748B' }}>{s.institution}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="font-mono tabular-nums" style={{ fontSize: 12, fontWeight: 700, color: '#FF4268' }}>
                    -{formatCr(s.flowCr)}
                  </div>
                  <div className="font-mono tabular-nums" style={{ fontSize: 10, color: '#FF4268' }}>
                    {s.changePercent.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
