import { useNews } from '../../hooks/useNews';
import './LiveNewsFeed.css';

export interface LiveNewsFeedProps {
  onStockClick?: (symbol: string) => void;
}

export function LiveNewsFeed({ onStockClick }: LiveNewsFeedProps) {
  const { news, loading, error } = useNews();

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSentimentClass = (sentiment?: string) => {
    if (sentiment === 'Bullish') return 'sentiment-bullish';
    if (sentiment === 'Bearish') return 'sentiment-bearish';
    return 'sentiment-neutral';
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
              <div key={item.id} className="news-item-wrapper">
                <a 
                  href={item.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="news-item"
                >
                  <div className="news-item-header">
                    <span className="news-item-time">{formatTime(item.pubDate)}</span>
                    <span className="news-item-source" style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>
                      @{item.source || 'REDBOXINDIA'}
                    </span>
                    {item.sentiment && item.sentiment !== 'Neutral' && (
                      <span className={`news-sentiment-badge ${getSentimentClass(item.sentiment)}`} style={{ marginLeft: 'auto' }}>
                        {item.sentiment}
                      </span>
                    )}
                  </div>
                  <div className="news-item-title">{item.title}</div>
                </a>
                
                {item.affectedStocks && item.affectedStocks.length > 0 && (
                  <div className="news-affected-stocks">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>
                    {item.affectedStocks.map((sym) => (
                      <button 
                        key={sym} 
                        className="stock-tag"
                        onClick={(e) => {
                          e.preventDefault();
                          if (onStockClick) onStockClick(sym);
                        }}
                      >
                        ${sym}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
