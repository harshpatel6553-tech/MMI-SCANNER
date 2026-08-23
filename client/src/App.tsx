import React, { useState } from 'react';
import { SocketProvider } from './context/SocketContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardProvider, useDashboard } from './contexts/DashboardContext';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Topbar } from './components/Topbar/Topbar';
import { StatsWidget } from './components/Widgets/StatsWidget';
import { AdvanceDeclineWidget } from './components/Widgets/AdvanceDeclineWidget';
import { TopMoversWidget } from './components/Widgets/TopMoversWidget';
import { SectorPulseWidget } from './components/Widgets/SectorPulseWidget';
import { LiveNewsWidget } from './components/Widgets/LiveNewsWidget';
import { WatchlistWidget } from './components/Widgets/WatchlistWidget';
import { MarketTableWidget } from './components/Widgets/MarketTableWidget';
import { Heatmap } from './components/Heatmap/Heatmap';
import { SectorBreakdown } from './components/SectorBreakdown/SectorBreakdown';
import { TechnicalScanner } from './components/TechnicalScanner/TechnicalScanner';
import { LiveNewsFeed } from './components/LiveNewsFeed/LiveNewsFeed';
import { EarningsResults } from './components/EarningsResults/EarningsResults';
import { PromoterWatch } from './components/PromoterWatch/PromoterWatch';
import { PaperTradingDashboard } from './components/PaperTrading/PaperTradingDashboard';
import { AdminDashboard } from './components/AdminDashboard/AdminDashboard';
import { AlertPanel } from './components/Alerts/AlertPanel';
import { AlertToast } from './components/Alerts/AlertToast';
import { FundamentalsModal } from './components/FundamentalsModal/FundamentalsModal';
import { useAlerts } from './hooks/useAlerts';
import { useStocks } from './hooks/useStocks';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/Login/Login';
import { Paywall } from './components/Paywall/Paywall';


function AppContent() {
  const { preferences, toggleWidget, activeTab, isCustomizing, setIsCustomizing, searchQuery } = useDashboard();
  const { toasts, alertHistory, dismissToast, clearAll } = useAlerts();
  
  // Initialize WebSocket and fetch stocks
  const { allStocks, stats, sectorData, stocks } = useStocks({ 
    index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: searchQuery 
  }, 'volume', 'desc');

  const advancers = allStocks.filter(s => s.change >= 0).length;
  const decliners = allStocks.length - advancers;
  
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar allStocks={allStocks} />
        
        <div className="content">
          <div className="page-head">
            <div className="eyebrow">{activeTab} · Thu, 20 Aug 2026</div>
            <div className="page-title">
              {activeTab === 'Overview' ? "Today's tape is running green." : activeTab}
            </div>
            <div className="page-sub">
               <b style={{color: 'var(--up)', fontWeight: 600}}>{advancers}▲</b> advancers vs <b style={{color: 'var(--down)', fontWeight: 600}}>{decliners}▼</b> decliners across {allStocks.length} tracked stocks — here's what's moving.
            </div>
          </div>

          {activeTab === 'Overview' && (
            <>
              {preferences.showStats && <StatsWidget />}
              {preferences.showAdvanceDecline && <AdvanceDeclineWidget />}

              <div className="grid-2">
                {preferences.showTopMovers && <TopMoversWidget />}
                {preferences.showSectorPulse && <SectorPulseWidget />}
              </div>

              <div className="grid-2">
                {preferences.showLiveNews && <LiveNewsWidget />}
                {preferences.showWatchlist && <WatchlistWidget />}
              </div>
            </>
          )}

          {activeTab === 'Table' && <MarketTableWidget fullView={true} />}
          {activeTab === 'Heatmap' && <Heatmap stocks={stocks} />}
          {activeTab === 'Sectors' && <SectorBreakdown sectorData={sectorData} />}
          {activeTab === 'Technical' && <TechnicalScanner />}
          {activeTab === 'Watchlist' && <div className="card" style={{padding: 24}}>Full Watchlist view under construction. Use Overview widget.</div>}
          {activeTab === 'LiveNews' && <LiveNewsFeed />}
          {activeTab === 'Results' && <EarningsResults />}
          {activeTab === 'Promoter' && <PromoterWatch />}
          {activeTab === 'PaperTrading' && <PaperTradingDashboard />}
          {activeTab === 'Admin' && <AdminDashboard />}
        </div>
      </div>
      
      {/* Alert Overlay Components */}
      <AlertPanel alerts={alertHistory} onClearAll={clearAll} />
      <FundamentalsModal stocks={allStocks} />
      <AlertToast toasts={toasts} onDismiss={dismissToast} />

      {/* Floating Customize Button */}
      <div 
        style={{
          position: 'fixed', 
          bottom: 20, 
          right: 20, 
          background: 'var(--bg-surface)', 
          border: '1px solid var(--border)', 
          padding: 10, 
          borderRadius: 8,
          cursor: 'pointer',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
        onClick={() => setIsCustomizing(!isCustomizing)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--text-1)" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
        <span style={{ color: 'var(--text-1)', fontSize: 13, fontWeight: 600 }}>Customize Layout</span>
      </div>

      {/* Customize Panel */}
      {isCustomizing && (
        <div style={{
          position: 'fixed',
          bottom: 70,
          right: 20,
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 16,
          width: 250,
          zIndex: 100
        }}>
          <h3 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-1)' }}>Dashboard Widgets</h3>
          {Object.entries(preferences).map(([key, value]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'var(--text-2)' }}>
              <span>{key.replace('show', '')}</span>
              <input 
                type="checkbox" 
                checked={value as boolean} 
                onChange={() => toggleWidget(key as keyof typeof preferences)} 
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isTrialExpired, loading } = useAuth();
  
  if (loading) return <div className="app" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-app)', color: 'white' }}>Verifying Account...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (isTrialExpired) return <Navigate to="/paywall" replace />;
  
  return <>{children}</>;
}

function Maintenance() {
  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#0b0b0d', // fallback if var(--bg-app) is missing
      backgroundColor: 'var(--bg-app)',
      color: 'var(--text-1)',
      fontFamily: 'Outfit, sans-serif',
      padding: '20px',
      textAlign: 'center',
      boxSizing: 'border-box'
    }}>
      <div style={{ maxWidth: '600px', border: '1px solid var(--border)', padding: '48px', borderRadius: '12px', background: 'var(--bg-surface)' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '16px', letterSpacing: '-0.5px', color: 'var(--text-1)' }}>SYSTEM UNDER MAINTENANCE</h1>
        <p style={{ fontSize: '15px', color: 'var(--text-2)', lineHeight: '1.6', marginBottom: '32px' }}>
          We are currently upgrading our backend infrastructure to provide a more stable and powerful real-time scanning experience. The application will be temporarily unavailable.
        </p>
        <div style={{ padding: '16px', background: 'var(--bg-surface-2)', border: '1px dashed var(--border)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-2)' }}>
          For further queries, please contact <br/>
          <b style={{ color: 'var(--text-1)', fontSize: '16px', display: 'inline-block', marginTop: '8px' }}>MARKET MINDS OWNERS</b>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return <Maintenance />;
}
