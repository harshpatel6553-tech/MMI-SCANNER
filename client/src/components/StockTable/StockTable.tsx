import { useState, useRef, useCallback, useEffect } from 'react';
import type { StockData, SortField, SortOrder } from '../../types';
import { StockRow } from './StockRow';
import './StockTable.css';

interface StockTableProps {
  stocks: StockData[];
  priceFlash: Map<string, 'up' | 'down'>;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  isLoading: boolean;
  watchlist: Set<string>;
  onToggleWatchlist: (symbol: string) => void;
  onRowClick: (stock: StockData) => void;
}

const columns: { key: SortField | 'index' | 'indicator' | 'watchlist'; label: string; className: string; sortable: boolean }[] = [
  { key: 'watchlist', label: '★', className: 'col-watchlist', sortable: false },
  { key: 'index', label: '#', className: 'col-index', sortable: false },
  { key: 'symbol', label: 'Symbol', className: 'col-symbol', sortable: true },
  { key: 'name', label: 'Company', className: 'col-name', sortable: true },
  { key: 'price', label: 'Price (₹)', className: 'col-price', sortable: true },
  { key: 'change', label: 'Change', className: 'col-change', sortable: true },
  { key: 'changePercent', label: 'Change %', className: 'col-pct', sortable: true },
  { key: 'dayHigh', label: 'Day High', className: 'col-high', sortable: true },
  { key: 'dayLow', label: 'Day Low', className: 'col-low', sortable: true },
  { key: 'volume', label: 'Volume', className: 'col-volume', sortable: true },
];

export function StockTable({ stocks, priceFlash, sortField, sortOrder, onSort, isLoading, watchlist, onToggleWatchlist, onRowClick }: StockTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Track if initial animation has played
  useEffect(() => {
    if (stocks.length > 0 && !hasAnimated) {
      const timer = setTimeout(() => setHasAnimated(true), stocks.length * 30 + 500);
      return () => clearTimeout(timer);
    }
  }, [stocks.length, hasAnimated]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const progress = el.scrollTop / (el.scrollHeight - el.clientHeight) * 100;
    setScrollProgress(Math.min(100, Math.max(0, progress || 0)));
  }, []);

  const getSortIndicator = (field: string) => {
    if (field !== sortField) return '';
    return sortOrder === 'asc' ? '▲' : '▼';
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="stock-table-wrapper">
        <div className="table-scroll-progress" style={{ width: '30%' }} />
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="skeleton-cell sk-star skeleton" />
            <div className="skeleton-cell sk-index skeleton" />
            <div className="skeleton-cell sk-symbol skeleton" />
            <div className="skeleton-cell sk-name skeleton" />
            <div className="skeleton-cell sk-price skeleton" />
            <div className="skeleton-cell sk-change skeleton" />
            <div className="skeleton-cell sk-pct skeleton" />
            <div className="skeleton-cell sk-high skeleton" />
            <div className="skeleton-cell sk-low skeleton" />
            <div className="skeleton-cell sk-vol skeleton" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (stocks.length === 0) {
    return (
      <div className="stock-table-wrapper">
        <div className="table-empty">
          <div className="table-empty-icon">🔍</div>
          <div className="table-empty-text">No stocks match your filters</div>
          <div className="table-empty-sub">Try adjusting your search or filter criteria</div>
        </div>
      </div>
    );
  }

  return (
    <div className="stock-table-wrapper">
      <div className="table-scroll-progress" style={{ width: `${scrollProgress}%` }} />
      <table className="stock-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={`${col.className} ${col.sortable && sortField === col.key ? 'sorted' : ''}`}
                onClick={() => col.sortable && col.key !== 'index' && col.key !== 'indicator' && col.key !== 'watchlist' && onSort(col.key as SortField)}
              >
                {col.label}
                {col.sortable && sortField === col.key && (
                  <span className="sort-indicator">{getSortIndicator(col.key)}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
      </table>
      <div className="stock-table-body" ref={scrollRef} onScroll={handleScroll}>
        <table className="stock-table">
          <tbody>
            {stocks.map((stock, i) => (
              <StockRow
                key={stock.symbol}
                stock={stock}
                index={i}
                flash={priceFlash.get(stock.symbol) ?? null}
                isNew={!hasAnimated}
                isWatchlisted={watchlist.has(stock.symbol)}
                onToggleWatchlist={() => onToggleWatchlist(stock.symbol)}
                onRowClick={onRowClick}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
