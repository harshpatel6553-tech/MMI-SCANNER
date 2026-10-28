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

  // Permanent full title cache: once an untruncated full title is known, it can NEVER be downgraded to a cut-off version
  const knownFullTitlesRef = useRef<Map<string, string>>(new Map());

  // Helper to extract a stable normalized key for any tweet (by tweet ID or text prefix)
  const getTweetKeys = (item: NewsItem): string[] => {
    const keys: string[] = [];
    if (item.id) keys.push(item.id);
    const tweetId = item.link?.match(/status\/(\d+)/)?.[1];
    if (tweetId) keys.push(`tweet-${tweetId}`);
    if (item.link) keys.push(item.link.toLowerCase());
    if (item.title) {
      const prefix = item.title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 35).toLowerCase();
      if (prefix.length >= 15) keys.push(`pfx-${prefix}`);
    }
    return keys;
  };

  // Process and protect incoming news items against title truncation
  const protectNewsItem = useCallback((item: NewsItem): NewsItem => {
    const keys = getTweetKeys(item);
    const incomingTitle = item.title ? item.title.trim() : '';
    const isTruncated = incomingTitle.endsWith('…') || incomingTitle.endsWith('...') || incomingTitle.endsWith('..');

    // Check if we already know a longer, untruncated title for this tweet
    let bestTitle = incomingTitle;
    for (const key of keys) {
      const known = knownFullTitlesRef.current.get(key);
      if (known && known.length > bestTitle.length) {
        bestTitle = known;
      }
    }

    // If incoming is clean and untruncated and longer, save it to our permanent full title cache
    if (!isTruncated && incomingTitle.length >= bestTitle.length) {
      bestTitle = incomingTitle;
      for (const key of keys) {
        knownFullTitlesRef.current.set(key, bestTitle);
      }
    }

    return {
      ...item,
      title: bestTitle
    };
  }, []);

  // Merge and protect list of news items
  const mergeAndProtectNews = useCallback((incoming: NewsItem[], current: NewsItem[]): NewsItem[] => {
    const protectedIncoming = incoming.map(protectNewsItem);
    const protectedCurrent = current.map(protectNewsItem);

    const map = new Map<string, NewsItem>();

    // Add current first
    for (const item of protectedCurrent) {
      const tweetId = item.link?.match(/status\/(\d+)/)?.[1];
      const primaryKey = tweetId ? `tweet-${tweetId}` : item.id;
      map.set(primaryKey, item);
    }

    // Overwrite with protected incoming (preserving full titles)
    for (const item of protectedIncoming) {
      const tweetId = item.link?.match(/status\/(\d+)/)?.[1];
      const primaryKey = tweetId ? `tweet-${tweetId}` : item.id;
      const existing = map.get(primaryKey);
      if (existing && existing.title.length > item.title.length) {
        map.set(primaryKey, { ...item, title: existing.title });
      } else {
        map.set(primaryKey, item);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    ).slice(0, 100);
  }, [protectNewsItem]);

  const fetchNews = useCallback(async () => {
    try {
      // Priority 1: Vercel serverless /api/news (auto-deployed, 100% untruncated full tweets, 0s CDN cache)
      try {
        const vRes = await fetch(`/api/news?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (vRes.ok) {
          const vData = await vRes.json();
          if (vData.success && Array.isArray(vData.data) && vData.data.length > 0) {
            setNews(prev => mergeAndProtectNews(vData.data, prev));
            setError(null);
            isWarmingUp.current = false;
            return;
          }
        }
      } catch {
        // Fallback to backend server API
      }

      // Priority 2: Backend server /api/news
      const response = await fetch(`${API_URL}/news?_t=${Date.now()}`);
      const data = await response.json();
      if (data.success) {
        setNews(prev => mergeAndProtectNews(data.data, prev));
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
  }, [mergeAndProtectNews]);

  useEffect(() => {
    let isMounted = true;
    fetchNews();

    // Fast polling every 3 seconds so the news feed is always ultra-fresh
    const tickInterval = setInterval(() => {
      if (!isMounted) return;
      fetchNews();
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(tickInterval);
    };
  }, [fetchNews]);

  useEffect(() => {
    if (!socket) return;

    // Real-time 0ms alert listener: instantly inject the news item into the feed the millisecond the alert fires!
    const handleAlert = (alert: any) => {
      if (alert.alertType === 'NEWS' || alert.title || alert.details) {
        const titleText = alert.title || alert.details || '';
        if (titleText) {
          const newItem: NewsItem = {
            id: alert.id || `alert-${Date.now()}`,
            title: titleText,
            link: alert.link || '',
            pubDate: alert.pubDate || alert.createdAt || new Date().toISOString(),
            source: alert.source || 'REDBOXINDIA',
            sentiment: alert.sentiment || 'Neutral',
            affectedStocks: alert.affectedStocks || (alert.symbol ? [alert.symbol] : []),
            isEarningsResult: alert.isEarningsResult,
            isPromoterAction: alert.isPromoterAction
          };

          // Immediately prepend to news state with 0ms delay!
          setNews(prev => mergeAndProtectNews([newItem], prev));
        }

        // Also trigger background fetch for full snapshot
        fetchNews();
      }
    };

    const handleSnapshot = (fullNews: NewsItem[]) => {
      if (Array.isArray(fullNews) && fullNews.length > 0) {
        setNews(prev => mergeAndProtectNews(fullNews, prev));
        setLoading(false);
        isWarmingUp.current = false;
      }
    };

    socket.on('alert:new', handleAlert);
    socket.on('news:snapshot', handleSnapshot);

    // Initial snapshot request
    socket.emit('news:request_snapshot');

    return () => {
      socket.off('alert:new', handleAlert);
      socket.off('news:snapshot', handleSnapshot);
    };
  }, [socket, fetchNews, mergeAndProtectNews]);

  return { news, loading, error };
}
