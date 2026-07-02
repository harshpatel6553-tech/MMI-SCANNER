import { useState, useEffect } from 'react';

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sentiment?: 'Bullish' | 'Bearish' | 'Neutral';
  affectedStocks?: string[];
}

const API_URL = (import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000') + '/api';

export function useNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchNews = async () => {
      try {
        const response = await fetch(`${API_URL}/news`);
        const data = await response.json();
        if (data.success && isMounted) {
          setNews(data.data);
          setError(null);
        } else if (!data.success && isMounted) {
          setError(data.error);
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to fetch news');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchNews();

    // Poll for new news every 10 seconds for ultra-fast updates
    const interval = setInterval(fetchNews, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { news, loading, error };
}
