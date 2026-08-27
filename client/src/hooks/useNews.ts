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
  
  // Ref to track retry attempts for fast polling
  const retryCount = useRef(0);
  const MAX_RETRIES = 10; // 10 retries * 3s = 30 seconds of fast polling

  const fetchNews = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/news`);
      const data = await response.json();
      if (data.success) {
        setNews(data.data);
        setError(null);
        
        // If empty, backend is likely still starting up/fetching from Twitter.
        if (data.data.length > 0) {
          retryCount.current = MAX_RETRIES; // Stop fast polling on success
        }
      } else {
        setError(data.error);
        // Don't stop retrying on API error, server might be booting
      }
    } catch (err) {
      setError('Failed to fetch news');
      // Don't stop retrying on network error (502 Bad Gateway during Render boot)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    // Initial fetch
    fetchNews();

    // Adaptive fallback polling: poll every 3 seconds if empty, otherwise 60 seconds
    let ticks = 0;
    const tickInterval = setInterval(() => {
      if (!isMounted) return;
      ticks++;
      
      if (retryCount.current < MAX_RETRIES) {
        // Fast polling mode (every 3 seconds)
        retryCount.current++;
        fetchNews();
      } else if (ticks >= 20) { 
        // Normal polling mode (20 ticks * 3s = 60 seconds)
        fetchNews();
        ticks = 0;
      }
    }, 3000);

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

