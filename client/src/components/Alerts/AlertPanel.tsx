import { useState, useMemo, useEffect } from 'react';
import type { StockAlert } from '../../types';
import { formatPrice, formatTime } from '../../utils/formatters';
import './Alerts.css';

interface AlertPanelProps {
  alerts: StockAlert[];
  onClearAll: () => void;
}

export function AlertPanel({ alerts, onClearAll }: AlertPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'LOW' | 'NEWS' | 'SPIKE'>('ALL');

  const [searchQuery, setSearchQuery] = useState('');

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (filter !== 'ALL') {
        const typeLabel = a.alertType === 'DAY_HIGH' ? 'HIGH' : a.alertType === 'DAY_LOW' ? 'LOW' : a.alertType === 'NEWS' ? 'NEWS' : 'SPIKE';
        if (typeLabel !== filter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!a.symbol.toLowerCase().includes(q) && !a.name.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [alerts, filter, searchQuery]);

  const counts = useMemo(() => {
    const c = { ALL: alerts.length, HIGH: 0, LOW: 0, NEWS: 0, SPIKE: 0 };
    alerts.forEach(a => {
      if (a.alertType === 'DAY_HIGH') c.HIGH++;
      else if (a.alertType === 'DAY_LOW') c.LOW++;
      else if (a.alertType === 'NEWS') c.NEWS++;
      else c.SPIKE++;
    });
    return c;
  }, [alerts]);

  return (
    <>
      <button className="alert-panel-toggle" onClick={() => setIsOpen(true)}>
        <span className="toggle-icon">🔔</span>
        <span className="toggle-text">ALERTS</span>
        {alerts.length > 0 && <span className="alert-panel-badge">{alerts.length}</span>}
      </button>

      {isOpen && (
        <>
          <div className="alert-panel-overlay" onClick={() => setIsOpen(false)} />
          <div className="alert-panel">
            
            <div className="drawer-header">
              <div className="drawer-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                <h1 className="display">Live Alerts</h1>
              </div>
              <div className="drawer-actions">
                {alerts.length > 0 && (
                  <button className="clear-all" onClick={onClearAll}>Clear All</button>
                )}
                <button className="close-btn" onClick={() => setIsOpen(false)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <div className="sub-row">
              <div className="section-lbl"><span className="live-dot"></span>Today's Alerts</div>
            </div>

            <div className="filter-row">
              <button className={`filter-chip ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>
                ALL {counts.ALL}
              </button>
              {counts.HIGH > 0 && (
                <button className={`filter-chip ${filter === 'HIGH' ? 'active' : ''}`} onClick={() => setFilter('HIGH')}>
                  HIGH {counts.HIGH}
                </button>
              )}
              {counts.LOW > 0 && (
                <button className={`filter-chip ${filter === 'LOW' ? 'active' : ''}`} onClick={() => setFilter('LOW')}>
                  LOW {counts.LOW}
                </button>
              )}
              {counts.SPIKE > 0 && (
                <button className={`filter-chip ${filter === 'SPIKE' ? 'active' : ''}`} onClick={() => setFilter('SPIKE')}>
                  SPIKES {counts.SPIKE}
                </button>
              )}
              {counts.NEWS > 0 && (
                <button className={`filter-chip ${filter === 'NEWS' ? 'active' : ''}`} onClick={() => setFilter('NEWS')}>
                  NEWS {counts.NEWS}
                </button>
              )}
            </div>
            
            <div style={{ padding: '0 20px 12px 20px' }}>
              <div style={{ position: 'relative' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input 
                  type="text" 
                  placeholder="Search stocks..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '8px 12px 8px 32px',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                  }}
                />
              </div>
            </div>

            <div className="alert-list">
              {filteredAlerts.length === 0 ? (
                <div style={{margin: 'auto', textAlign: 'center', color: 'var(--ink-muted)'}}>
                  <div style={{fontSize: 24, marginBottom: 8, opacity: 0.5}}>🔕</div>
                  <div style={{fontSize: 13, fontWeight: 600}}>No active alerts</div>
                </div>
              ) : (
                filteredAlerts.map(alert => {
                  const isHigh = alert.alertType === 'DAY_HIGH';
                  const isLow = alert.alertType === 'DAY_LOW';
                  const isNews = alert.alertType === 'NEWS';
                  const typeClass = isHigh ? 'high' : isLow ? 'low' : isNews ? 'news' : 'spike';
                  const typeLabel = isHigh ? 'HIGH' : isLow ? 'LOW' : isNews ? 'NEWS' : 'SPIKE';

                  return (
                    <div key={alert.id} className={`alert-card ${typeClass}`}>
                      <div className="alert-top">
                        <span className={`alert-badge ${typeClass}`}>{typeLabel}</span>
                        <span className="alert-time">{formatTime(alert.createdAt)}</span>
                      </div>
                      <div className="alert-bottom">
                        <span className="alert-sym">{alert.symbol}</span>
                        {isNews ? (
                          <span className="alert-news" title={alert.name}>{alert.name}</span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`alert-price ${typeClass}`}>{formatPrice(alert.price)}</span>
                            {alert.change !== undefined && alert.changePercent !== undefined && (
                              <span className={`text-[13px] font-medium tracking-tight ${alert.changePercent >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                                {alert.change >= 0 ? '+' : '−'}{Math.abs(alert.change).toFixed(1)} {alert.changePercent >= 0 ? '+' : '−'}{Math.abs(alert.changePercent).toFixed(2)}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="drawer-footer">
              <button className="footer-link">
                View Full Alert History
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </button>
            </div>

          </div>
        </>
      )}
    </>
  );
}
