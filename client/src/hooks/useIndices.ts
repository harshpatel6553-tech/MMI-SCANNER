import { useState, useEffect, useRef } from 'react';
import { useSocketContext } from '../context/SocketContext';
import type { StockData } from '../types';

export function useIndices(allStocks: StockData[]) {
  const [indices, setIndices] = useState<Map<string, StockData>>(new Map());
  const [flashes, setFlashes] = useState<{ nifty?: 'up' | 'down'; bank?: 'up' | 'down' }>({});
  const prevNiftyPrice = useRef<number | null>(null);
  const prevBankPrice = useRef<number | null>(null);
  const timers = useRef<{ nifty?: ReturnType<typeof setTimeout>; bank?: ReturnType<typeof setTimeout> }>({});
  const { socket } = useSocketContext();

  const updateIndices = (items: StockData[]) => {
    let niftyItem: StockData | undefined;
    let bankItem: StockData | undefined;

    for (const item of items) {
      if (item.symbol === 'NIFTY 50' || item.name === 'NIFTY 50') {
        niftyItem = item;
      } else if (item.symbol === 'BANKNIFTY' || item.symbol === 'BANK NIFTY' || item.name === 'Bank NIFTY') {
        bankItem = item;
      }
    }

    if (!niftyItem && !bankItem) return;

    // Detect live price movement for pulse animations
    if (niftyItem && prevNiftyPrice.current !== null && niftyItem.price !== prevNiftyPrice.current) {
      const dir = niftyItem.price > prevNiftyPrice.current ? 'up' : 'down';
      setFlashes(f => ({ ...f, nifty: dir }));
      if (timers.current.nifty) clearTimeout(timers.current.nifty);
      timers.current.nifty = setTimeout(() => setFlashes(f => ({ ...f, nifty: undefined })), 800);
    }
    if (niftyItem) prevNiftyPrice.current = niftyItem.price;

    if (bankItem && prevBankPrice.current !== null && bankItem.price !== prevBankPrice.current) {
      const dir = bankItem.price > prevBankPrice.current ? 'up' : 'down';
      setFlashes(f => ({ ...f, bank: dir }));
      if (timers.current.bank) clearTimeout(timers.current.bank);
      timers.current.bank = setTimeout(() => setFlashes(f => ({ ...f, bank: undefined })), 800);
    }
    if (bankItem) prevBankPrice.current = bankItem.price;

    setIndices(prev => {
      const next = new Map(prev);
      if (niftyItem) next.set('NIFTY 50', niftyItem);
      if (bankItem) {
        next.set('BANKNIFTY', bankItem);
        next.set('BANK NIFTY', bankItem);
      }
      return next;
    });
  };

  // 1. Direct real-time Socket.IO streaming listeners (instant 0ms update on each tick)
  useEffect(() => {
    if (!socket) return;

    const handleSocketUpdate = (data: StockData[]) => {
      if (Array.isArray(data)) updateIndices(data);
    };

    socket.on('stocks:update:full', handleSocketUpdate);
    socket.on('stocks:update:partial', handleSocketUpdate);

    return () => {
      socket.off('stocks:update:full', handleSocketUpdate);
      socket.off('stocks:update:partial', handleSocketUpdate);
    };
  }, [socket]);

  // 2. Initial fetch & fast fallback polling from backend REST API with cache-buster
  useEffect(() => {
    let isMounted = true;
    const fetchIndices = async () => {
      try {
        const backendUrl = import.meta.env.VITE_SOCKET_URL || 'https://35.226.242.164.sslip.io';
        const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
        const res = await fetch(`${baseUrl}/api/stocks?index=INDEX&_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && isMounted) {
            updateIndices(json.data);
          }
        }
      } catch {
        // Fallback gracefully if offline
      }
    };

    fetchIndices();
    const interval = setInterval(fetchIndices, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
      if (timers.current.nifty) clearTimeout(timers.current.nifty);
      if (timers.current.bank) clearTimeout(timers.current.bank);
    };
  }, []);

  // 3. Fallback from parent allStocks prop
  useEffect(() => {
    if (allStocks && allStocks.length > 0) {
      updateIndices(allStocks);
    }
  }, [allStocks]);

  const nifty50 = indices.get('NIFTY 50');
  const bankNifty = indices.get('BANKNIFTY') || indices.get('BANK NIFTY');

  return {
    nifty50,
    bankNifty,
    flashes,
    allIndices: Array.from(indices.values()),
  };
}
