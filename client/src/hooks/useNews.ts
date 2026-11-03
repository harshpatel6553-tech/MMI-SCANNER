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

export function isAllowedSource(source?: string): boolean {
  if (!source) return false;
  const s = source.toLowerCase().replace('@', '').trim();
  return s === 'redboxindia' || s === 'yatinmota';
}

const BLACKLISTED_TITLE_PATTERNS = [
  /outlook\s*(&|and)?\s*prediction/i,
  /stock market this week/i,
  /market this week/i,
  /weekly market/i,
  /technical analysis/i,
  /share market (live|news|today)/i,
  /open(s|ed)? flat/i,
  /end(s|ed)? flat/i,
  /amid selling in/i,
  /among \d+ companies/i,
  /nifty (may|could|will|prediction)/i,
  /prediction/i,
  /market watch/i,
  /top stocks to buy/i,
  /stocks in focus/i,
  /trading guide/i,
  /expert advice/i,
  /brokerage radar/i,
];

function isNoisyOrBlacklisted(n: { source?: string; title?: string }): boolean {
  if (!isAllowedSource(n.source)) return true;
  const text = (n.title || '').toLowerCase();
  for (const pattern of BLACKLISTED_TITLE_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
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
 * Normalizes title text to detect duplicate headlines across different formats,
 * HTML encodings (&apos; vs '), and truncation variations.
 */
function getNormalizedTitleKey(title: string): string {
  if (!title) return '';
  const clean = title
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@[A-Za-z0-9_]+/g, '')
    .replace(/[…\.]{2,}$/g, '')
    .trim();
  const alpha = clean.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return alpha.substring(0, 45);
}

/**
 * Extracts a normalized key for stable cross-source matching
 */
function getTweetKey(item: NewsItem): string {
  const tweetIdFromLink = item.link?.match(/status\/(\d+)/)?.[1];
  if (tweetIdFromLink) return `t-${tweetIdFromLink}`;

  const tweetIdFromId = item.id?.match(/tweet-(\d+)/)?.[1];
  if (tweetIdFromId) return `t-${tweetIdFromId}`;

  const normTitle = getNormalizedTitleKey(item.title);
  if (normTitle && normTitle.length >= 10) return `p-${normTitle}`;

  if (item.link && !item.link.endsWith('/RedboxIndia') && !item.link.endsWith('/yatinmota')) {
    return `l-${item.link.toLowerCase()}`;
  }

  return item.id;
}

/**
 * Merges an incoming item with an existing item, strictly preserving:
 * 1. Longer untruncated title
 * 2. All affected stock chips (never deletes chips, filters out source handles)
 * 3. AI classified sentiment and insights
 */
function mergeNewsItem(incoming: NewsItem, existing?: NewsItem): NewsItem {
  const IGNORE_SYMBOLS = new Set(['REDBOXINDIA', 'YATINMOTA', 'ALERT', 'BREAKING', 'UPDATE', 'NEWS']);

  if (!existing) {
    const cleanStocks = (incoming.affectedStocks || [])
      .map(s => s?.replace(/^[@$]/, '').toUpperCase().trim())
      .filter(s => s && !IGNORE_SYMBOLS.has(s));
    return {
      ...incoming,
      affectedStocks: cleanStocks
    };
  }

  // Title: always keep the untruncated, complete title
  const incomingTrunc = incoming.title?.endsWith('…') || incoming.title?.endsWith('...') || incoming.title?.endsWith('..');
  const existingTrunc = existing.title?.endsWith('…') || existing.title?.endsWith('...') || existing.title?.endsWith('..');

  let title = incoming.title;
  if (existingTrunc && !incomingTrunc) {
    title = incoming.title;
  } else if (!existingTrunc && incomingTrunc) {
    title = existing.title;
  } else {
    title = (existing.title && existing.title.length > (incoming.title?.length || 0))
      ? existing.title
      : incoming.title;
  }

  // Affected stock chips: combine and deduplicate symbols, strictly excluding source handles!
  const stockSet = new Set<string>();
  (existing.affectedStocks || []).forEach(s => {
    const clean = s?.replace(/^[@$]/, '').toUpperCase().trim();
    if (clean && !IGNORE_SYMBOLS.has(clean)) stockSet.add(clean);
  });
  (incoming.affectedStocks || []).forEach(s => {
    const clean = s?.replace(/^[@$]/, '').toUpperCase().trim();
    if (clean && !IGNORE_SYMBOLS.has(clean)) stockSet.add(clean);
  });
  const affectedStocks = Array.from(stockSet);

  // Link: prefer real status link over empty or profile link
  const link = (incoming.link && incoming.link.includes('status/'))
    ? incoming.link
    : ((existing.link && existing.link.includes('status/')) ? existing.link : (incoming.link || existing.link));

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
    link,
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

  // Master merge function with cross-title deduplication (eliminates duplicates completely)
  const mergeLists = useCallback((incoming: NewsItem[], current: NewsItem[]): NewsItem[] => {
    const map = new Map<string, NewsItem>();
    const titleToKey = new Map<string, string>();

    const processItem = (item: NewsItem) => {
      if (!isAllowedSource(item.source) || isNoisyOrBlacklisted(item)) return;

      const normTitle = getNormalizedTitleKey(item.title);
      const primaryKey = getTweetKey(item);

      // Check if item exists by primaryKey OR by matching normalized headline title
      const existingKey = map.has(primaryKey)
        ? primaryKey
        : (normTitle && titleToKey.has(normTitle) ? titleToKey.get(normTitle)! : null);

      const targetKey = existingKey || primaryKey;
      const existing = existingKey ? map.get(existingKey) : undefined;

      // Restore cached full title if available
      let itemToMerge = item;
      const cachedFullTitle = normTitle ? fullTitleCacheRef.current.get(normTitle) : undefined;
      const itemIsTrunc = item.title?.endsWith('…') || item.title?.endsWith('...') || item.title?.endsWith('..');
      if (cachedFullTitle && (cachedFullTitle.length > (item.title?.length || 0) || (itemIsTrunc && !cachedFullTitle.endsWith('…') && !cachedFullTitle.endsWith('...')))) {
        itemToMerge = { ...item, title: cachedFullTitle };
      }

      const merged = mergeNewsItem(itemToMerge, existing);
      map.set(targetKey, merged);

      if (normTitle) {
        titleToKey.set(normTitle, targetKey);
        if (merged.title && !merged.title.endsWith('…') && !merged.title.endsWith('...')) {
          fullTitleCacheRef.current.set(normTitle, merged.title);
        }
      }
    };

    // Index current items first
    for (const item of current) {
      processItem(item);
    }

    // Merge incoming items
    for (const inc of incoming) {
      processItem(inc);
    }

    return Array.from(map.values())
      .filter(item => isAllowedSource(item.source) && !isNoisyOrBlacklisted(item))
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
            const cleanData = vData.data.filter((d: NewsItem) => isAllowedSource(d.source));
            setNews(prev => {
              const next = mergeLists(cleanData, prev);
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
      if (data.success && Array.isArray(data.data)) {
        const cleanData = data.data.filter((d: NewsItem) => isAllowedSource(d.source));
        setNews(prev => {
          const next = mergeLists(cleanData, prev);
          return areNewsListsEqual(prev, next) ? prev : next;
        });
        setError(null);
        if (cleanData.length > 0) {
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

    // When a real-time news alert or update arrives, trigger an immediate fresh fetch of the full authoritative news list
    const handleNewsTrigger = () => {
      fetchNews();
    };

    const handleSnapshot = (fullNews: NewsItem[]) => {
      if (Array.isArray(fullNews) && fullNews.length > 0) {
        // Strictly filter incoming snapshot to allow ONLY @RedboxIndia and @yatinmota
        const cleanNews = fullNews.filter(n => isAllowedSource(n.source) && !isNoisyOrBlacklisted(n));
        setNews(prev => {
          const next = mergeLists(cleanNews, prev);
          return areNewsListsEqual(prev, next) ? prev : next;
        });
        setLoading(false);
        isWarmingUp.current = false;
      }
    };

    socket.on('alert:new', handleNewsTrigger);
    socket.on('news:update', handleNewsTrigger);
    socket.on('news:snapshot', handleSnapshot);

    // Initial snapshot request
    socket.emit('news:request_snapshot');

    return () => {
      socket.off('alert:new', handleNewsTrigger);
      socket.off('news:update', handleNewsTrigger);
      socket.off('news:snapshot', handleSnapshot);
    };
  }, [socket, fetchNews, mergeLists]);

  return { news, loading, error };
}
