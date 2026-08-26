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
  
  // Ref to track if we should continue fast polling
  const isWarmingUp = useRef(false);

  const fetchNews = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/news`);
      const data = await response.json();
      if (data.success) {
        setNews(data.data);
        setError(null);
        
        // If empty, backend is likely still starting up/fetching from Twitter.
        if (data.data.length === 0) {
          isWarmingUp.current = true;
        } else {
          isWarmingUp.current = false;
        }
      } else {
        setError(data.error);
        isWarmingUp.current = false;
      }
    } catch (err) {
      setError('Failed to fetch news');
      isWarmingUp.current = false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    // Initial fetch
    fetchNews();

    // Standard fallback polling every 5 minutes since WebSockets handle real-time updates
    const tickInterval = setInterval(() => {
      fetchNews();
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(tickInterval);
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

