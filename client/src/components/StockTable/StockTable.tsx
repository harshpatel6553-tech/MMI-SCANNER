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
  { key: 'watchlist', label: 'W', className: 'col-watchlist', sortable: false },
  { key: 'index', label: 'ID', className: 'col-index', sortable: false },
  { key: 'symbol', label: 'TICKER', className: 'col-symbol', sortable: true },
  { key: 'name', label: 'ENTITY', className: 'col-name', sortable: true },
  { key: 'price', label: 'LAST', className: 'col-price', sortable: true },
  { key: 'change', label: 'CHG', className: 'col-change', sortable: true },
  { key: 'changePercent', label: 'CHG%', className: 'col-pct', sortable: true },
  { key: 'dayHigh', label: 'HIGH', className: 'col-high', sortable: true },
  { key: 'dayLow', label: 'LOW', className: 'col-low', sortable: true },
  { key: 'volume', label: 'VOL', className: 'col-volume', sortable: true },
];

export function StockTable({ stocks, priceFlash, sortField, sortOrder, onSort, isLoading, watchlist, onToggleWatchlist, onRowClick }: StockTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (stocks.length > 0 && !hasAnimated) {
      const timer = setTimeout(() => setHasAnimated(true), 100);
      return () => clearTimeout(timer);
    }
  }, [stocks.length, hasAnimated]);

  const getSortIndicator = (field: string) => {
    if (field !== sortField) return '';
    return sortOrder === 'asc' ? '[ASC]' : '[DSC]';
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="stock-table-wrapper">
        <div className="terminal-header">
          <span className="terminal-title">DATASTREAM [LOADING]</span>
          <span className="terminal-status blink">_</span>
        </div>
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="skeleton-row">
            <div className="skeleton-cell" style={{width: '100%'}}></div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (stocks.length === 0) {
    return (
      <div className="stock-table-wrapper">
        <div className="terminal-header">
          <span className="terminal-title">DATASTREAM [EMPTY]</span>
        </div>
        <div className="table-empty">
          <div className="table-empty-text">NULL_RECORD_SET</div>
        </div>
      </div>
    );
  }

  return (
    <div className="stock-table-wrapper">
      <div className="terminal-header">
        <span className="terminal-title">TERMINAL // TICKER DATA</span>
        <span className="terminal-count">RECORDS: {stocks.length}</span>
      </div>
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
      <div className="stock-table-body" ref={scrollRef}>
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
