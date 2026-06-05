import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'mmi-watchlist';

function loadWatchlist(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
}

function saveWatchlist(watchlist: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(watchlist)));
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<Set<string>>(() => loadWatchlist());

  useEffect(() => {
    saveWatchlist(watchlist);
  }, [watchlist]);

  const toggle = useCallback((symbol: string) => {
    setWatchlist(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  }, []);

  const isWatchlisted = useCallback((symbol: string): boolean => {
    return watchlist.has(symbol);
  }, [watchlist]);

  const clear = useCallback(() => {
    setWatchlist(new Set());
  }, []);

  return {
    watchlist,
    toggle,
    isWatchlisted,
    clear,
    count: watchlist.size,
  };
}
