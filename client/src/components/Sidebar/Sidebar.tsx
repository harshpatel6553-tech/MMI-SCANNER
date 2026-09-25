import React from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { useAuth } from '../../context/AuthContext';
import { ProfileDropdown } from '../Topbar/ProfileDropdown';
import { audioAlerts } from '../../utils/audioAlerts';
import { CyberIcon } from '../common/CyberIcon';

export function Sidebar() {
  const { activeTab, setActiveTab } = useDashboard();
  const { profile } = useAuth();
  const { count } = useWatchlist();

  const handleTabChange = (tab: string) => {
    audioAlerts.playHapticClick();
    setActiveTab(tab as any);
  };

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="brand" onClick={() => handleTabChange('Overview')} style={{ cursor: 'pointer' }}>
        <div className="brand-mark" style={{
          width: 38,
          height: 38,
          borderRadius: 9,
          background: '#ffffff',
          border: '1px solid rgba(0, 245, 155, 0.4)',
          boxShadow: '0 0 16px rgba(0, 245, 155, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: 2,
          flexShrink: 0
        }}>
          <img 
            src="/logo.jpg" 
            alt="MMI Logo" 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain', 
              borderRadius: 7,
              display: 'block' 
            }} 
          />
        </div>
        <div>
          <div className="brand-name" style={{ letterSpacing: '-0.025em', fontWeight: 800 }}>Market Minds</div>
          <div className="brand-sub" style={{ color: 'var(--up)', fontWeight: 600 }}>TERMINAL EDITION</div>
        </div>
      </div>

      {/* Nav List */}
      <div className="nav-scroll">
        <div className="nav-group">
          <div className="nav-label">Core Markets</div>
          
          <div 
            className={`nav-item ${activeTab === 'Overview' ? 'active' : ''}`} 
            onClick={() => handleTabChange('Overview')}
          >
            <CyberIcon name="overview" size={20} active={activeTab === 'Overview'} />
            <span>Overview</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'Table' ? 'active' : ''}`} 
            onClick={() => handleTabChange('Table')}
          >
            <CyberIcon name="table" size={20} active={activeTab === 'Table'} />
            <span>Market Table</span>
            <span className="nav-badge">503</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'Heatmap' ? 'active' : ''}`} 
            onClick={() => handleTabChange('Heatmap')}
          >
            <CyberIcon name="heatmap" size={20} active={activeTab === 'Heatmap'} />
            <span>Heatmap</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'Sectors' ? 'active' : ''}`} 
            onClick={() => handleTabChange('Sectors')}
          >
            <CyberIcon name="sectors" size={20} active={activeTab === 'Sectors'} />
            <span>Sector Pulse</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'Charts' ? 'active' : ''}`} 
            onClick={() => handleTabChange('Charts')}
          >
            <CyberIcon name="charts" size={20} active={activeTab === 'Charts'} />
            <span>Pro Charts</span>
            <span className="nav-badge" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', fontWeight: 800 }}>PRO</span>
          </div>
        </div>

        <div className="nav-group">
          <div className="nav-label">Algorithmic Signals</div>
          
          <div 
            className={`nav-item ${activeTab === 'Technical' ? 'active' : ''}`} 
            onClick={() => handleTabChange('Technical')}
          >
            <CyberIcon name="technical" size={20} active={activeTab === 'Technical'} />
            <span>Technical Screener</span>
            <span className="nav-badge" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>13</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'Watchlist' ? 'active' : ''}`} 
            onClick={() => handleTabChange('Watchlist')}
          >
            <CyberIcon name="watchlist" size={20} active={activeTab === 'Watchlist'} />
            <span>My Watchlist</span>
            {count > 0 && <span className="nav-badge">{count}</span>}
          </div>
        </div>

        <div className="nav-group">
          <div className="nav-label">Intelligence</div>
          
          <div 
            className={`nav-item ${activeTab === 'LiveNews' ? 'active' : ''}`} 
            onClick={() => handleTabChange('LiveNews')}
          >
            <CyberIcon name="livenews" size={20} active={activeTab === 'LiveNews'} />
            <span>Live News Alpha</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'Results' ? 'active' : ''}`} 
            onClick={() => handleTabChange('Results')}
          >
            <CyberIcon name="results" size={20} active={activeTab === 'Results'} />
            <span>Quarterly Results</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'Promoter' ? 'active' : ''}`} 
            onClick={() => handleTabChange('Promoter')}
          >
            <CyberIcon name="promoter" size={20} active={activeTab === 'Promoter'} />
            <span>Promoter Watch</span>
          </div>
        </div>

        <div className="nav-group">
          <div className="nav-label">Simulations</div>
          
          <div 
            className={`nav-item ${activeTab === 'PaperTrading' ? 'active' : ''}`} 
            onClick={() => handleTabChange('PaperTrading')}
          >
            <CyberIcon name="papertrading" size={20} active={activeTab === 'PaperTrading'} />
            <span>Paper Trading</span>
          </div>
        </div>

        {profile?.is_admin && (
          <div className="nav-group">
            <div className="nav-label">Terminal System</div>
            
            <div 
              className={`nav-item ${activeTab === 'Admin' ? 'active' : ''}`} 
              onClick={() => handleTabChange('Admin')}
            >
              <CyberIcon name="admin" size={20} active={activeTab === 'Admin'} />
              <span>Admin Console</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer User Profile */}
      <div className="sidebar-foot">
        <ProfileDropdown />
      </div>
    </aside>
  );
}
