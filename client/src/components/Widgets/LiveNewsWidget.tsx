import React from 'react';
import { useNews } from '../../hooks/useNews';
import { useDashboard } from '../../contexts/DashboardContext';
import { CometCard } from '../ui/comet-card';
import { audioAlerts } from '../../utils/audioAlerts';
import { CyberIcon } from '../common/CyberIcon';

export function LiveNewsWidget() {
  const { news } = useNews();
  const { setActiveTab } = useDashboard();
  
  const displayNews = news.slice(0, 4);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <CometCard>
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="card-head" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CyberIcon name="livenews" size={18} />
            <span className="card-title" style={{ letterSpacing: '-0.01em' }}>Market Wire Real-Time</span>
            <span className="telemetry-dot live" style={{ width: 6, height: 6 }} />
          </div>
          <a 
            className="card-link" 
            href="#" 
            onClick={(e) => { 
              e.preventDefault(); 
              audioAlerts.playClickHaptic();
              setActiveTab('LiveNews'); 
            }}
          >
            All news →
          </a>
        </div>
        <div style={{ flex: 1 }}>
          {displayNews.length > 0 ? displayNews.map((n) => (
            <div 
              className="news-row" 
              key={n.id}
              onClick={() => {
                audioAlerts.playClickHaptic();
                setActiveTab('LiveNews');
              }}
              style={{ cursor: 'pointer', padding: '10px 4px', transition: 'background 0.15s ease' }}
            >
              <span className="news-dot" style={{ background: 'var(--amber)', boxShadow: '0 0 8px var(--amber-glow)' }} />
              <span className="news-time num tabular-nums" style={{ color: 'var(--text-3)', fontWeight: 600 }}>{formatTime(n.pubDate)}</span>
              <span className="news-text">
                <b style={{ color: 'var(--amber-soft)', marginRight: '6px', fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                  @{n.source?.toUpperCase()}
                </b>
                {n.title}
              </span>
            </div>
          )) : (
            <div style={{ padding: '16px', color: 'var(--text-tertiary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="radar-ping" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)' }} />
              Scanning real-time financial wire feeds...
            </div>
          )}
        </div>
      </div>
    </CometCard>
  );
}
