import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [preferences, setPreferences] = useState<DashboardPreferences>(() => {
    const saved = localStorage.getItem('mmi-dashboard-prefs');
    return saved ? JSON.parse(saved) : DEFAULT_PREFERENCES;
  });
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    localStorage.setItem('mmi-dashboard-prefs', JSON.stringify(preferences));
  }, [preferences]);

  const toggleWidget = (widget: keyof DashboardPreferences) => {
    setPreferences((prev) => ({ ...prev, [widget]: !prev[widget] }));
  };

  const resetPreferences = () => setPreferences(DEFAULT_PREFERENCES);

  return (
    <DashboardContext.Provider value={{ preferences, toggleWidget, resetPreferences, isCustomizing, setIsCustomizing, activeTab, setActiveTab, searchQuery, setSearchQuery }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used within DashboardProvider');
  return context;
}
