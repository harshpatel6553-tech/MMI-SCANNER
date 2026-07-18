import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';
import { formatTime } from '../../utils/formatters';
import { Shield, LogOut } from 'lucide-react';
import './Header.css';

export function Header() {
  const navigate = useNavigate();
  const { isConnected, lastUpdate, stockCount } = useSocket();
  const { profile, signOut } = useAuth();
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
          {profile?.is_admin && (
            <button className="btn btn-secondary" onClick={() => navigate('/admin')}>
              <Shield size={16} />
              Admin Panel
            </button>
          )}
          <button className="btn btn-ghost" onClick={signOut}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>
      <div className="header-border-glow" />
    </header>
  );
}
