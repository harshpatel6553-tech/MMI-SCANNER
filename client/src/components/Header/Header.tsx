import { useState, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';
import { formatTime } from '../../utils/formatters';
import './Header.css';

export function Header() {
  const { isConnected, lastUpdate, stockCount } = useSocket();
  const { signOut } = useAuth();
  const [marketOpen, setMarketOpen] = useState(false);

  useEffect(() => {
    const checkMarket = () => {
      const now = new Date();
      const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const day = ist.getDay();
      const hours = ist.getHours();
      const minutes = ist.getMinutes();
      const time = hours * 60 + minutes;
      const open = day >= 1 && day <= 5 && time >= 555 && time <= 930; // 9:15 - 15:30
      setMarketOpen(open);
    };
    checkMarket();
    const interval = setInterval(checkMarket, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="header glass-card">
      <div className="header-scanner-beam" />
      <div className="header-content">
        <div className="header-left">
          <img src="/logo.jpg" className="header-logo-img" alt="Market Minds Investment Logo" />
          <h1 className="header-title">MARKET MINDS INVESTMENT SCANNER</h1>
        </div>

        <div className="header-center">
          <div className={`market-badge ${marketOpen ? 'market-open' : 'market-closed'}`}>
            <span className="market-dot" />
            <span>{marketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}</span>
          </div>
        </div>

        <div className="header-right">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot" />
            <span className="status-rings">
              <span className="ring" />
              <span className="ring" />
            </span>
            <span>{isConnected ? 'Live' : 'Offline'}</span>
          </div>
          <div className="stock-count-badge pill pill-accent">
            {stockCount} stocks
          </div>
          {lastUpdate && (
            <div className="last-update text-muted">
              {formatTime(lastUpdate)}
            </div>
          )}
          <button className="header-logout-btn" onClick={signOut}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Logout
          </button>
        </div>
      </div>
      <div className="header-border-glow" />
    </header>
  );
}
