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
import { ChartView } from './components/ChartView/ChartView';

import { AlertPanel } from './components/Alerts/AlertPanel';
import { AlertToast } from './components/Alerts/AlertToast';
import { FundamentalsModal } from './components/FundamentalsModal/FundamentalsModal';
import { AnnouncementModal } from './components/Announcement/AnnouncementModal';
import { useAlerts } from './hooks/useAlerts';
import { useStocks } from './hooks/useStocks';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Login } from './components/Login/Login';
import { Paywall } from './components/Paywall/Paywall';
import { MaintenanceCountdown, TARGET_LAUNCH_TIME } from './components/Maintenance/MaintenanceCountdown';


import { motion, AnimatePresence } from 'framer-motion';
import { audioAlerts } from './utils/audioAlerts';
import { CyberIcon } from './components/common/CyberIcon';

function getTabHeader(tab: string, advancers: number, decliners: number, total: number) {
  switch (tab) {
    case 'Overview':
      return {
        eyebrow: 'MARKET OVERVIEW',
        title: (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            {advancers >= decliners ? "Today's tape is running green." : "Today's tape is running red."}
            <CyberIcon name={advancers >= decliners ? 'pulse_up' : 'pulse_down'} size={24} />
          </span>
        ),
        sub: (
          <>
            <b style={{ color: 'var(--up)', fontWeight: 700 }} className="tabular-nums">{advancers}▲</b> advancers vs{' '}
            <b style={{ color: 'var(--down)', fontWeight: 700 }} className="tabular-nums">{decliners}▼</b> decliners across{' '}
            <span className="tabular-nums">{total}</span> tracked stocks — real-time algorithmic scanner.
          </>
        )
      };
    case 'Table':
      return {
        eyebrow: 'EQUITY SCREENER',
        title: 'Market Screener Table',
        sub: (
          <>Real-time NSE multi-factor screener with volume spike detection, Day High/Low breaks, and relative volume telemetry.</>
        )
      };
    case 'Heatmap':
      return {
        eyebrow: 'VISUAL INTELLIGENCE',
        title: 'Market Heatmap',
        sub: (
          <>Treemap performance sized by volume and color-coded by real-time percentage change across sectors.</>
        )
      };
    case 'Sectors':
      return {
        eyebrow: 'SECTOR TELEMETRY',
        title: 'Sector Performance & Breadth',
        sub: (
          <>Sector rotation dynamics, advance/decline distribution, and cumulative volume pressure.</>
        )
      };
    case 'Technical':
      return {
        eyebrow: 'QUANT SIGNALS',
        title: 'Algorithmic Technical Screener',
        sub: (
          <>Automated detection for MACD weekly buy setups, RSI momentum, and EMA trend divergence.</>
        )
      };
    case 'Watchlist':
      return {
        eyebrow: 'PERSONAL MONITOR',
        title: 'My Monitored Equities',
        sub: (
          <>Fast-access customized watchlist with real-time price streaming and instant chart switching.</>
        )
      };
    case 'LiveNews':
      return {
        eyebrow: 'NEWS ALPHA WIRE',
        title: 'Real-Time Market News Alpha',
        sub: (
          <>Sub-second regulatory filings, corporate disclosures, block deal alerts & algorithmic sentiment scoring.</>
        )
      };
    case 'Results':
      return {
        eyebrow: 'CORPORATE DISCLOSURES',
        title: 'Earnings Results & Announcements',
        sub: (
          <>Live earnings declarations, quarterly profit margin beats/misses, and expected corporate reporting calendar.</>
        )
      };
    case 'Promoter':
      return {
        eyebrow: 'INSIDER ACTION',
        title: 'NSE Bulk Deals & Promoter Watch',
        sub: (
          <>Institutional block trades, promoter buying & insider stake movements tracked in real time.</>
        )
      };
    case 'PaperTrading':
      return {
        eyebrow: 'SIMULATION TERMINAL',
        title: 'Paper Trading Terminal',
        sub: (
          <>Simulated real-time trade execution with live LTP fills, automated margin accounting, and P&L tracking.</>
        )
      };
    case 'Admin':
      return {
        eyebrow: 'SYSTEM CONTROL',
        title: 'Admin Console & User Telemetry',
        sub: (
          <>Live active user sessions, subscription access tiers, and remote broadcast controls.</>
        )
      };
    default:
      return {
        eyebrow: tab.toUpperCase(),
        title: tab,
        sub: <>Real-time terminal view for {tab}.</>
      };
  }
}

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
      {/* Beast Cinematic Ambient Lighting & Noise Grain */}
      <div className="beast-grain" />
      <div className="beast-ambient-glow">
        <div className="glow-orb-1" />
        <div className="glow-orb-2" />
        <div className="glow-orb-3" />
      </div>

      <Sidebar />
      <div className="main">
        <Topbar allStocks={allStocks} alertCount={alertHistory.length} />

        <div className="content" style={activeTab === 'Charts' ? { padding: 0, overflow: 'hidden', height: '100%' } : {}}>
          {activeTab !== 'Charts' && (() => {
            const head = getTabHeader(activeTab, advancers, decliners, allStocks.length);
            return (
              <div className="page-head">
                <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="telemetry-dot live" />
                  <span>{head.eyebrow} · {new Date().toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--cyan)' }}>
                    LIVE STREAM
                  </span>
                </div>
                <div className="page-title" style={{ letterSpacing: '-0.025em' }}>
                  {head.title}
                </div>
                <div className="page-sub">
                  {head.sub}
                </div>
              </div>
            );
          })()}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{ width: '100%' }}
            >
              {activeTab === 'Charts' && <ChartView allStocks={allStocks} />}

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
              {activeTab === 'Heatmap' && <Heatmap stocks={allStocks} />}
              {activeTab === 'Sectors' && <SectorBreakdown sectorData={sectorData} />}
              {activeTab === 'Technical' && <TechnicalScanner />}
              {activeTab === 'Watchlist' && <MarketTableWidget fullView={true} watchlistOnly={true} />}
              {activeTab === 'LiveNews' && <LiveNewsFeed />}
              {activeTab === 'Results' && <EarningsResults />}
              {activeTab === 'Promoter' && <PromoterWatch />}
              {activeTab === 'PaperTrading' && <PaperTradingDashboard />}
              {activeTab === 'Admin' && <AdminDashboard />}
            </motion.div>
          </AnimatePresence>

        </div>
      </div>

      {/* Alert Overlay Components */}
      <AlertPanel alerts={alertHistory} onClearAll={clearAll} />
      <FundamentalsModal stocks={allStocks} />
      <AlertToast toasts={toasts} onDismiss={dismissToast} />
      <AnnouncementModal />

      {/* Floating Customize Button */}
      <div
        className="beast-btn"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 120,
          padding: '9px 14px',
          borderRadius: 12,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
        onClick={() => {
          audioAlerts.playHapticClick();
          setIsCustomizing(!isCustomizing);
        }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
        <span style={{ fontSize: 12, fontWeight: 700 }}>Customize Grid</span>
      </div>

      {/* Customize Panel */}
      {isCustomizing && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="beast-card"
          style={{
            position: 'fixed',
            bottom: 70,
            right: 20,
            padding: 18,
            width: 260,
            zIndex: 100
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>Terminal Widgets</h3>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--up)' }}>ACTIVE</span>
          </div>
          {Object.entries(preferences).map(([key, value]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 12.5, color: 'var(--text-2)' }}>
              <span style={{ fontWeight: 600 }}>{key.replace('show', '')}</span>
              <input
                type="checkbox"
                checked={value as boolean}
                onChange={() => {
                  audioAlerts.playHapticClick();
                  toggleWidget(key as keyof typeof preferences);
                }}
                style={{ cursor: 'pointer', accentColor: 'var(--up)' }}
              />
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isTrialExpired } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#04060c',
        color: '#00f59b',
        fontFamily: 'monospace',
        fontSize: '14px',
        letterSpacing: '0.1em'
      }}>
        INITIALIZING TERMINAL...
      </div>
    );
  }

  // Strictly block unauthenticated visitors - redirect directly to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check trial expiration
  if (isTrialExpired) {
    return <Paywall />;
  }

  return <>{children}</>;
}

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return Date.now() >= TARGET_LAUNCH_TIME;
  });

  // Strict Total Lockdown: NOT EVEN ADMIN IS PERMITTED IN UNTIL 09:18 AM IST
  if (!isUnlocked) {
    return <MaintenanceCountdown onUnlock={() => setIsUnlocked(true)} />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <SocketProvider>
      <AuthProvider>
        <DashboardProvider>
          <MaintenanceGate>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/paywall" element={<Paywall />} />
              <Route path="/overview" element={<Navigate to="/" replace />} />
              <Route path="/" element={<ProtectedRoute><AppContent /></ProtectedRoute>} />
              <Route path="/table" element={<ProtectedRoute><AppContent /></ProtectedRoute>} />
              <Route path="/heatmap" element={<ProtectedRoute><AppContent /></ProtectedRoute>} />
              <Route path="/sectors" element={<ProtectedRoute><AppContent /></ProtectedRoute>} />
              <Route path="/charts" element={<ProtectedRoute><AppContent /></ProtectedRoute>} />
              <Route path="/technical" element={<ProtectedRoute><AppContent /></ProtectedRoute>} />
              <Route path="/watchlist" element={<ProtectedRoute><AppContent /></ProtectedRoute>} />
              <Route path="/news" element={<ProtectedRoute><AppContent /></ProtectedRoute>} />
              <Route path="/results" element={<ProtectedRoute><AppContent /></ProtectedRoute>} />
              <Route path="/promoter" element={<ProtectedRoute><AppContent /></ProtectedRoute>} />
              <Route path="/papertrading" element={<ProtectedRoute><AppContent /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AppContent /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </MaintenanceGate>
        </DashboardProvider>
      </AuthProvider>
    </SocketProvider>
  );
}




