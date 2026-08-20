import React from 'react';
import { useDashboard } from '../../contexts/DashboardContext';

export function Sidebar() {
  const { activeTab, setActiveTab } = useDashboard();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">M</div>
        <div>
          <div className="brand-name">Market Minds</div>
          <div className="brand-sub">Investment Scanner</div>
        </div>
      </div>

      <div className="nav-scroll">
        <div className="nav-group">
          <div className="nav-label">Markets</div>
          <div className={`nav-item ${activeTab === 'Overview' ? 'active' : ''}`} onClick={() => setActiveTab('Overview')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
            <span>Overview</span>
          </div>
          <div className={`nav-item ${activeTab === 'Table' ? 'active' : ''}`} onClick={() => setActiveTab('Table')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
            <span>Table</span><span className="nav-badge">503</span>
          </div>
          <div className={`nav-item ${activeTab === 'Heatmap' ? 'active' : ''}`} onClick={() => setActiveTab('Heatmap')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="10" rx="1"/></svg>
            <span>Heatmap</span>
          </div>
          <div className={`nav-item ${activeTab === 'Sectors' ? 'active' : ''}`} onClick={() => setActiveTab('Sectors')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 3"/></svg>
            <span>Sectors</span>
          </div>
        </div>

        <div className="nav-group">
          <div className="nav-label">Signals</div>
          <div className="nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h4l3 8 4-16 3 8h4"/></svg><span>Technical</span><span className="nav-badge">13</span></div>
          <div className="nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7L12 17.3 5.7 20.9l1.7-7L2 9.2l7.1-.6z"/></svg><span>Watchlist</span><span className="nav-badge">1</span></div>
        </div>

        <div className="nav-group">
          <div className="nav-label">Research</div>
          <div className="nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v14a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg><span>Live News</span></div>
          <div className="nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 2h6l1 4h-8z"/><rect x="4" y="6" width="16" height="16" rx="2"/></svg><span>Results</span></div>
          <div className="nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg><span>Promoter Watch</span></div>
        </div>

        <div className="nav-group">
          <div className="nav-label">Tools</div>
          <div className="nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg><span>Paper Trading</span></div>
        </div>

        <div className="nav-group">
          <div className="nav-label">Account</div>
          <div className="nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/></svg><span>Admin Panel</span></div>
        </div>
      </div>

      <div className="sidebar-foot">
        <div className="status-chip"><span className="dot-live"></span><span>503 stocks · live feed</span></div>
      </div>
    </aside>
  );
}
