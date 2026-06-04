import { useState, useEffect, useRef } from 'react';
import './SearchBar.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  matchCount?: number;
}

export function SearchBar({ value, onChange, matchCount }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 300);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className={`search-bar ${isFocused ? 'focused' : ''} ${localValue ? 'has-value' : ''}`}>
      <div className="search-icon-wrapper">
        <span className="search-icon">🔍</span>
        {isFocused && <span className="search-pulse" />}
      </div>
      <input
        ref={inputRef}
        type="text"
        className="search-input"
        placeholder="Search by symbol or company name..."
        value={localValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {localValue && matchCount !== undefined && (
        <span className="search-match-count">{matchCount} matches</span>
      )}
      {localValue && (
        <button className="search-clear" onClick={handleClear} aria-label="Clear search">
          ✕
        </button>
      )}
      {isFocused && <div className="search-scanning-border" />}
    </div>
  );
}
