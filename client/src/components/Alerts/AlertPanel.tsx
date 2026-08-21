import { useState, useMemo } from 'react';
import type { StockAlert } from '../../types';
import { formatPrice, formatTime } from '../../utils/formatters';
import './Alerts.css';

interface AlertPanelProps {
  alerts: StockAlert[];
  onClearAll: () => void;
}

export function AlertPanel({ alerts, onClearAll }: AlertPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const groupedAlerts = useMemo(() => {
    const now = Date.now();
    const groups: { title: string; items: StockAlert[] }[] = [
      { title: 'Last 5 minutes', items: [] },
      { title: 'Last 30 minutes', items: [] },
      { title: 'Older', items: [] },
    ];

    alerts.forEach(alert => {
      const age = now - new Date(alert.createdAt).getTime();
      if (age < 5 * 60 * 1000) groups[0].items.push(alert);
      else if (age < 30 * 60 * 1000) groups[1].items.push(alert);
      else groups[2].items.push(alert);
    });

    return groups.filter(g => g.items.length > 0);
  }, [alerts]);

  return (
    <>
      {/* Toggle button */}
      <button className="alert-panel-toggle" onClick={() => setIsOpen(true)}>
        🔔 Alerts
        {alerts.length > 0 && <span className="alert-count">{alerts.length}</span>}
      </button>

      {/* Panel overlay + sidebar */}
      {isOpen && (
        <>
          <div className="alert-panel-overlay" onClick={() => setIsOpen(false)} />
          <div className="alert-panel">
            <div className="alert-panel-header">
              <div className="alert-panel-title">
                🔔 Alert History
              </div>
              <div className="alert-panel-actions">
                {alerts.length > 0 && (
                  <button className="btn" onClick={onClearAll}>
                    Clear All
                  </button>
                )}
                <button className="btn" onClick={() => setIsOpen(false)}>
                  ✕
                </button>
              </div>
            </div>
            <div className="alert-panel-body">
              {alerts.length === 0 ? (
                <div className="alert-empty">
                  <div className="alert-empty-icon">🔕</div>
                  <div>No alerts yet</div>
                </div>
              ) : (
                groupedAlerts.map(group => (
                  <div key={group.title}>
                    <div className="alert-group-title">{group.title}</div>
                    {group.items.map(alert => {
                      const typeClass = alert.alertType === 'DAY_HIGH' ? 'high' : alert.alertType === 'DAY_LOW' ? 'low' : alert.alertType === 'NEWS' ? 'news' : 'spike';
                      const typeLabel = alert.alertType === 'DAY_HIGH' ? 'HIGH' : alert.alertType === 'DAY_LOW' ? 'LOW' : alert.alertType === 'NEWS' ? '📰 NEWS' : '⚡ SPIKE';

                      const isHigh = alert.alertType === 'DAY_HIGH';
                      const isLow = alert.alertType === 'DAY_LOW';
                      const isNews = alert.alertType === 'NEWS';
                      
                      let rowStyle = '';
                      let badgeStyle = '';
                      
                      if (isHigh) {
                        rowStyle = 'rounded-md border-l-[8px] border-green-600 bg-green-600/10 text-green-600 dark:border-green-400 dark:bg-green-400/10 dark:text-green-400';
                        badgeStyle = 'bg-green-500/20 text-green-500 border border-green-500/30';
                      } else if (isLow) {
                        rowStyle = 'rounded-none border-0 border-l-[8px] border-red-600 bg-red-600/10 text-red-600 dark:border-red-500 dark:bg-red-500/10 dark:text-red-500';
                        badgeStyle = 'bg-red-500/20 text-red-500 border border-red-500/30';
                      } else if (isNews) {
                        rowStyle = 'rounded-md border-l-[8px] border-blue-600 bg-blue-600/10 text-blue-600 dark:border-blue-400 dark:bg-blue-400/10 dark:text-blue-400';
                        badgeStyle = 'bg-blue-500/20 text-blue-500 border border-blue-500/30';
                      } else {
                        rowStyle = 'rounded-md border-l-[8px] border-purple-600 bg-purple-600/10 text-purple-600 dark:border-purple-400 dark:bg-purple-400/10 dark:text-purple-400';
                        badgeStyle = 'bg-purple-500/20 text-purple-500 border border-purple-500/30';
                      }

                      return (
                        <div key={alert.id} className={`flex items-center gap-3 py-2.5 px-3 mb-2 shadow-sm backdrop-blur-sm transition-all hover:brightness-110 ${rowStyle}`}>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded leading-none ${badgeStyle}`}>
                            {typeLabel}
                          </span>
                          <span className="font-bold text-sm tracking-wide text-white flex-shrink-0">{alert.symbol}</span>
                          {alert.alertType === 'NEWS' ? (
                            <span className="flex-1 text-xs opacity-90 truncate" title={alert.name}>
                              {alert.name}
                            </span>
                          ) : (
                            <span className="flex-1 text-sm font-semibold tabular-nums text-right">{formatPrice(alert.price)}</span>
                          )}
                          <span className="text-[10px] font-medium opacity-60 flex-shrink-0">{formatTime(alert.createdAt)}</span>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
