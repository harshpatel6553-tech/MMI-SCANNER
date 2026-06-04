import { useState, useEffect, useMemo, useRef } from 'react';
import { useSocketContext } from '../context/SocketContext';
import type { StockData, FilterOptions, SortField, SortOrder } from '../types';

export function useStocks(
  filters: FilterOptions,
  sortField: SortField,
  sortOrder: SortOrder
) {
  const { socket } = useSocketContext();
  const [stockMap, setStockMap] = useState<Map<string, StockData>>(new Map());
  const [priceFlash, setPriceFlash] = useState<Map<string, 'up' | 'down'>>(new Map());
  const prevPrices = useRef<Map<string, number>>(new Map());
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (data: StockData[]) => {
      setStockMap(prev => {
        const newMap = new Map(prev);
        const newFlashes = new Map<string, 'up' | 'down'>();

        data.forEach(stock => {
          const oldPrice = prevPrices.current.get(stock.symbol);
          if (oldPrice !== undefined && oldPrice !== stock.price) {
            const direction = stock.price > oldPrice ? 'up' : 'down';
            newFlashes.set(stock.symbol, direction);

            // Clear existing timer
            const existingTimer = flashTimers.current.get(stock.symbol);
            if (existingTimer) clearTimeout(existingTimer);

            // Set new timer to clear flash
            const timer = setTimeout(() => {
              setPriceFlash(prev => {
                const next = new Map(prev);
                next.delete(stock.symbol);
                return next;
              });
            }, 1000);
            flashTimers.current.set(stock.symbol, timer);
          }
          prevPrices.current.set(stock.symbol, stock.price);
          newMap.set(stock.symbol, stock);
        });

        if (newFlashes.size > 0) {
          setPriceFlash(prev => {
            const next = new Map(prev);
            newFlashes.forEach((v, k) => next.set(k, v));
            return next;
          });
        }

        return newMap;
      });
    };

    socket.on('stocks:update', handleUpdate);

    return () => {
      socket.off('stocks:update', handleUpdate);
      flashTimers.current.forEach(t => clearTimeout(t));
    };
  }, [socket]);

  const allStocks = useMemo(() => Array.from(stockMap.values()), [stockMap]);

  const stats = useMemo(() => {
    let gainers = 0, losers = 0, unchanged = 0;
    allStocks.forEach(s => {
      if (s.change > 0) gainers++;
      else if (s.change < 0) losers++;
      else unchanged++;
    });
    return { total: allStocks.length, gainers, losers, unchanged };
  }, [allStocks]);

  const filteredAndSorted = useMemo(() => {
    let result = allStocks;

    // Filter by index
    if (filters.index !== 'ALL') {
      result = result.filter(s => s.indexName === filters.index);
    }

    // Filter by search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(s =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q)
      );
    }

    // Filter by price range
    if (filters.priceMin > 0) {
      result = result.filter(s => s.price >= filters.priceMin);
    }
    if (filters.priceMax > 0) {
      result = result.filter(s => s.price <= filters.priceMax);
    }

    // Filter by volume
    if (filters.volumeMin > 0) {
      result = result.filter(s => s.volume >= filters.volumeMin);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number = a[sortField];
      let bVal: string | number = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [allStocks, filters, sortField, sortOrder]);

  return {
    stocks: filteredAndSorted,
    allStocks,
    stats,
    priceFlash,
  };
}
