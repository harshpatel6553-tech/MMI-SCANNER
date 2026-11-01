import React, { useEffect, useRef, useState } from 'react';

export interface LivePriceProps {
  price: number;
  flash?: 'up' | 'down' | null;
  currencySymbol?: string;
  className?: string;
  decimals?: number;
}

export function LivePrice({
  price,
  flash: externalFlash,
  currencySymbol = '₹',
  className = '',
  decimals = 2
}: LivePriceProps) {
  const [internalFlash, setInternalFlash] = useState<'up' | 'down' | null>(null);
  const prevPriceRef = useRef<number>(price);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (externalFlash) {
      setInternalFlash(externalFlash);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setInternalFlash(null), 850);
      return;
    }

    const prev = prevPriceRef.current;
    if (prev !== undefined && prev !== price && !isNaN(price)) {
      const dir = price > prev ? 'up' : 'down';
      setInternalFlash(dir);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setInternalFlash(null), 850);
    }
    prevPriceRef.current = price;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [price, externalFlash]);

  const activeFlash = externalFlash || internalFlash;

  const formatted = typeof price === 'number' && !isNaN(price)
    ? price.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })
    : '---';

  let flashStyles = '';
  if (activeFlash === 'up') {
    flashStyles = 'text-[var(--up)] scale-[1.03] shadow-[0_0_12px_var(--up-glow)]';
  } else if (activeFlash === 'down') {
    flashStyles = 'text-[var(--down)] scale-[0.98] shadow-[0_0_12px_var(--down-glow)]';
  }

  return (
    <span
      className={`inline-flex items-center tabular-nums font-mono font-bold tracking-tight transition-all duration-300 transform origin-left ${flashStyles} ${className}`}
    >
      {currencySymbol && <span className="opacity-80 mr-0.5 text-[0.88em]">{currencySymbol}</span>}
      {formatted}
    </span>
  );
}

export default React.memo(LivePrice);
