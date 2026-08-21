import React from 'react';
import { useNews } from '../../hooks/useNews';
import { useDashboard } from '../../contexts/DashboardContext';

export function LiveNewsWidget() {
  const { news } = useNews();
  const { setActiveTab } = useDashboard();
  
  const displayNews = news.slice(0, 4);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Live News</span>
        <a className="card-link" href="#" onClick={(e) => { e.preventDefault(); setActiveTab('LiveNews'); }}>All news →</a>
      </div>
      <div>
        {displayNews.length > 0 ? displayNews.map((n) => (
          <div className="news-row" key={n.id}>
            <span className="news-dot"></span>
            <span className="news-time num">{formatTime(n.pubDate)}</span>
            <span className="news-text"><b style={{color: 'var(--text-tertiary)', marginRight: '6px', fontSize: '0.7rem'}}>@{n.source?.toUpperCase()}</b> {n.title}</span>
          </div>
        )) : <div style={{padding: '12px', color: 'var(--text-tertiary)', fontSize: '13px'}}>Waiting for real-time news feed...</div>}
      </div>
    </div>
  );
}
