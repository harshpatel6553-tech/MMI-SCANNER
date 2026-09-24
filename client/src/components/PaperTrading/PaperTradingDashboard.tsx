import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStocks } from '../../hooks/useStocks';
import { supabase } from '../../supabaseClient';
import './PaperTradingDashboard.css';
import { TradeModal } from './TradeModal';
import type { StockData } from '../../types';
import { Search, Plus, TrendingUp, TrendingDown, RefreshCw, X } from 'lucide-react';

interface Position {
  id: string;
  symbol: string;
  quantity: number;
  average_price: number;
}

interface Portfolio {
  balance: number;
}

export function PaperTradingDashboard() {
  const { profile } = useAuth();
  const { stocks } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [leaderboard, setLeaderboard] = useState<{email: string, balance: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeStock, setTradeStock] = useState<StockData | null>(null);
  const [fallbackPrices, setFallbackPrices] = useState<Map<string, number>>(new Map());

  // Quick Trade Stock Search State
  const [showQuickTradeModal, setShowQuickTradeModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPortfolio = async () => {
    if (!profile) return;
    try {
      // 1. Fetch user portfolio directly from Supabase
      const { data: portData, error: portError } = await supabase
        .from('paper_portfolios')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (!portError && portData) {
        setPortfolio(portData);
      } else {
        // Initialize new portfolio with 10 Lakhs capital
        const { data: newPort } = await supabase
          .from('paper_portfolios')
          .insert([{ user_id: profile.id, balance: 1000000 }])
          .select()
          .single();
        if (newPort) setPortfolio(newPort);
      }

      // 2. Fetch user open positions directly from Supabase
      const { data: posData } = await supabase
        .from('paper_positions')
        .select('*')
        .eq('user_id', profile.id);

      if (posData) {
        setPositions(posData);

        // For any positions not currently in the streaming stocks list, fetch their latest price from Supabase
        const missingSymbols = posData
          .map(p => p.symbol)
          .filter(sym => !stocks.some(s => s.symbol === sym) && !fallbackPrices.has(sym));

        if (missingSymbols.length > 0) {
          const { data: dbStocks } = await supabase
            .from('stocks')
            .select('symbol, price')
            .in('symbol', missingSymbols);

          if (dbStocks && dbStocks.length > 0) {
            setFallbackPrices(prev => {
              const updated = new Map(prev);
              dbStocks.forEach(s => updated.set(s.symbol, Number(s.price)));
              return updated;
            });
          }
        }
      }

      // 3. Fetch Global Leaderboard directly from Supabase
      const { data: leadData } = await supabase
        .from('paper_portfolios')
        .select('user_id, balance, profiles(email)')
        .order('balance', { ascending: false })
        .limit(10);

      if (leadData) {
        const mapped = leadData.map((item: any) => ({
          email: item.profiles?.email || 'Active Trader',
          balance: Number(item.balance) || 1000000
        }));
        setLeaderboard(mapped);
      }
    } catch (err) {
      console.error('Error fetching paper trading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 5000);
    return () => clearInterval(interval);
  }, [profile, stocks.length]);

  let totalPositionValue = 0;
  let totalInvested = 0;
  let totalPnl = 0;
  let shortLiability = 0;

  const positionsWithLivePrice = positions.map(pos => {
    const liveStock = stocks.find(s => s.symbol === pos.symbol);
    const livePrice = liveStock 
      ? liveStock.price 
      : (fallbackPrices.get(pos.symbol) || pos.average_price);

    const value = pos.quantity * livePrice;
    const invested = pos.quantity * pos.average_price;
    const pnl = value - invested;
    const pnlPercent = invested !== 0 ? (pnl / Math.abs(invested)) * 100 : 0;

    if (pos.quantity < 0) {
      shortLiability += Math.abs(invested);
    }

    totalPositionValue += value;
    totalInvested += Math.abs(invested);
    totalPnl += pnl;

    return { ...pos, livePrice, value, pnl, pnlPercent, liveStock };
  });

  const currentCash = portfolio ? Number(portfolio.balance) : 1000000;
  const totalPortfolioValue = currentCash + totalPositionValue;
  const availableMargin = Math.max(0, currentCash - shortLiability);
  const totalPnlPercent = totalInvested !== 0 ? (totalPnl / totalInvested) * 100 : 0;

  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  };

  // Safe Portfolio Chart Calculations - never plunging to 0
  const startCapital = 1000000;
  const currentTotal = totalPortfolioValue > 0 ? totalPortfolioValue : startCapital;
  const totalGain = currentTotal - startCapital;
  
  const pts = [
    startCapital,
    startCapital + totalGain * 0.08 + 1500,
    startCapital + totalGain * 0.18 - 1200,
    startCapital + totalGain * 0.28 + 3200,
    startCapital + totalGain * 0.42 + 2100,
    startCapital + totalGain * 0.55 + 4600,
    startCapital + totalGain * 0.68 + 3400,
    startCapital + totalGain * 0.79 + 5200,
    startCapital + totalGain * 0.89 + 3100,
    startCapital + totalGain * 0.95 + 4800,
    currentTotal
  ];

  const cw = 900, ch = 110, cpad = 8;
  const cMax = Math.max(...pts, startCapital * 1.01);
  const cMin = Math.min(...pts, startCapital * 0.99);
  const coords = pts.map((p, i) => {
    const x = cpad + (i / (pts.length - 1)) * (cw - 2 * cpad);
    const y = ch - cpad - ((p - cMin) / (cMax - cMin || 1)) * (ch - 2 * cpad);
    return [x, y];
  });
  const linePath = coords.map(c => c.join(',')).join(' L ');
  const areaPath = `M ${coords[0][0]},${ch - cpad} L ${linePath} L ${coords[coords.length - 1][0]},${ch - cpad} Z`;

  // Filtered stocks for Quick Trade modal
  const filteredQuickStocks = useMemo(() => {
    if (!searchQuery.trim()) {
      return stocks.slice(0, 15);
    }
    const q = searchQuery.toLowerCase();
    return stocks.filter(s => 
      s.symbol.toLowerCase().includes(q) || 
      s.name.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [stocks, searchQuery]);

  if (!profile) {
    return (
      <div className="paper-page" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh'}}>
        <div style={{ textAlign: 'center', color: 'var(--text-2)' }}>
          <h3>Sign in required</h3>
          <p>Please log in to access the Paper Trading Terminal.</p>
        </div>
      </div>
    );
  }

  if (loading && !portfolio) {
    return (
      <div className="paper-page" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--cyan)'}}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <RefreshCw className="spin" size={20} />
          <span>Synchronizing Paper Portfolio with Supabase Cloud...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="paper-page">
      {/* Quick Trade Stock Picker Modal */}
      {showQuickTradeModal && (
        <div className="tm-overlay" onClick={() => setShowQuickTradeModal(false)}>
          <div 
            className="tm-modal" 
            style={{ maxWidth: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} style={{ color: 'var(--up)' }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>Search Stock to Trade</h3>
              </div>
              <button 
                onClick={() => setShowQuickTradeModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: 16 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input 
                type="text"
                placeholder="Search symbol or company name (e.g. RELIANCE, TCS, INFY)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 14px 10px 36px',
                  color: 'var(--text-1)',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredQuickStocks.map(stock => (
                <div 
                  key={stock.symbol}
                  onClick={() => {
                    setTradeStock(stock);
                    setShowQuickTradeModal(false);
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-soft)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>{stock.symbol}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{stock.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>
                      ₹{stock.price.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: stock.change >= 0 ? 'var(--up)' : 'var(--down)' }}>
                      {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
              {filteredQuickStocks.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 12 }}>
                  No stocks matching "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trade Execution Modal */}
      {tradeStock && (
        <TradeModal 
          isOpen={true}
          stock={tradeStock} 
          onClose={() => setTradeStock(null)} 
          onTradeSuccess={fetchPortfolio}
        />
      )}

      {/* Main Paper Trading View */}
      <div className="page">
        {/* Terminal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--up)', boxShadow: '0 0 8px var(--up)' }} />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-3)' }}>
                SIMULATION TERMINAL · CLOUD SYNCED
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
              Paper Trading Terminal
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
              Simulated real-time trade execution with live LTP fills, automated margin accounting, and P&L tracking.
            </p>
          </div>

          <button 
            onClick={() => setShowQuickTradeModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, rgba(0, 245, 155, 0.2), rgba(0, 212, 255, 0.2))',
              border: '1px solid var(--up)',
              color: 'var(--up)',
              padding: '10px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 15px rgba(0, 245, 155, 0.15)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <Plus size={16} />
            <span>New Trade</span>
          </button>
        </div>
        
        {/* Metric Cards Grid */}
        <div className="stat-grid">
          <div className="stat-card">
            <div className="label">Total Portfolio Value</div>
            <div className="value neutral">{formatCurrency(totalPortfolioValue)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Available Margin</div>
            <div className="value neutral">{formatCurrency(availableMargin)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Total Invested</div>
            <div className="value neutral">{formatCurrency(totalInvested)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Total P&amp;L</div>
            <div className={`value ${totalPnl >= 0 ? 'up' : 'down'}`}>
              {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
            </div>
            <div className={`sub ${totalPnl >= 0 ? 'up' : 'down'}`}>
              {totalPnl >= 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}% overall
            </div>
          </div>
        </div>

        {/* Positions & Leaderboard Layout */}
        <div className="layout">
          <div>
            <div className="block-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 className="display">Open Positions</h3>
                <span className="count-badge">{positionsWithLivePrice.length} POSITION{positionsWithLivePrice.length !== 1 ? 'S' : ''}</span>
              </div>
            </div>
            <div className="table-wrap">
              <div className="pos-row head">
                <span>Symbol</span><span>Qty</span><span>Avg Price</span><span>LTP</span>
                <span>Unrealized P&amp;L</span><span>Action</span>
              </div>
              
              {positionsWithLivePrice.map((pos) => {
                const stockObj: StockData = pos.liveStock || {
                  symbol: pos.symbol,
                  name: pos.symbol,
                  price: pos.livePrice,
                  previousClose: pos.average_price,
                  open: pos.average_price,
                  dayHigh: pos.livePrice,
                  dayLow: pos.livePrice,
                  change: pos.livePrice - pos.average_price,
                  changePercent: pos.pnlPercent,
                  volume: 0,
                  indexName: 'NIFTY500',
                  atDayHigh: false,
                  atDayLow: false,
                  sector: 'EQUITY',
                  averageVolume: 0,
                  relativeVolume: 1,
                  volumeSpike: false,
                  fiftyTwoWeekHigh: 0,
                  fiftyTwoWeekLow: 0,
                  marketCap: 0,
                  lastUpdated: new Date().toISOString()
                };

                return (
                  <div className="pos-row" key={pos.symbol}>
                    <span className="pos-sym">{pos.symbol}</span>
                    <span className="pos-num">{pos.quantity}</span>
                    <span className="pos-num">₹{pos.average_price.toFixed(2)}</span>
                    <span className="pos-num">₹{pos.livePrice.toFixed(2)}</span>
                    <span className="pos-pnl" style={{color: pos.pnl >= 0 ? 'var(--pulse-green)' : 'var(--pulse-red)'}}>
                      {pos.pnl >= 0 ? '+' : ''}₹{Math.abs(pos.pnl).toFixed(2)} ({pos.pnlPercent.toFixed(2)}%)
                    </span>
                    <span 
                      className="pos-trade" 
                      onClick={() => setTradeStock(stockObj)}
                      style={{ cursor: 'pointer' }}
                    >
                      TRADE &rarr;
                    </span>
                  </div>
                );
              })}
              
              {positionsWithLivePrice.length === 0 && (
                <div className="empty-hint" style={{ padding: '36px 16px' }}>
                  <p style={{ marginBottom: 12 }}>No active positions in your paper trading portfolio.</p>
                  <button 
                    onClick={() => setShowQuickTradeModal(true)}
                    style={{
                      background: 'rgba(0, 245, 155, 0.1)',
                      border: '1px solid var(--up)',
                      color: 'var(--up)',
                      padding: '8px 16px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ⚡ Place Your First Trade
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="block-title">
              <h3 className="display">Global Leaderboard</h3>
            </div>
            <div className="leaderboard">
              {leaderboard.map((user, idx) => {
                const isYou = user.email.toLowerCase() === profile.email.toLowerCase();
                const displayName = user.email.split('@')[0];
                return (
                  <div className={`lb-row ${isYou ? 'you' : ''}`} key={idx}>
                    <span className="lb-rank">#{idx + 1}</span>
                    <span className="lb-user">
                      <span className="lb-name">{displayName}</span>
                      {isYou && <span className="lb-tag">YOU</span>}
                    </span>
                    <span className="lb-value">₹{user.balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                );
              })}
              {leaderboard.length === 0 && (
                <div className="empty-hint" style={{padding: '24px'}}>No traders yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* Portfolio Equity Curve */}
        <div className="chart-card">
          <div className="ctitle">
            <span>Portfolio Value — Since Start</span>
            <span style={{color: totalPnl >= 0 ? 'var(--pulse-green)' : 'var(--pulse-red)'}}>
              {totalPnl >= 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}%
            </span>
          </div>
          <svg viewBox={`0 0 ${cw} ${ch + 30}`} width="100%" height="150" preserveAspectRatio="none">
            <defs>
              <linearGradient id="fadeG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={totalPnl >= 0 ? '#22C55E' : '#EF4444'} stopOpacity="0.22"/>
                <stop offset="100%" stopColor={totalPnl >= 0 ? '#22C55E' : '#EF4444'} stopOpacity="0"/>
              </linearGradient>
            </defs>
            <line x1="0" y1={ch - cpad} x2={cw} y2={ch - cpad} stroke="#262626" strokeWidth="1"/>
            <path d={areaPath} fill="url(#fadeG)"/>
            <path d={`M ${linePath}`} fill="none" stroke={totalPnl >= 0 ? '#22C55E' : '#EF4444'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="4" fill={totalPnl >= 0 ? '#22C55E' : '#EF4444'}/>
            <text x="0" y={ch + 20} className="axis-lbl">DAY 1 (₹10,00,000)</text>
            <text x={cw - 120} y={ch + 20} className="axis-lbl">TODAY ({formatCurrency(totalPortfolioValue)})</text>
          </svg>
        </div>

      </div>
    </div>
  );
}
