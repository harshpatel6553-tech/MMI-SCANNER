import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface PriceChangeProps {
  change?: number;
  changePercent: number;
  showPercentOnly?: boolean;
  showIcon?: boolean;
  pill?: boolean;
  className?: string;
  decimals?: number;
}

export function PriceChange({
  change,
  changePercent,
  showPercentOnly = false,
  showIcon = true,
  pill = true,
  className = '',
  decimals = 2
}: PriceChangeProps) {
  const isUp = changePercent > 0;
  const isDown = changePercent < 0;
  const isFlat = changePercent === 0;

  const colorClass = isUp
    ? 'text-[var(--up)]'
    : isDown
    ? 'text-[var(--down)]'
    : 'text-[var(--text-2)]';

  const pillClass = pill
    ? isUp
      ? 'bg-[var(--up-dim)] border border-[rgba(0,214,163,0.3)] shadow-[0_0_10px_rgba(0,214,163,0.12)]'
      : isDown
      ? 'bg-[var(--down-dim)] border border-[rgba(255,66,104,0.3)] shadow-[0_0_10px_rgba(255,66,104,0.12)]'
      : 'bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)]'
    : '';

  const pctFormatted = `${isUp ? '+' : ''}${changePercent.toFixed(decimals)}%`;
  const chgFormatted = change !== undefined ? `${isUp ? '+' : ''}${change.toFixed(decimals)}` : null;

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-xs font-bold tabular-nums transition-all duration-300 ${pill ? 'px-2 py-0.5 rounded-full' : ''} ${colorClass} ${pillClass} ${className}`}
    >
      {showIcon && (
        <span className="shrink-0">
          {isUp ? (
            <TrendingUp size={11} strokeWidth={2} />
          ) : isDown ? (
            <TrendingDown size={11} strokeWidth={2} />
          ) : (
            <Minus size={11} strokeWidth={2} />
          )}
        </span>
      )}
      {!showPercentOnly && chgFormatted && (
        <span className="opacity-90 mr-0.5">{chgFormatted}</span>
      )}
      <span>{pctFormatted}</span>
    </span>
  );
}

export default React.memo(PriceChange);
