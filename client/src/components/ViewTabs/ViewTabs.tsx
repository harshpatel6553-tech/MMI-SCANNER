import { useRef, useEffect, useState } from 'react';
import './ViewTabs.css';

interface ViewTabsProps {
  activeTab: 'table' | 'heatmap' | 'sectors' | 'watchlist' | 'news' | 'technical';
  onTabChange: (tab: 'table' | 'heatmap' | 'sectors' | 'watchlist' | 'news' | 'technical') => void;
  watchlistCount?: number;
}

const tabs = [
  { key: 'table', label: '📋 Table' },
  { key: 'heatmap', label: '🟩 Heatmap' },
  { key: 'sectors', label: '📊 Sectors' },
  { key: 'technical', label: '📈 Technical' },
  { key: 'watchlist', label: '⭐ Watchlist' },
  { key: 'news', label: '📰 Live News' }
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
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
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

