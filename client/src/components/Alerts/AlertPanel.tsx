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
      <button className="premium-alert-toggle" onClick={() => setIsOpen(true)}>
        <span className="toggle-icon">🔔</span>
        <span className="toggle-text">ALERTS</span>
        {alerts.length > 0 && <span className="premium-alert-badge">{alerts.length}</span>}
      </button>

      {isOpen && (
        <>
          <div className="premium-alert-overlay" onClick={() => setIsOpen(false)} />
          <div className="premium-alert-sidebar">
            <div className="premium-alert-header">
              <div className="header-title">
                <span className="icon">🔔</span>
                LIVE ALERTS
              </div>
              <div className="header-actions">
                {alerts.length > 0 && (
                  <button className="clear-btn" onClick={onClearAll}>
                    CLEAR ALL
                  </button>
                )}
                <button className="close-btn" onClick={() => setIsOpen(false)}>
                  ✕
                </button>
              </div>
            </div>

            <div className="premium-alert-content">
              {alerts.length === 0 ? (
                <div className="premium-alert-empty">
                  <div className="empty-icon">🔕</div>
                  <div className="empty-text">No active alerts</div>
                  <div className="empty-subtext">Waiting for market signals...</div>
                </div>
              ) : (
                groupedAlerts.map(group => (
                  <div key={group.title} className="premium-alert-group">
                    <div className="group-divider">
                      <span>{group.title}</span>
                      <div className="line"></div>
                    </div>
                    
                    <div className="group-items">
                      {group.items.map(alert => {
                        const isHigh = alert.alertType === 'DAY_HIGH';
                        const isLow = alert.alertType === 'DAY_LOW';
                        const isNews = alert.alertType === 'NEWS';
                        
                        const typeClass = isHigh ? 'high' : isLow ? 'low' : isNews ? 'news' : 'spike';
                        const typeLabel = isHigh ? 'HIGH' : isLow ? 'LOW' : isNews ? 'NEWS' : 'SPIKE';

                        return (
                          <div key={alert.id} className={`premium-alert-card ${typeClass}`}>
                            <div className="card-indicator"></div>
                            <div className="card-body">
                              <div className="card-top">
                                <span className={`card-badge ${typeClass}`}>{typeLabel}</span>
                                <span className="card-time">{formatTime(alert.createdAt)}</span>
                              </div>
                              <div className="card-main">
                                <span className="card-symbol">{alert.symbol}</span>
                                {alert.alertType === 'NEWS' ? (
                                  <span className="card-news" title={alert.name}>{alert.name}</span>
                                ) : (
                                  <span className="card-price">{formatPrice(alert.price)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
