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
            <div className="eyebrow">{activeTab} Â· {new Date().toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</div>
            <div className="page-title">
              {activeTab === 'Overview' 
                ? (advancers >= decliners ? "Today's tape is running green." : "Today's tape is running red.")
                : activeTab}
            </div>
            <div className="page-sub">
              <b style={{ color: 'var(--up)', fontWeight: 600 }}>{advancers}â–²</b> advancers vs <b style={{ color: 'var(--down)', fontWeight: 600 }}>{decliners}â–¼</b> decliners across {allStocks.length} tracked stocks â€” here's what's moving.
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
          {activeTab === 'Watchlist' && <div className="card" style={{ padding: 24 }}>Full Watchlist view under construction. Use Overview widget.</div>}
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
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--text-1)" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
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
      background: '#040504',
      color: '#ffffff',
      fontFamily: 'Space Grotesk, Outfit, sans-serif',
      padding: '20px',
      textAlign: 'center',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Watermelon Neon Glow Effects */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(255, 71, 126, 0.12) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0 }}></div>
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(6, 214, 160, 0.08) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0 }}></div>

      {/* Backend Telemetry Background */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 0,
        opacity: 0.15,
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#06d6a0',
        textAlign: 'left',
        padding: '40px',
        lineHeight: '1.8',
        pointerEvents: 'none',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '40px',
        userSelect: 'none'
      }}>
        <div>
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={`l-${i}`}>
              <span style={{ color: '#ff477e' }}>[SYS.MAINTENANCE]</span> {new Date(Date.now() - i * 10000).toISOString()} - Re-routing data streams... [OFFLINE]<br />
              <span style={{ color: '#ffffff' }}>[SUPABASE.DB]</span> Disconnecting active WebSocket pool [PID: {Math.floor(Math.random() * 9000 + 1000)}]... OK<br />
              <span style={{ color: '#06d6a0' }}>[SCRAPER.PUPPETEER]</span> Terminating invisible Chromium instances... SHUTDOWN<br />
              <br />
            </div>
          ))}
        </div>
        <div>
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={`r-${i}`}>
              <span style={{ color: '#ffffff' }}>[ENGINE.CORE]</span> Updating Nifty 50 & 500 tracking arrays... IN PROGRESS<br />
              <span style={{ color: '#ff477e' }}>[API.YAHOO]</span> Rate limit reset sequence initiated [Wait: {Math.floor(Math.random() * 10)}ms]<br />
              <span style={{ color: '#06d6a0' }}>[MARKET.MINDS]</span> Awaiting new deployment artifact from ghcr.io...<br />
              <br />
            </div>
          ))}
        </div>
      </div>

      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: '700px',
        border: '1px solid rgba(255, 71, 126, 0.3)',
        padding: '56px',
        borderRadius: '24px',
        background: 'rgba(15, 18, 15, 0.7)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 24px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
      }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 16px',
          background: 'rgba(255, 71, 126, 0.1)',
          border: '1px solid rgba(255, 71, 126, 0.5)',
          borderRadius: '100px',
          color: '#ff477e',
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '1px',
          marginBottom: '24px',
          textTransform: 'uppercase'
        }}>
          Ã¢â€”Â Offline for Upgrades
        </div>

        <h1 style={{
          fontSize: '42px',
          fontWeight: 800,
          marginBottom: '20px',
          letterSpacing: '-1.5px',
          lineHeight: '1.1',
          background: 'linear-gradient(135deg, #ffffff 0%, #a0a5a0 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          MARKET MINDS IS <br />EVOLVING
        </h1>

        <p style={{
          fontSize: '18px',
          color: '#8a958a',
          lineHeight: '1.6',
          marginBottom: '40px',
          maxWidth: '500px',
          margin: '0 auto 40px auto'
        }}>
          We are currently deploying massive upgrades to our real-time scanning infrastructure. The tape will resume shortly.
        </p>

        <div style={{
          padding: '24px',
          background: 'rgba(6, 214, 160, 0.05)',
          border: '1px solid rgba(6, 214, 160, 0.2)',
          borderRadius: '12px',
          fontSize: '15px',
          color: '#a0a5a0'
        }}>
          For priority support or further queries, please contact <br />
          <b style={{
            color: '#06d6a0',
            fontSize: '18px',
            display: 'inline-block',
            marginTop: '12px',
            letterSpacing: '0.5px'
          }}>
            MARKET MINDS OWNERS
          </b>
        </div>
      </div>
    </div>
  );
}



export default function App() {
  return (
    <SocketProvider>
      <AuthProvider>
        <DashboardProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/paywall" element={<Paywall />} />
            <Route path="/" element={
              <ProtectedRoute>
                <AppContent />
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DashboardProvider>
      </AuthProvider>
    </SocketProvider>
  );
}


