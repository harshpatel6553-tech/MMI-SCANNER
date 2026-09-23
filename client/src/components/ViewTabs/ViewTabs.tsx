import { useRef, useEffect, useState } from 'react';
import { CyberIcon, CyberIconName } from '../common/CyberIcon';
import './ViewTabs.css';

interface ViewTabsProps {
  activeTab: 'table' | 'heatmap' | 'sectors' | 'watchlist' | 'news' | 'technical' | 'results' | 'paper' | 'promoter';
  onTabChange: (tab: 'table' | 'heatmap' | 'sectors' | 'watchlist' | 'news' | 'technical' | 'results' | 'paper' | 'promoter') => void;
  watchlistCount?: number;
}

const tabs: { key: ViewTabsProps['activeTab']; label: string; icon: CyberIconName }[] = [
  { key: 'table', label: 'Table', icon: 'table' },
  { key: 'heatmap', label: 'Heatmap', icon: 'heatmap' },
  { key: 'sectors', label: 'Sectors', icon: 'sectors' },
  { key: 'technical', label: 'Technical', icon: 'technical' },
  { key: 'watchlist', label: 'Watchlist', icon: 'watchlist' },
  { key: 'news', label: 'Live News', icon: 'livenews' },
  { key: 'results', label: 'Results', icon: 'results' },
  { key: 'paper', label: 'Paper Trading', icon: 'papertrading' },
  { key: 'promoter', label: 'Promoter Watch', icon: 'promoter' }
];

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
            <CyberIcon name={tab.icon} size={16} active={activeTab === tab.key} />
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
