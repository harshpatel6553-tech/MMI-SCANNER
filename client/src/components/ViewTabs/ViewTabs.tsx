import { useRef, useEffect, useState } from 'react';
import './ViewTabs.css';

import { 
  Table2, 
  LayoutGrid, 
  PieChart, 
  TrendingUp, 
  Star, 
  Newspaper, 
  LineChart, 
  Gamepad2,
  Eye
} from 'lucide-react';

interface ViewTabsProps {
  activeTab: 'table' | 'heatmap' | 'sectors' | 'watchlist' | 'news' | 'technical' | 'results' | 'paper' | 'promoter';
  onTabChange: (tab: 'table' | 'heatmap' | 'sectors' | 'watchlist' | 'news' | 'technical' | 'results' | 'paper' | 'promoter') => void;
  watchlistCount?: number;
}

const tabs = [
  { key: 'table', label: 'Table', Icon: Table2 },
  { key: 'heatmap', label: 'Heatmap', Icon: LayoutGrid },
  { key: 'sectors', label: 'Sectors', Icon: PieChart },
  { key: 'technical', label: 'Technical', Icon: TrendingUp },
  { key: 'watchlist', label: 'Watchlist', Icon: Star },
  { key: 'news', label: 'Live News', Icon: Newspaper },
  { key: 'results', label: 'Results', Icon: LineChart },
  { key: 'paper', label: 'Paper Trading', Icon: Gamepad2 },
  { key: 'promoter', label: 'Promoter Watch', Icon: Eye }
] as const;

export function ViewTabs({ activeTab, onTabChange, watchlistCount = 0 }: ViewTabsProps) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    const container = tabsRef.current;
    if (!container) return;
    const activeEl = container.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
      });
    }
  }, [activeTab]);

  return (
    <div className="view-tabs-wrapper">
      <div className="view-tabs" ref={tabsRef}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            data-tab={tab.key}
            className={`view-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => onTabChange(tab.key as any)}
          >
            <tab.Icon size={16} strokeWidth={2.5} />
            <span>{tab.label}</span>
            {tab.key === 'watchlist' && watchlistCount > 0 && (
              <span className="watchlist-count-badge">{watchlistCount}</span>
            )}
          </button>
        ))}
        <div
          className="view-tab-indicator"
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
          }}
        />
      </div>
    </div>
  );
}
