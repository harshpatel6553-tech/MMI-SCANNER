import { useNews } from '../../hooks/useNews';
import './LiveNewsFeed.css';

export function LiveNewsFeed() {
  const { news, loading, error } = useNews();

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="live-news-container glass-card">
      <div className="live-news-header">
        <div className="live-news-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <h3>Breaking Market News</h3>
        </div>
        <div className="live-news-source">Source: Moneycontrol</div>
      </div>
      
      <div className="live-news-content">
        {loading && <div className="news-status">Fetching latest headlines...</div>}
        {error && <div className="news-status error">{error}</div>}
        
        {!loading && !error && news.length === 0 && (
          <div className="news-status">No recent news found.</div>
        )}

        {!loading && !error && news.length > 0 && (
          <div className="news-list">
            {news.map((item) => (
              <a 
                key={item.id} 
                href={item.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="news-item"
              >
                <div className="news-item-time">{formatTime(item.pubDate)}</div>
                <div className="news-item-title">{item.title}</div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
