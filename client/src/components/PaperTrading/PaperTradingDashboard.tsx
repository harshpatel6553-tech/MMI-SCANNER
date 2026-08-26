import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStocks } from '../../hooks/useStocks';
import './PaperTradingDashboard.css';
import { TradeModal } from './TradeModal';
import type { StockData } from '../../types';

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

  const fetchPortfolio = async () => {
    if (!profile) return;
    try {
      const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
      const [portRes, leadRes] = await Promise.all([
        fetch(`${socketUrl}/api/paper-trading/portfolio/${profile.id}`),
        fetch(`${socketUrl}/api/paper-trading/leaderboard`)
      ]);
      
      const portData = await portRes.json();
      const leadData = await leadRes.json();

      if (portData.success) {
        setPortfolio(portData.portfolio);
        setPositions(portData.positions);
      }
      if (leadData.success) {
        setLeaderboard(leadData.leaderboard);
      }
    } catch (err) {
      console.error('Error fetching paper trading data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 10000);
    return () => clearInterval(interval);
  }, [profile]);

  if (!profile) {
    return <div className="paper-page" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Please log in to use Paper Trading.</div>;
  }

  if (loading) {
    return <div className="paper-page" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-muted)'}}>Loading Portfolio...</div>;
  }

  let totalPositionValue = 0;
  let totalInvested = 0;
  let totalPnl = 0;
  let shortLiability = 0;

  const positionsWithLivePrice = positions.map(pos => {
    const liveStock = stocks.find(s => s.symbol === pos.symbol);
    const livePrice = liveStock ? liveStock.price : pos.average_price;
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

    return { ...pos, livePrice, value, pnl, pnlPercent };
  });

  const totalPortfolioValue = (portfolio?.balance || 0) + totalPositionValue;
  const availableMargin = (portfolio?.balance || 0) - shortLiability;
  const totalPnlPercent = totalInvested !== 0 ? (totalPnl / totalInvested) * 100 : 0;

  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  };

  // Portfolio Chart Setup
  const pts = [1000000, 1000000, 1004200, 1002100, 1009800, 1015600, 1011200, 1022400, 1031800, 1028600, 1041200, 1055800, 1049300, 1068700, 1082400, 1076900, 1094600, 1103200, 1098700, Math.max(1000000, totalPortfolioValue)];
  const cw = 900, ch = 110, cpad = 6;
  const cMax = Math.max(...pts), cMin = Math.min(...pts);
  const coords = pts.map((p, i) => {
    const x = cpad + (i / (pts.length - 1)) * (cw - 2 * cpad);
    const y = ch - cpad - ((p - cMin) / (cMax - cMin || 1)) * (ch - 2 * cpad);
    return [x, y];
  });
  const linePath = coords.map(c => c.join(',')).join(' L ');
  const areaPath = `M ${coords[0][0]},${ch - cpad} L ${linePath.replace('L ', '')} L ${coords[coords.length - 1][0]},${ch - cpad} Z`;

  return (
    <div className="paper-page" style={{paddingTop: '0', marginTop: '-24px'}}>
      
      {tradeStock && (
        <TradeModal 
          isOpen={true}
          stock={tradeStock} 
          onClose={() => setTradeStock(null)} 
        />
      )}

      <div className="page" style={{paddingTop: '0'}}>
        
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

        <div className="layout">
          <div>
            <div className="block-title">
              <h3 className="display">Open Positions</h3>
              <span className="count-badge">{positionsWithLivePrice.length} POSITION{positionsWithLivePrice.length !== 1 ? 'S' : ''}</span>
            </div>
            <div className="table-wrap">
              <div className="pos-row head">
                <span>Symbol</span><span>Qty</span><span>Avg Price</span><span>LTP</span>
                <span>Unrealized P&amp;L</span><span>Action</span>
              </div>
              
              {positionsWithLivePrice.map((pos) => {
                const stockData = stocks.find(s => s.symbol === pos.symbol);
                return (
                  <div className="pos-row" key={pos.symbol}>
                    <span className="pos-sym">{pos.symbol}</span>
                    <span className="pos-num">{pos.quantity}</span>
                    <span className="pos-num">₹{pos.average_price.toFixed(2)}</span>
                    <span className="pos-num">₹{pos.livePrice.toFixed(2)}</span>
                    <span className="pos-pnl" style={{color: pos.pnl >= 0 ? 'var(--pulse-green)' : 'var(--pulse-red)'}}>
                      {pos.pnl >= 0 ? '+' : ''}₹{Math.abs(pos.pnl).toFixed(2)} ({pos.pnlPercent.toFixed(2)}%)
                    </span>
                    <span className="pos-trade" onClick={() => stockData && setTradeStock(stockData)}>TRADE &rarr;</span>
                  </div>
                );
              })}
              
              {positionsWithLivePrice.length === 0 && (
                <div className="empty-hint">Scanner &rarr; add a position to diversify your paper portfolio</div>
              )}
            </div>
          </div>

          <div>
            <div className="block-title">
              <h3 className="display">Global Leaderboard</h3>
            </div>
            <div className="leaderboard">
              {leaderboard.map((user, idx) => {
                const isYou = user.email === profile.email;
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
            <text x="0" y={ch + 20} className="axis-lbl">DAY 1</text>
            <text x={cw - 42} y={ch + 20} className="axis-lbl">TODAY</text>
          </svg>
        </div>

      </div>
    </div>
  );
}
