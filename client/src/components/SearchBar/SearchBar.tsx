import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    <motion.div 
      layout
      className={`search-bar ${isFocused ? 'focused' : ''} ${localValue ? 'has-value' : ''}`}
    >
      <div className="search-icon-wrapper">
        <Search size={16} className="search-icon text-muted" />
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
      <AnimatePresence>
        {localValue && (
          <motion.button 
            initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
            className="search-clear" 
            onClick={handleClear} 
            aria-label="Clear search"
          >
            <X size={14} />
          </motion.button>
        )}
      </AnimatePresence>
      {isFocused && <div className="search-scanning-border" />}
    </motion.div>
  );
}
