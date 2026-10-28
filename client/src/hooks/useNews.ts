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

/**
 * Compares two news arrays to prevent unnecessary React re-renders.
 * If IDs, titles, sentiments, and affected stock chips are identical, returns true.
 */
function areNewsListsEqual(a: NewsItem[], b: NewsItem[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const itemA = a[i];
    const itemB = b[i];
    if (itemA.id !== itemB.id) return false;
    if (itemA.title !== itemB.title) return false;
    if (itemA.sentiment !== itemB.sentiment) return false;
    const stocksA = (itemA.affectedStocks || []).join(',');
    const stocksB = (itemB.affectedStocks || []).join(',');
    if (stocksA !== stocksB) return false;
  }
  return true;
}

/**
 * Extracts a normalized key for stable cross-source matching
 */
function getTweetKey(item: NewsItem): string {
  const tweetId = item.link?.match(/status\/(\d+)/)?.[1];
  if (tweetId) return `t-${tweetId}`;
  if (item.link) return `l-${item.link.toLowerCase()}`;
  if (item.title) {
    const cleanPrefix = item.title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30).toLowerCase();
    if (cleanPrefix.length >= 12) return `p-${cleanPrefix}`;
  }
  return item.id;
}

/**
 * Merges an incoming item with an existing item, strictly preserving:
 * 1. Longer untruncated title
 * 2. All affected stock chips (never deletes chips)
 * 3. AI classified sentiment and insights
 */
function mergeNewsItem(incoming: NewsItem, existing?: NewsItem): NewsItem {
  if (!existing) return incoming;

  // Title: always keep the longer, non-cut title
  const title = (existing.title && existing.title.length > (incoming.title?.length || 0))
    ? existing.title
    : incoming.title;

  // Affected stock chips: combine and deduplicate symbols, NEVER delete chips!
  const stockSet = new Set<string>();
  (existing.affectedStocks || []).forEach(s => s && stockSet.add(s.toUpperCase()));
  (incoming.affectedStocks || []).forEach(s => s && stockSet.add(s.toUpperCase()));
  const affectedStocks = Array.from(stockSet);

  // Sentiment: preserve non-neutral sentiment if incoming defaulted to Neutral
  let sentiment = incoming.sentiment || existing.sentiment || 'Neutral';
  if (sentiment === 'Neutral' && existing.sentiment && existing.sentiment !== 'Neutral') {
    sentiment = existing.sentiment;
  }

  return {
    ...existing,
    ...incoming,
    id: existing.id || incoming.id,
    title,
    affectedStocks,
    sentiment,
    isEarningsResult: incoming.isEarningsResult ?? existing.isEarningsResult,
    isPromoterAction: incoming.isPromoterAction ?? existing.isPromoterAction,
    reasoning: incoming.reasoning || existing.reasoning,
    perspective: incoming.perspective || existing.perspective,
  };
}

export function useNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { socket } = useSocketContext();
  const isWarmingUp = useRef(false);

  // Permanent title cache so a full title is never downgraded
  const fullTitleCacheRef = useRef<Map<string, string>>(new Map());

  // Master merge function that prevents UI flickering and preserves all chips & titles
  const mergeLists = useCallback((incoming: NewsItem[], current: NewsItem[]): NewsItem[] => {
    const map = new Map<string, NewsItem>();

    // Index current items
    for (const item of current) {
      const key = getTweetKey(item);
      map.set(key, item);
      if (item.title && !item.title.endsWith('…') && !item.title.endsWith('...')) {
        fullTitleCacheRef.current.set(key, item.title);
      }
    }

    // Merge incoming items
    for (const inc of incoming) {
      const key = getTweetKey(inc);
      const existing = map.get(key);

      // Restore cached full title if incoming is cut off
      let itemToMerge = inc;
      const cachedFullTitle = fullTitleCacheRef.current.get(key);
      if (cachedFullTitle && cachedFullTitle.length > (inc.title?.length || 0)) {
        itemToMerge = { ...inc, title: cachedFullTitle };
      }

      const merged = mergeNewsItem(itemToMerge, existing);
      map.set(key, merged);

      if (merged.title && !merged.title.endsWith('…') && !merged.title.endsWith('...')) {
        fullTitleCacheRef.current.set(key, merged.title);
      }
    }

    return Array.from(map.values())
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 100);
  }, []);

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
            setNews(prev => {
              const next = mergeLists(vData.data, prev);
              return areNewsListsEqual(prev, next) ? prev : next;
            });
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
        setNews(prev => {
          const next = mergeLists(data.data, prev);
          return areNewsListsEqual(prev, next) ? prev : next;
        });
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
  }, [mergeLists]);

  useEffect(() => {
    let isMounted = true;
    fetchNews();

    // Refresh every 4 seconds; if content hasn't changed, areNewsListsEqual prevents re-render
    const tickInterval = setInterval(() => {
      if (!isMounted) return;
      fetchNews();
    }, 4000);

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

          setNews(prev => {
            const next = mergeLists([newItem], prev);
            return areNewsListsEqual(prev, next) ? prev : next;
          });
        }

        // Trigger background sync
        fetchNews();
      }
    };

    const handleSnapshot = (fullNews: NewsItem[]) => {
      if (Array.isArray(fullNews) && fullNews.length > 0) {
        setNews(prev => {
          const next = mergeLists(fullNews, prev);
          return areNewsListsEqual(prev, next) ? prev : next;
        });
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
  }, [socket, fetchNews, mergeLists]);

  return { news, loading, error };
}
