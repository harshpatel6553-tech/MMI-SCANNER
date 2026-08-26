import { useNews } from '../../hooks/useNews';
import './NewsTicker.css';

export function NewsTicker() {
  const { news, loading, error } = useNews();

  if (loading || error || news.length === 0) {
    return null; // Don't show the ticker if there's no data
  }

  // Get top 5 breaking news items
  const breakingNews = news.slice(0, 5);

  return (
    <div className="news-ticker-container">
      <div className="news-ticker-label">
        <span className="live-dot"></span>
        BREAKING
      </div>
      <div className="news-ticker-scroller">
        <div className="news-ticker-track">
          {/* Double the list to create an infinite seamless scroll */}
          {[...breakingNews, ...breakingNews].map((item, index) => (
            <a 
              key={`${item.id}-${index}`} 
              href={item.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="news-ticker-item"
            >
              <span className="news-ticker-bullet">â€¢</span>
              {item.title}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
