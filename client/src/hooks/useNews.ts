import { useState, useEffect, useCallback } from 'react';
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
}

const API_URL = (import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000') + '/api';

export function useNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { socket } = useSocketContext();

  const fetchNews = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/news`);
      const data = await response.json();
      if (data.success) {
        setNews(data.data);
        setError(null);
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
    
    // Initial fetch
    fetchNews();

    // Poll for new news every 60 seconds as a fallback
    const interval = setInterval(() => {
      if (isMounted) fetchNews();
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchNews]);

  // Listen for real-time news alerts to trigger instant refetch
  useEffect(() => {
    if (!socket) return;

    const handleAlert = (alert: any) => {
      if (alert.alertType === 'NEWS') {
        // Instantly refetch news when a new news alert is broadcasted!
        fetchNews();
      }
    };

    socket.on('alert:new', handleAlert);

    return () => {
      socket.off('alert:new', handleAlert);
    };
  }, [socket, fetchNews]);

  return { news, loading, error };
}
