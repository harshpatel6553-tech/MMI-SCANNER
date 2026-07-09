import { useNews } from '../../hooks/useNews';
import './EarningsResults.css';

// Mock list of today's expected earnings (since no free API exists)
const EXPECTED_TODAY = [
  { symbol: 'TCS', name: 'Tata Consultancy Services' },
  { symbol: 'INFY', name: 'Infosys Limited' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd' },
  { symbol: 'RELIANCE', name: 'Reliance Industries' },
  { symbol: 'WIPRO', name: 'Wipro Limited' }
];

export function EarningsResults() {
  const { news, loading } = useNews();
  
  // Filter for earnings reports
  const earningsNews = news.filter(n => n.isEarningsResult);

  const getSentimentBadge = (sentiment?: string) => {
    if (!sentiment || sentiment === 'Neutral') return null;
    const isBullish = sentiment === 'Bullish';
    return (
      <span className={`news-sentiment-badge ${isBullish ? 'bullish' : 'bearish'}`}>
        {isBullish ? 'BULLISH' : 'BEARISH'}
      </span>
    );
  };

  return (
    <div className="earnings-results-container">
      <div className="earnings-live-feed">
        <h2 className="section-title">📊 Live Earnings Feed</h2>
        <div className="news-list">
          {loading && earningsNews.length === 0 ? (
            <div className="news-loading">Scanning for breaking results...</div>
          ) : earningsNews.length === 0 ? (
            <div className="news-empty">No earnings results announced yet today.</div>
          ) : (
            earningsNews.map((item) => (
              <a 
                key={item.id}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="news-card"
              >
                <div className="news-card-header">
                  <span className="news-time">
                    {new Date(item.pubDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                  {getSentimentBadge(item.sentiment)}
                </div>
                <div className="news-title">{item.title}</div>
                {item.affectedStocks && item.affectedStocks.length > 0 && (
                  <div className="news-stocks">
                    {item.affectedStocks.map(stock => (
                      <span key={stock} className="news-stock-tag">${stock}</span>
                    ))}
                  </div>
                )}
              </a>
            ))
          )}
        </div>
      </div>
      
      <div className="earnings-calendar">
        <h2 className="section-title">📅 Expected Today</h2>
        <div className="calendar-list">
          <p className="calendar-subtext">Companies scheduled to announce quarterly results today.</p>
          {EXPECTED_TODAY.map(co => (
            <div key={co.symbol} className="calendar-item">
              <div className="calendar-symbol">${co.symbol}</div>
              <div className="calendar-name">{co.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
