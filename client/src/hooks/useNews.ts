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
  reasoning?: string;
  perspective?: 'Company' | 'IndiaMacro' | 'General';
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

  // Helper to merge items preserving untruncated full titles
  const mergeNewsPreservingFullText = (incoming: NewsItem[], current: NewsItem[]): NewsItem[] => {
    return incoming.map(inc => {
      const existing = current.find(c => c.id === inc.id || (c.link && c.link === inc.link));
      if (existing && existing.title && existing.title.length > inc.title.length) {
        return { ...inc, title: existing.title };
      }
      return inc;
    });
  };

  const fetchNews = useCallback(async () => {
    try {
      // Priority 1: Vercel serverless /api/news (auto-deployed, 100% untruncated full tweets)
      try {
        const vRes = await fetch(`/api/news?_t=${Date.now()}`);
        if (vRes.ok) {
          const vData = await vRes.json();
          if (vData.success && Array.isArray(vData.data) && vData.data.length > 0) {
            setNews(prev => mergeNewsPreservingFullText(vData.data, prev));
            setError(null);
            isWarmingUp.current = false;
            return;
          }
        }
      } catch {
        // Fallback to backend server API
      }

      // Priority 2: Backend server /api/news
      const response = await fetch(`${API_URL}/news`);
      const data = await response.json();
      if (data.success) {
        setNews(prev => mergeNewsPreservingFullText(data.data, prev));
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
      } else if (ticks >= 3) { // Fallback refresh every 9s if socket misses
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
      setNews(prev => mergeNewsPreservingFullText(fullNews, prev));
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
