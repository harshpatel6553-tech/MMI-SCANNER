import { useState, useEffect } from 'react';
import { useSocketContext } from '../context/SocketContext';
import type { StockData } from '../types';

export function useIndices(allStocks: StockData[]) {
  const [indices, setIndices] = useState<Map<string, StockData>>(new Map());
  const { socket } = useSocketContext();

  // 1. Initial fetch & periodic poll from backend REST API to ensure immediate live quotes
  useEffect(() => {
    let isMounted = true;
    const fetchIndices = async () => {
      try {
        const backendUrl = import.meta.env.VITE_SOCKET_URL || '';
        const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
        const res = await fetch(`${baseUrl}/api/stocks/stocks?index=INDEX`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && isMounted) {
            setIndices(prev => {
              const next = new Map(prev);
              json.data.forEach((item: StockData) => {
                next.set(item.symbol, item);
                if (item.symbol === 'BANKNIFTY') next.set('BANK NIFTY', item);
              });
              return next;
            });
          }
        }
      } catch {
        // Fallback gracefully if offline
      }
    };

    fetchIndices();
    const interval = setInterval(fetchIndices, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Also incorporate real-time socket updates from allStocks
  useEffect(() => {
    if (!allStocks || allStocks.length === 0) return;
    const nifty = allStocks.find(s => s.symbol === 'NIFTY 50' || s.name === 'NIFTY 50');
    const bank = allStocks.find(s => s.symbol === 'BANKNIFTY' || s.name === 'Bank NIFTY' || s.symbol === 'BANK NIFTY');
    if (nifty || bank) {
      setIndices(prev => {
        const next = new Map(prev);
        if (nifty) next.set('NIFTY 50', nifty);
        if (bank) {
          next.set('BANKNIFTY', bank);
          next.set('BANK NIFTY', bank);
        }
        return next;
      });
    }
  }, [allStocks]);

  const nifty50 = indices.get('NIFTY 50');
  const bankNifty = indices.get('BANKNIFTY') || indices.get('BANK NIFTY');

  return {
    nifty50,
    bankNifty,
    allIndices: Array.from(indices.values()),
  };
}
