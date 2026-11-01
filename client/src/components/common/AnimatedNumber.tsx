import React, { useEffect, useRef, useState } from 'react';

export interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  formatIndian?: boolean;
  flashOnChange?: boolean;
  className?: string;
  duration?: number;
}

export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  formatIndian = true,
  flashOnChange = true,
  className = '',
  duration = 450
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const [flashDirection, setFlashDirection] = useState<'up' | 'down' | null>(null);
  const prevValueRef = useRef<number>(value);
  const animFrameRef = useRef<number | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevValueRef.current;
    if (prev === value) return;

    if (flashOnChange && typeof prev === 'number' && !isNaN(prev)) {
      const dir = value > prev ? 'up' : 'down';
      setFlashDirection(dir);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => {
        setFlashDirection(null);
      }, 750);
    }

    // Smooth numerical spring interpolation
    const startVal = displayValue;
    const targetVal = value;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Apple-tier easeOutExpo curve
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = startVal + (targetVal - startVal) * ease;
      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetVal);
        prevValueRef.current = targetVal;
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [value, duration, flashOnChange]);

  const formatted = formatIndian
    ? displayValue.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })
    : displayValue.toFixed(decimals);

  const flashClass = flashDirection === 'up' ? 'flash-up-text' : flashDirection === 'down' ? 'flash-down-text' : '';

  return (
    <span className={`inline-block tabular-nums font-mono transition-colors duration-500 ${flashClass} ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  );
}

export default React.memo(AnimatedNumber);
