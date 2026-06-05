import { useRef, useEffect, useState } from 'react';
import './ViewTabs.css';

interface ViewTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { key: 'table', label: '📋 Table' },
  { key: 'heatmap', label: '🟩 Heatmap' },
  { key: 'sectors', label: '📊 Sectors' },
];

export function ViewTabs({ activeTab, onTabChange }: ViewTabsProps) {
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
