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
                      const typeClass = alert.alertType === 'DAY_HIGH' ? 'high' : 
                                        alert.alertType === 'DAY_LOW' ? 'low' : 
                                        alert.alertType === 'NEWS' ? 'news' : 
                                        alert.alertType === 'OPTIONS_CALL_SPIKE' ? 'low' : // Bearish
                                        alert.alertType === 'OPTIONS_PUT_SPIKE' ? 'high' : // Bullish
                                        'spike';
                      const typeLabel = alert.alertType === 'DAY_HIGH' ? 'HIGH' : 
                                        alert.alertType === 'DAY_LOW' ? 'LOW' : 
                                        alert.alertType === 'NEWS' ? '📰 NEWS' : 
                                        alert.alertType === 'OPTIONS_CALL_SPIKE' ? '🔴 CALL SPIKE' : 
                                        alert.alertType === 'OPTIONS_PUT_SPIKE' ? '🟢 PUT SPIKE' : 
                                        '⚡ SPIKE';

                      return (
                        <div key={alert.id} className="alert-item">
                          <span className={`alert-item-type ${typeClass}`}>
                            {typeLabel}
                          </span>
                          <span className="alert-item-symbol">
                            {alert.alertType.startsWith('OPTIONS') ? alert.name : alert.symbol}
                          </span>
                          {alert.alertType === 'NEWS' ? (
                            <span className="alert-item-price" style={{flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px'}} title={alert.name}>
                              {alert.name}
                            </span>
                          ) : (
                            <span className="alert-item-price">{formatPrice(alert.price)}</span>
                          )}
                          <span className="alert-item-time">{formatTime(alert.createdAt)}</span>
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
