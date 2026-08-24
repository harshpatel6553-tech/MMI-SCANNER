import { useState, useEffect } from 'react';
import { useNews } from '../../hooks/useNews';
import { Calendar, Activity, Zap, Inbox, Search, TrendingUp, BarChart3 } from 'lucide-react';
import './EarningsResults.css';

interface CalendarEvent {
  symbol: string;
  name: string;
  date: string;
}

const API_URL = (import.meta.env.VITE_SOCKET_URL || window.location.origin) + '/api';

export function EarningsResults() {
  const { news, loading } = useNews();
  const [calendar, setCalendar] = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  
  // Filter for earnings reports
  const earningsNews = news.filter(n => n.isEarningsResult);

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const response = await fetch(`${API_URL}/calendar/today`);
        const data = await response.json();
        if (data.success) {
          setCalendar(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch earnings calendar:", err);
      } finally {
        setCalendarLoading(false);
      }
    };
    fetchCalendar();
  }, []);

  const getSentimentBadge = (sentiment?: string) => {
    if (!sentiment || sentiment === 'Neutral') return null;
    const isBullish = sentiment === 'Bullish';
    return (
      <span className={`news-sentiment-badge ${isBullish ? 'bullish' : 'bearish'}`}>
        {isBullish ? (
          <><TrendingUp size={12} /> BULLISH</>
        ) : (
          <><TrendingUp size={12} style={{ transform: 'scaleY(-1)' }} /> BEARISH</>
        )}
      </span>
    );
  };

  return (
    <div className="earnings-results-container">
      <div className="earnings-live-feed">
        <h2 className="section-title">
          <Activity className="icon-glow" size={20} />
          Live Earnings Feed
        </h2>
        <div className="news-list">
          {loading && earningsNews.length === 0 ? (
            <div className="news-empty">
              <Zap className="spin-pulse" size={32} />
              <p>Scanning for breaking results...</p>
            </div>
          ) : earningsNews.length === 0 ? (
            <div className="news-empty">
              <Inbox size={32} />
              <p>No earnings results announced yet today.</p>
              <span className="empty-subtext">Waiting for companies to report...</span>
            </div>
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
        <div className="calendar-header-glass">
          <h2 className="section-title">
            <Calendar size={20} className="icon-accent" />
            Expected Today
          </h2>
          <p className="calendar-subtext">Companies scheduled to announce quarterly results today.</p>
        </div>
        <div className="calendar-list">
          {calendarLoading ? (
            <div className="news-empty">
              <Search className="spin-pulse" size={32} />
              <p>Fetching calendar...</p>
            </div>
          ) : calendar.length === 0 ? (
            <div className="news-empty">
              <BarChart3 size={32} />
              <p>No major Indian companies are scheduled to report earnings today.</p>
            </div>
          ) : (
            calendar.map(co => (
              <div key={co.symbol} className="calendar-item">
                <div className="calendar-symbol">${co.symbol}</div>
                <div className="calendar-name">{co.name}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

