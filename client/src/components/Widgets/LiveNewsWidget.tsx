import React from 'react';
import { useNews } from '../../hooks/useNews';
import { useDashboard } from '../../contexts/DashboardContext';
import { audioAlerts } from '../../utils/audioAlerts';
import { Zap, ArrowRight, Clock } from 'lucide-react';

export function LiveNewsWidget() {
  const { news } = useNews();
  const { setActiveTab } = useDashboard();
  
  const displayNews = news.slice(0, 4);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatRelativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return '';
  };

  return (
    <div className="bento-widget-shell">
      <div className="bento-widget-core">
        <div className="bento-card-header">
          <div className="bento-title-left">
            <div className="bento-icon-box">
              <Zap size={17} strokeWidth={1.5} className="text-cyan-400" />
            </div>
            <div>
              <div className="bento-title-row">
                <span className="bento-card-title">Market Wire Alpha</span>
                <span className="telemetry-beacon live" />
              </div>
              <div className="bento-card-subtitle">Real-time regulatory disclosures and corporate filings</div>
            </div>
          </div>

          <button
            type="button"
            className="bento-link-btn"
            onClick={() => {
              audioAlerts.playClickHaptic();
              setActiveTab('LiveNews');
            }}
          >
            <span>All Wire</span>
            <ArrowRight size={13} strokeWidth={1.5} />
          </button>
        </div>

        <div className="bento-list-body">
          {displayNews.length > 0 ? (
            displayNews.map((n) => {
              const relTime = formatRelativeTime(n.pubDate);
              const isFresh = relTime === 'Just now' || (relTime.endsWith('m ago') && parseInt(relTime, 10) <= 3);
              return (
                <div 
                  className="news-item-row" 
                  key={n.id}
                  onClick={() => {
                    audioAlerts.playClickHaptic();
                    setActiveTab('LiveNews');
                  }}
                >
                  <div className="news-time-col">
                    <span className="news-clock-text num tabular-nums">{formatTime(n.pubDate)}</span>
                    {relTime && (
                      <span className={`news-rel-badge ${isFresh ? 'fresh' : ''}`}>
                        {relTime}
                      </span>
                    )}
                  </div>

                  <div className="news-content-col">
                    <div className="news-headline-text">
                      {n.title}
                    </div>
                    {n.source && (
                      <div className="news-source-tag">
                        {n.source}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bento-empty-state">
              <Clock size={20} strokeWidth={1.5} className="text-slate-500" />
              <span>Monitoring live exchange regulatory wires...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
