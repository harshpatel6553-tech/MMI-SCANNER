import React, { useState, useMemo } from 'react';
import type { StockAlert } from '../../types';
import { formatPrice, formatTime } from '../../utils/formatters';
import { useDashboard } from '../../contexts/DashboardContext';
import { audioAlerts } from '../../utils/audioAlerts';
import { Volume2, VolumeX, Copy, Check, ExternalLink, Zap, Trash2, X, Bell } from 'lucide-react';
import { CyberIcon, CyberIconName } from '../common/CyberIcon';
import { StockLogo } from '../common/StockLogo';
import './Alerts.css';

interface AlertPanelProps {
  alerts: StockAlert[];
  onClearAll: () => void;
}

function isIndexSymbol(symbol: string): boolean {
  const s = (symbol || '').toUpperCase();
  return s.includes('NIFTY') || s.includes('BANKNIFTY') || s.includes('SENSEX') || s.includes('INDIA VIX');
}

export function AlertPanel({ alerts, onClearAll }: AlertPanelProps) {
  const { isAlertPanelOpen, setIsAlertPanelOpen, setActiveTab, setChartSymbol, setSelectedStock } = useDashboard();
  const [filter, setFilter] = useState<'ALL' | 'INDICES' | 'HIGH' | 'LOW' | 'NEWS' | 'SPIKE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMuted, setIsMuted] = useState(audioAlerts.getIsMuted());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleSound = () => {
    const muted = audioAlerts.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      audioAlerts.playBreakoutChime();
    }
  };

  const handleCopy = (sym: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sym);
    setCopiedId(id);
    audioAlerts.playHapticClick();
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCardClick = (sym: string) => {
    audioAlerts.playHapticClick();
    setChartSymbol(sym);
    setSelectedStock(sym);
    setActiveTab('Charts');
    setIsAlertPanelOpen(false);
  };

  // Robust, unambiguous filtering
  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      const isIdx = isIndexSymbol(a.symbol) || a.alertType === 'INDEX_MILESTONE';

      if (filter === 'INDICES') {
        if (!isIdx) return false;
      } else if (filter === 'HIGH') {
        if (a.alertType !== 'DAY_HIGH') return false;
      } else if (filter === 'LOW') {
        if (a.alertType !== 'DAY_LOW') return false;
      } else if (filter === 'SPIKE') {
        if (a.alertType !== 'VOLUME_SPIKE') return false;
      } else if (filter === 'NEWS') {
        if (a.alertType !== 'NEWS') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const sym = (a.symbol || '').toLowerCase();
        const name = (a.name || '').toLowerCase();
        const details = (a.details || '').toLowerCase();
        if (!sym.includes(q) && !name.includes(q) && !details.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [alerts, filter, searchQuery]);

  // Precise category counts with zero fallthrough errors
  const counts = useMemo(() => {
    const c = { ALL: alerts.length, INDICES: 0, HIGH: 0, LOW: 0, NEWS: 0, SPIKE: 0 };
    alerts.forEach(a => {
      if (isIndexSymbol(a.symbol) || a.alertType === 'INDEX_MILESTONE') {
        c.INDICES++;
      }
      if (a.alertType === 'DAY_HIGH') c.HIGH++;
      else if (a.alertType === 'DAY_LOW') c.LOW++;
      else if (a.alertType === 'VOLUME_SPIKE') c.SPIKE++;
      else if (a.alertType === 'NEWS') c.NEWS++;
    });
    return c;
  }, [alerts]);

  return (
    <>
      {!isAlertPanelOpen && (
        <button 
          className="alert-panel-toggle" 
          onClick={() => {
            audioAlerts.playHapticClick();
            setIsAlertPanelOpen(true);
          }}
          title="Open Live Market Radar Alerts"
        >
          <span className="toggle-icon"><Bell size={14} /></span>
          <span className="toggle-text">RADAR ALERTS</span>
          {alerts.length > 0 && (
            <span className="alert-panel-badge">{alerts.length > 99 ? '99+' : alerts.length}</span>
          )}
        </button>
      )}

      {isAlertPanelOpen && (
        <>
          {/* Transparent, unblurred overlay for click-outside dismissal */}
          <div className="alert-panel-overlay" onClick={() => setIsAlertPanelOpen(false)} />
          
          {/* Crisp, solid-surface Alert Radar Drawer */}
          <div className="alert-panel">
            
            {/* Header */}
            <div className="drawer-header">
              <div className="drawer-title">
                <div className="radar-ping" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--up)' }} />
                <h1 className="display" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>
                  Live Market Radar
                </h1>
                <span className="badge-scanning">518 TICKERS</span>
              </div>

              <div className="drawer-actions">
                {/* Sound Chime Toggle */}
                <button 
                  className={`icon-action-btn ${!isMuted ? 'active-sound' : ''}`}
                  onClick={toggleSound}
                  title={isMuted ? "Enable Sound Alerts" : "Mute Sound Alerts"}
                >
                  {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>

                {alerts.length > 0 && (
                  <button 
                    className="clear-all" 
                    onClick={() => {
                      audioAlerts.playHapticClick();
                      onClearAll();
                    }}
                    title="Clear All Alerts"
                  >
                    <Trash2 size={13} />
                    <span>Clear</span>
                  </button>
                )}

                <button 
                  className="close-btn" 
                  onClick={() => setIsAlertPanelOpen(false)}
                  title="Close Alert Radar"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Radar Telemetry Sub-bar */}
            <div className="radar-telemetry-bar">
              <div className="telemetry-item">
                <span className="telemetry-dot live"></span>
                <span>FEED: <b>100MS REAL-TIME</b></span>
              </div>
              <div className="telemetry-item">
                <span>AUDIO: <b style={{ color: isMuted ? 'var(--text-3)' : 'var(--up)' }}>{isMuted ? 'MUTED' : 'CRYSTAL 880HZ'}</b></span>
              </div>
            </div>

            {/* Permanent, rock-solid Filter Pills */}
            <div className="filter-row">
              <button 
                className={`filter-chip ${filter === 'ALL' ? 'active' : ''}`} 
                onClick={() => { audioAlerts.playHapticClick(); setFilter('ALL'); }}
              >
                <CyberIcon name="overview" size={13} active={filter === 'ALL'} />
                <span>ALL</span>
                <span className="chip-cnt">{counts.ALL}</span>
              </button>
              
              <button 
                className={`filter-chip indices-chip ${filter === 'INDICES' ? 'active' : ''}`} 
                onClick={() => { audioAlerts.playHapticClick(); setFilter('INDICES'); }}
              >
                <CyberIcon name="sectors" size={13} active={filter === 'INDICES'} />
                <span>INDICES</span>
                <span className="chip-cnt">{counts.INDICES}</span>
              </button>
              
              <button 
                className={`filter-chip high-chip ${filter === 'HIGH' ? 'active' : ''}`} 
                onClick={() => { audioAlerts.playHapticClick(); setFilter('HIGH'); }}
              >
                <CyberIcon name="pulse_up" size={13} active={filter === 'HIGH'} />
                <span>HIGHS</span>
                <span className="chip-cnt">{counts.HIGH}</span>
              </button>
              
              <button 
                className={`filter-chip low-chip ${filter === 'LOW' ? 'active' : ''}`} 
                onClick={() => { audioAlerts.playHapticClick(); setFilter('LOW'); }}
              >
                <CyberIcon name="pulse_down" size={13} active={filter === 'LOW'} />
                <span>LOWS</span>
                <span className="chip-cnt">{counts.LOW}</span>
              </button>
              
              <button 
                className={`filter-chip spike-chip ${filter === 'SPIKE' ? 'active' : ''}`} 
                onClick={() => { audioAlerts.playHapticClick(); setFilter('SPIKE'); }}
              >
                <CyberIcon name="spike" size={13} active={filter === 'SPIKE'} />
                <span>SPIKES</span>
                <span className="chip-cnt">{counts.SPIKE}</span>
              </button>
              
              <button 
                className={`filter-chip news-chip ${filter === 'NEWS' ? 'active' : ''}`} 
                onClick={() => { audioAlerts.playHapticClick(); setFilter('NEWS'); }}
              >
                <CyberIcon name="livenews" size={13} active={filter === 'NEWS'} />
                <span>NEWS</span>
                <span className="chip-cnt">{counts.NEWS}</span>
              </button>
            </div>
            
            {/* Search Box with Clear Button */}
            <div className="alert-search-wrap">
              <CyberIcon name="overview" size={13} />
              <input 
                type="text" 
                placeholder="Filter by symbol, company or details..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="alert-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0 4px' }}
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Alert List */}
            <div className="alert-list">
              {filteredAlerts.length === 0 ? (
                <div className="empty-alerts-state">
                  <div className="empty-radar-disc">
                    <Zap size={28} className="empty-icon" />
                  </div>
                  <div className="empty-title">Radar Scanning Clean</div>
                  <div className="empty-sub">No alerts match the "{filter}" filter. Live tape is broadcasting actively.</div>
                </div>
              ) : (
                filteredAlerts.map(alert => {
                  const isHigh = alert.alertType === 'DAY_HIGH';
                  const isLow = alert.alertType === 'DAY_LOW';
                  const isNews = alert.alertType === 'NEWS';
                  const isMilestone = alert.alertType === 'INDEX_MILESTONE';
                  const isIdx = isIndexSymbol(alert.symbol) || isMilestone;
                  
                  const typeClass = isMilestone ? 'milestone' : isHigh ? 'high' : isLow ? 'low' : isNews ? 'news' : 'spike';
                  const typeIcon: CyberIconName = isMilestone ? 'overview' : isHigh ? 'pulse_up' : isLow ? 'pulse_down' : isNews ? 'livenews' : 'spike';
                  const typeText = isMilestone ? 'INDEX PEAK' : isHigh ? 'DAY HIGH' : isLow ? 'DAY LOW' : isNews ? 'NEWS ALPHA' : 'VOL SPIKE';

                  return (
                    <div 
                      key={alert.id} 
                      className={`alert-card ${typeClass}`}
                      onClick={() => handleCardClick(alert.symbol)}
                      title="Click to open interactive chart"
                    >
                      <div className="alert-top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <StockLogo symbol={alert.symbol} name={alert.name} size={20} />
                          <span className={`alert-badge ${typeClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <CyberIcon name={typeIcon} size={12} active={true} />
                            <span>{typeText}</span>
                          </span>
                          {isIdx && (
                            <span className="index-pill">NSE INDEX</span>
                          )}
                        </div>

                        <div className="alert-card-meta">
                          <span className="alert-time tabular-nums">{formatTime(alert.createdAt)}</span>
                          
                          {/* Quick Copy Ticker Button */}
                          <button 
                            className="btn-quick-copy"
                            onClick={(e) => handleCopy(alert.symbol, alert.id, e)}
                            title="Copy symbol to clipboard"
                          >
                            {copiedId === alert.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </div>

                      <div className="alert-bottom">
                        <div className="alert-ticker-block">
                          <div className="alert-sym-row">
                            <span className="alert-sym">{alert.symbol}</span>
                            <span className="alert-co-name">{alert.name}</span>
                          </div>

                          {alert.details && (
                            <span className="alert-details-sub">
                              {alert.details}
                            </span>
                          )}
                        </div>

                        {isNews ? (
                          <span className="alert-news" title={alert.name}>{alert.name}</span>
                        ) : (
                          <div className="alert-numbers-block">
                            <span className={`alert-price tabular-nums ${typeClass}`}>
                              {formatPrice(alert.price)}
                            </span>
                            
                            {alert.change !== undefined && alert.changePercent !== undefined && (
                              <span className={`chg-badge tabular-nums ${alert.changePercent >= 0 ? 'up' : 'down'}`}>
                                {alert.change >= 0 ? '+' : '−'}{Math.abs(alert.change).toFixed(1)} ({alert.changePercent >= 0 ? '+' : '−'}{Math.abs(alert.changePercent).toFixed(2)}%)
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="card-hover-action">
                        <span>OPEN CHART <ExternalLink size={11} /></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="drawer-footer">
              <div className="footer-status-pill">
                <span className="telemetry-dot live"></span>
                <span>SYNCHRONIZED WITH NSE TAPE</span>
              </div>
            </div>

          </div>
        </>
      )}
    </>
  );
}
