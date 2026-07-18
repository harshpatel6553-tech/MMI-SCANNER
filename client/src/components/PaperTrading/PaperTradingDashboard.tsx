import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStocks } from '../../hooks/useStocks';
import './PaperTradingDashboard.css';

interface Position {
  id: string;
  symbol: string;
  quantity: number;
  average_price: number;
}

interface Portfolio {
  balance: number;
}

import { TradeModal } from './TradeModal';
import type { StockData } from '../../types';

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
      const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
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
    const interval = setInterval(fetchPortfolio, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [profile]);

  if (!profile) {
    return <div className="paper-trading-container">Please log in to use Paper Trading.</div>;
  }

  if (loading) {
    return <div className="paper-trading-container loading">Loading Portfolio...</div>;
  }

  // Calculate live P&L
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
    totalInvested += Math.abs(invested); // Display absolute invested amount
    totalPnl += pnl; // Properly sum P&L including short directions

    return { ...pos, livePrice, value, pnl, pnlPercent };
  });

  const totalPortfolioValue = (portfolio?.balance || 0) + totalPositionValue;
  const availableMargin = (portfolio?.balance || 0) - shortLiability;

  return (
    <div className="paper-trading-container">
      <div className="portfolio-header glass-card">
        <div className="stat-box">
          <span className="stat-label">Total Portfolio Value</span>
          <span className="stat-value">₹{totalPortfolioValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Available Margin</span>
          <span className="stat-value">₹{availableMargin.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Total Invested</span>
          <span className="stat-value">₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Total P&L</span>
          <span className={`stat-value ${totalPnl >= 0 ? 'bullish' : 'bearish'}`}>
            {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="positions-card glass-card">
          <h3>Open Positions</h3>
          {positionsWithLivePrice.length === 0 ? (
            <p className="empty-state">No open positions. Use the Trade button on any stock to start buying!</p>
          ) : (
            <div className="table-responsive">
              <table className="positions-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Qty</th>
                    <th>Avg Price</th>
                    <th>LTP</th>
                    <th>Unrealized P&L</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {positionsWithLivePrice.map(pos => (
                    <tr key={pos.id}>
                      <td className="symbol">{pos.symbol}</td>
                      <td className={pos.quantity < 0 ? 'bearish' : ''}>{pos.quantity}</td>
                      <td>₹{pos.average_price.toFixed(2)}</td>
                      <td>₹{pos.livePrice.toFixed(2)}</td>
                      <td className={pos.pnl >= 0 ? 'bullish' : 'bearish'}>
                        ₹{pos.pnl.toFixed(2)} ({pos.pnlPercent.toFixed(2)}%)
                      </td>
                      <td>
                        <button 
                          className="btn btn-primary"
                          onClick={() => {
                            const stockData = stocks.find(s => s.symbol === pos.symbol);
                            if (stockData) setTradeStock(stockData);
                          }}
                        >
                          Trade
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="leaderboard-card glass-card">
          <h3>Global Leaderboard</h3>
          <div className="leaderboard-list">
            {leaderboard.map((user, idx) => (
              <div key={idx} className="leaderboard-item">
                <span className="rank">#{idx + 1}</span>
                <span className="email">{user.email.split('@')[0]}</span>
                <span className="balance">₹{user.balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {tradeStock && (
        <TradeModal 
          isOpen={!!tradeStock} 
          onClose={() => setTradeStock(null)} 
          stock={tradeStock} 
          onTradeComplete={fetchPortfolio}
        />
      )}
    </div>
  );
}
