import { useCallback } from 'react';
import type { FilterOptions } from '../../types';
import './FilterPanel.css';

interface FilterPanelProps {
  filters: FilterOptions;
  onChange: (filters: FilterOptions) => void;
  stats: { total: number; gainers: number; losers: number; unchanged: number };
}

export function FilterPanel({ filters, onChange, stats }: FilterPanelProps) {
  const updateFilter = useCallback(
    <K extends keyof FilterOptions>(key: K, value: FilterOptions[K]) => {
      onChange({ ...filters, [key]: value });
    },
    [filters, onChange]
  );

  const resetFilters = useCallback(() => {
    onChange({
      index: 'ALL',
      priceMin: 0,
      priceMax: 0,
      volumeMin: 0,
      search: '',
    });
  }, [onChange]);

  const indexOptions: FilterOptions['index'][] = ['ALL', 'NIFTY50', 'NIFTY500'];
  const indexLabels: Record<string, string> = {
    ALL: 'All',
    NIFTY50: 'Nifty 50',
    NIFTY500: 'Nifty 500',
  };

  return (
    <div className="filter-panel glass-card">
      <div className="filter-row">
        {/* Index toggle pills */}
        <div className="filter-group">
          <label className="filter-label">Index</label>
          <div className="pill-toggle">
            {indexOptions.map(opt => (
              <button
                key={opt}
                className={`pill-btn ${filters.index === opt ? 'active' : ''}`}
                onClick={() => updateFilter('index', opt)}
              >
                {indexLabels[opt]}
              </button>
            ))}
          </div>
        </div>

        {/* Price range */}
        <div className="filter-group">
          <label className="filter-label">Price Range</label>
          <div className="range-inputs">
            <div className="input-with-prefix">
              <span className="input-prefix">₹</span>
              <input
                type="number"
                className="input filter-input"
                placeholder="Min"
                value={filters.priceMin || ''}
                onChange={e => updateFilter('priceMin', Number(e.target.value) || 0)}
              />
            </div>
            <span className="range-separator">â€”</span>
            <div className="input-with-prefix">
              <span className="input-prefix">₹</span>
              <input
                type="number"
                className="input filter-input"
                placeholder="Max"
                value={filters.priceMax || ''}
                onChange={e => updateFilter('priceMax', Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        {/* Volume filter */}
        <div className="filter-group">
          <label className="filter-label">Min Volume</label>
          <input
            type="number"
            className="input filter-input"
            placeholder="e.g. 100000"
            value={filters.volumeMin || ''}
            onChange={e => updateFilter('volumeMin', Number(e.target.value) || 0)}
          />
        </div>

        {/* Reset */}
        <div className="filter-group filter-actions">
          <button className="btn btn-reset" onClick={resetFilters}>
            â†º Reset
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-icon">ðŸ“Š</span>
          <span className="stat-label">Total:</span>
          <span className="stat-value text-accent">{stats.total}</span>
        </div>
        <div className="stat-item">
          <span className="stat-icon">ðŸ“ˆ</span>
          <span className="stat-label">Gainers:</span>
          <span className="stat-value positive">{stats.gainers}</span>
        </div>
        <div className="stat-item">
          <span className="stat-icon">ðŸ“‰</span>
          <span className="stat-label">Losers:</span>
          <span className="stat-value negative">{stats.losers}</span>
        </div>
        <div className="stat-item">
          <span className="stat-icon">âž–</span>
          <span className="stat-label">Unchanged:</span>
          <span className="stat-value text-muted">{stats.unchanged}</span>
        </div>
      </div>
    </div>
  );
}
