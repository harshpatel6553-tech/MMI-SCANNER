import { useState, useEffect, useMemo, useRef } from 'react';
import { useSocketContext } from '../context/SocketContext';
import type { StockData, FilterOptions, SortField, SortOrder } from '../types';

export function useStocks(
  filters: FilterOptions,
  sortField: SortField,
  sortOrder: SortOrder
) {
  const { socket } = useSocketContext();
  const [allStocks, setAllStocks] = useState<StockData[]>([]);
  const [priceFlash, setPriceFlash] = useState<Map<string, 'up' | 'down'>>(new Map());
  const prevPrices = useRef<Map<string, number>>(new Map());
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!socket) return;

    // Force the server to send a full snapshot.
    // Explicitly wait for connection to bypass offline queue bugs.
    const requestSnapshot = () => socket.emit('subscribe:index', 'ALL');
    if (socket.connected) {
      requestSnapshot();
    } else {
      socket.on('connect', requestSnapshot);
    }

    const handleUpdate = (data: StockData[]) => {
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
      });

      if (newFlashes.size > 0) {
        setPriceFlash(prev => {
          const next = new Map(prev);
          newFlashes.forEach((v, k) => next.set(k, v));
          return next;
        });
      }

      setAllStocks(data);
    };

    const handlePartialUpdate = (deltaData: StockData[]) => {
      // Just re-use the flash logic from handleUpdate
      const newFlashes = new Map<string, 'up' | 'down'>();
      deltaData.forEach(stock => {
        const oldPrice = prevPrices.current.get(stock.symbol);
        if (oldPrice !== undefined && oldPrice !== stock.price) {
          const direction = stock.price > oldPrice ? 'up' : 'down';
          newFlashes.set(stock.symbol, direction);
          const existingTimer = flashTimers.current.get(stock.symbol);
          if (existingTimer) clearTimeout(existingTimer);
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
      });

      if (newFlashes.size > 0) {
        setPriceFlash(prev => {
          const next = new Map(prev);
          newFlashes.forEach((v, k) => next.set(k, v));
          return next;
        });
      }

      setAllStocks(prev => {
        if (prev.length === 0) return deltaData;
        const map = new Map(prev.map(s => [s.symbol, s]));
        deltaData.forEach(s => map.set(s.symbol, s));
        return Array.from(map.values());
      });
    };

    socket.on('stocks:update:full', handleUpdate);
    socket.on('stocks:update:partial', handlePartialUpdate);

    return () => {
      socket.off('stocks:update:full', handleUpdate);
      socket.off('stocks:update:partial', handlePartialUpdate);
      socket.off('connect', requestSnapshot);
      flashTimers.current.forEach(t => clearTimeout(t));
    };
  }, [socket]);

  const stats = useMemo(() => {
    let gainers = 0, losers = 0, unchanged = 0, volumeSpikes = 0;
    allStocks.forEach(s => {
      if (s.change > 0) gainers++;
      else if (s.change < 0) losers++;
      else unchanged++;
      if (s.volumeSpike) volumeSpikes++;
    });
    const advanceDeclineRatio = losers > 0 ? +(gainers / losers).toFixed(2) : gainers > 0 ? Infinity : 0;
    const breadthPercent = allStocks.length > 0 ? +((gainers / allStocks.length) * 100).toFixed(1) : 0;
    return { total: allStocks.length, gainers, losers, unchanged, advanceDeclineRatio, breadthPercent, volumeSpikes };
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

  const sectorData = useMemo(() => {
    const map = new Map<string, { stocks: StockData[], totalStocks: number, avgChange: number, gainers: number, losers: number }>();
    filteredAndSorted.forEach(s => {
      const sector = s.sector || 'Unknown';
      if (!map.has(sector)) {
        map.set(sector, { stocks: [], totalStocks: 0, avgChange: 0, gainers: 0, losers: 0 });
      }
      const entry = map.get(sector)!;
      entry.stocks.push(s);
      entry.totalStocks += 1;
      entry.avgChange += s.changePercent;
      if (s.changePercent > 0) entry.gainers += 1;
      if (s.changePercent < 0) entry.losers += 1;
    });

    // Finalize averages
    for (const [_, entry] of map.entries()) {
      if (entry.totalStocks > 0) {
        entry.avgChange = entry.avgChange / entry.totalStocks;
      }
    }

    return map;
  }, [filteredAndSorted]);

  return {
    stocks: filteredAndSorted,
    allStocks,
    stats,
    priceFlash,
    sectorData,
  };
}

