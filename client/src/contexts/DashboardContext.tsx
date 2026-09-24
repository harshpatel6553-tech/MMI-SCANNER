import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const PATH_TO_TAB: Record<string, string> = {
  '/': 'Overview',
  '/overview': 'Overview',
  '/table': 'Table',
  '/heatmap': 'Heatmap',
  '/sectors': 'Sectors',
  '/charts': 'Charts',
  '/technical': 'Technical',
  '/watchlist': 'Watchlist',
  '/news': 'LiveNews',
  '/results': 'Results',
  '/promoter': 'Promoter',
  '/papertrading': 'PaperTrading',
  '/admin': 'Admin',
};

export const TAB_TO_PATH: Record<string, string> = {
  'Overview': '/',
  'Table': '/table',
  'Heatmap': '/heatmap',
  'Sectors': '/sectors',
  'Charts': '/charts',
  'Technical': '/technical',
  'Watchlist': '/watchlist',
  'LiveNews': '/news',
  'Results': '/results',
  'Promoter': '/promoter',
  'PaperTrading': '/papertrading',
  'Admin': '/admin',
};

interface DashboardPreferences {
  showStats: boolean;
  showAdvanceDecline: boolean;
  showTopMovers: boolean;
  showSectorPulse: boolean;
  showLiveNews: boolean;
  showWatchlist: boolean;
  showMarketTable: boolean;
}

const DEFAULT_PREFERENCES: DashboardPreferences = {
  showStats: true,
  showAdvanceDecline: true,
  showTopMovers: true,
  showSectorPulse: true,
  showLiveNews: true,
  showWatchlist: true,
  showMarketTable: true,
};

interface DashboardContextType {
  preferences: DashboardPreferences;
  toggleWidget: (widget: keyof DashboardPreferences) => void;
  resetPreferences: () => void;
  isCustomizing: boolean;
  setIsCustomizing: (val: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedStock: string | null;
  setSelectedStock: (symbol: string | null) => void;
  chartSymbol: string;
  setChartSymbol: (symbol: string) => void;
  isAlertPanelOpen: boolean;
  setIsAlertPanelOpen: (open: boolean) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [preferences, setPreferences] = useState<DashboardPreferences>(() => {
    const saved = localStorage.getItem('mmi-dashboard-prefs');
    return saved ? JSON.parse(saved) : DEFAULT_PREFERENCES;
  });

  const [isCustomizing, setIsCustomizing] = useState(false);

  const getInitialTab = () => {
    const p = location.pathname.toLowerCase();
    return PATH_TO_TAB[p] || 'Overview';
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [chartSymbol, setChartSymbol] = useState<string>('RELIANCE');
  const [isAlertPanelOpen, setIsAlertPanelOpen] = useState(false);

  // Synchronize state when browser URL changes (back/forward or direct link)
  useEffect(() => {
    const p = location.pathname.toLowerCase();
    const tabFromUrl = PATH_TO_TAB[p];
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl);
    }
  }, [location.pathname, activeTab]);

  // When tab is changed, navigate to that tab's URL so the browser address bar updates
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    const targetPath = TAB_TO_PATH[tab] || '/';
    if (location.pathname.toLowerCase() !== targetPath.toLowerCase()) {
      navigate(targetPath);
    }
  };

  useEffect(() => {
    localStorage.setItem('mmi-dashboard-prefs', JSON.stringify(preferences));
  }, [preferences]);

  const toggleWidget = (widget: keyof DashboardPreferences) => {
    setPreferences((prev) => ({ ...prev, [widget]: !prev[widget] }));
  };

  const resetPreferences = () => setPreferences(DEFAULT_PREFERENCES);

  return (
    <DashboardContext.Provider value={{ preferences, toggleWidget, resetPreferences, isCustomizing, setIsCustomizing, activeTab, setActiveTab, searchQuery, setSearchQuery, selectedStock, setSelectedStock, chartSymbol, setChartSymbol, isAlertPanelOpen, setIsAlertPanelOpen }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used within DashboardProvider');
  return context;
}
