import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocketContext } from '../context/SocketContext';

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sentiment?: 'Bullish' | 'Bearish' | 'Neutral';
  affectedStocks?: string[];
  isEarningsResult?: boolean;
  isPromoterAction?: boolean;
}

const API_URL = (import.meta.env.VITE_SOCKET_URL || window.location.origin) + '/api';

export function useNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { socket } = useSocketContext();
  const isWarmingUp = useRef(false);

  const fetchNews = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/news`);
      const data = await response.json();
      if (data.success) {
        setNews(data.data);
        setError(null);
        if (data.data.length > 0) {
          isWarmingUp.current = false;
        } else {
          isWarmingUp.current = true;
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch news');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchNews();

    let ticks = 0;
    const tickInterval = setInterval(() => {
      if (!isMounted) return;
      ticks++;
      if (isWarmingUp.current) {
        fetchNews();
      } else if (ticks >= 20) { 
        fetchNews();
        ticks = 0;
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(tickInterval);
    };
  }, [fetchNews]);

  useEffect(() => {
    if (!socket) return;

    const handleAlert = (alert: any) => {
      if (alert.alertType === 'NEWS') {
        fetchNews();
      }
    };

    const handleSnapshot = (fullNews: NewsItem[]) => {
      setNews(fullNews);
      setLoading(false);
      isWarmingUp.current = fullNews.length === 0;
    };

    socket.on('alert:new', handleAlert);
    socket.on('news:snapshot', handleSnapshot);

    // Initial snapshot request just in case
    socket.emit('news:request_snapshot');

    return () => {
      socket.off('alert:new', handleAlert);
      socket.off('news:snapshot', handleSnapshot);
    };
  }, [socket, fetchNews]);

  return { news, loading, error };
}
