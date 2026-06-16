import { useState, useCallback } from 'react';
import { SocketProvider } from './context/SocketContext';
import { useStocks } from './hooks/useStocks';
import { useAlerts } from './hooks/useAlerts';
import { useWatchlist } from './hooks/useWatchlist';
import { Header } from './components/Header/Header';
import { SearchBar } from './components/SearchBar/SearchBar';
import { FilterPanel } from './components/Filters/FilterPanel';
import { StockTable } from './components/StockTable/StockTable';
import { MarketBreadth } from './components/MarketBreadth/MarketBreadth';
import { ViewTabs } from './components/ViewTabs/ViewTabs';
import { Heatmap } from './components/Heatmap/Heatmap';
import { SectorBreakdown } from './components/SectorBreakdown/SectorBreakdown';
import { LiveNewsFeed } from './components/LiveNewsFeed/LiveNewsFeed';
import { NewsTicker } from './components/NewsTicker/NewsTicker';
import { AlertToast } from './components/Alerts/AlertToast';
import { AlertPanel } from './components/Alerts/AlertPanel';
import { StatusBar } from './components/StatusBar/StatusBar';
import { AnimatedBackground } from './components/AnimatedBackground/AnimatedBackground';
import { LoadingScreen } from './components/LoadingScreen/LoadingScreen';
import { StockDetailModal } from './components/StockDetailModal/StockDetailModal';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Login } from './components/Login/Login';
import { Paywall } from './components/Paywall/Paywall';
import { AdminDashboard } from './components/AdminDashboard/AdminDashboard';
import { UpdatePasswordModal } from './components/UpdatePasswordModal/UpdatePasswordModal';
import type { FilterOptions, SortField, SortOrder, StockData } from './types';
import './App.css';

function AppContent() {
  const [filters, setFilters] = useState<FilterOptions>({
    index: 'ALL',
    priceMin: 0,
    priceMax: 0,
    volumeMin: 0,
    search: '',
  });
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [activeTab, setActiveTab] = useState<'table' | 'heatmap' | 'sectors' | 'watchlist' | 'news'>('table');
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);

  const { stocks, allStocks, stats, priceFlash, sectorData } = useStocks(filters, sortField, sortOrder);
  const { toasts, alertHistory, dismissToast, clearAll } = useAlerts();
  const { watchlist, toggle: toggleWatchlist, count: watchlistCount } = useWatchlist();

  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        return field;
      }
      setSortOrder('asc');
      return field;
    });
  }, []);

  const handleSearch = useCallback((search: string) => {
    setFilters(prev => ({ ...prev, search }));
  }, []);

  // Filter stocks for watchlist view
  const watchlistStocks = activeTab === 'watchlist'
    ? stocks.filter(s => watchlist.has(s.symbol))
    : stocks;

  return (
    <div className="app">
      <AnimatedBackground />
      <Header />
      <NewsTicker />

      <main className="app-main">
        {(activeTab === 'table' || activeTab === 'watchlist') && (
          <div className="app-controls">
            <SearchBar
              value={filters.search}
              onChange={handleSearch}
              matchCount={activeTab === 'watchlist' ? watchlistStocks.length : stocks.length}
            />
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              stats={stats}
            />
          </div>
        )}

        <MarketBreadth stats={stats} />
        <ViewTabs
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as any)}
          watchlistCount={watchlistCount}
        />

        {activeTab === 'table' && (
          <div className="app-table">
            <StockTable
              stocks={stocks}
              priceFlash={priceFlash}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
              isLoading={allStocks.length === 0}
              watchlist={watchlist}
              onToggleWatchlist={toggleWatchlist}
              onRowClick={setSelectedStock}
            />
          </div>
        )}

        {activeTab === 'watchlist' && (
          <div className="app-table">
            <StockTable
              stocks={watchlistStocks}
              priceFlash={priceFlash}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
              isLoading={allStocks.length === 0}
              watchlist={watchlist}
              onToggleWatchlist={toggleWatchlist}
              onRowClick={setSelectedStock}
            />
          </div>
        )}

        {activeTab === 'heatmap' && (
          <Heatmap stocks={allStocks} />
        )}

        {activeTab === 'sectors' && (
          <SectorBreakdown sectorData={sectorData} />
        )}

        {activeTab === 'news' && (
          <LiveNewsFeed />
        )}
      </main>

      <StatusBar stockCount={allStocks.length} />

      {/* Overlays */}
      <AlertToast toasts={toasts} onDismiss={dismissToast} />
      <AlertPanel alerts={alertHistory} onClearAll={clearAll} />
      <StockDetailModal stock={selectedStock} onClose={() => setSelectedStock(null)} />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isTrialExpired, loading } = useAuth();
  
  if (loading) return <div className="app" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-color)', color: 'white' }}>Verifying Account...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (isTrialExpired) return <Navigate to="/paywall" replace />;
  
  return <>{children}</>;
}

export default function App() {
  const [showLoading, setShowLoading] = useState(true);

  return (
    <SocketProvider>
      {showLoading && <LoadingScreen onComplete={() => setShowLoading(false)} />}
      {!showLoading && (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/paywall" element={<Paywall />} />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/*" element={
            <ProtectedRoute>
              <AppContent />
            </ProtectedRoute>
          } />
        </Routes>
      )}
      <UpdatePasswordModal />
    </SocketProvider>
  );
}
