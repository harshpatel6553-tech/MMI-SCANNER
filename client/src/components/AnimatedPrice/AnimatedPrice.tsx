import React, { useRef, useEffect, useState } from 'react';
import './AnimatedPrice.css';

interface AnimatedPriceProps {
  value: number;
  className?: string;
}

function formatToChars(value: number): string {
  return '₹' + value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface CharState {
  char: string;
  key: string;
  isSeparator: boolean;
  animClass: string;
}

export const AnimatedPrice = React.memo(function AnimatedPrice({ value, className }: AnimatedPriceProps) {
  const prevValueRef = useRef<number>(value);
  const [chars, setChars] = useState<CharState[]>(() => {
    const formatted = formatToChars(value);
    return formatted.split('').map((ch, i) => ({
      char: ch,
      key: `${i}-${ch}`,
      isSeparator: !/\d/.test(ch),
      animClass: '',
    }));
  });
  const animTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const prevValue = prevValueRef.current;
    if (prevValue === value) return;

    const direction = value > prevValue ? 'up' : 'down';
    const prevFormatted = formatToChars(prevValue);
    const newFormatted = formatToChars(value);
    prevValueRef.current = value;

    const newChars = newFormatted.split('');
    const prevChars = prevFormatted.split('');

    // Clear any pending timers
    animTimerRef.current.forEach(t => clearTimeout(t));
    animTimerRef.current = [];

    // Build new char states with animation
    const digitIndices: number[] = [];
    const states: CharState[] = newChars.map((ch, i) => {
      const isSep = !/\d/.test(ch);
      const changed = ch !== prevChars[i];
      if (!isSep) digitIndices.push(i);
      return {
        char: ch,
        key: `${i}-${ch}-${Date.now()}`,
        isSeparator: isSep,
        animClass: !isSep && changed
          ? (direction === 'up' ? 'slide-up' : 'slide-down')
          : '',
      };
    });

    // Stagger: rightmost changing digit animates first
    const changingDigitPositions = digitIndices.filter(i => newChars[i] !== prevChars[i]);
    changingDigitPositions.reverse(); // rightmost first
    changingDigitPositions.forEach((idx, order) => {
      const s = states[idx];
      s.animClass = ''; // start without anim class
      const timer = setTimeout(() => {
        setChars(prev => {
          const updated = [...prev];
          if (updated[idx]) {
            updated[idx] = {
              ...updated[idx],
              animClass: direction === 'up' ? 'slide-up' : 'slide-down',
            };
          }
          return updated;
        });
      }, order * 40);
      animTimerRef.current.push(timer);
    });

    setChars(states);

    // Clean up animation classes after animation completes
    const clearTimer = setTimeout(() => {
      setChars(prev => prev.map(c => ({ ...c, animClass: '' })));
    }, changingDigitPositions.length * 40 + 450);
    animTimerRef.current.push(clearTimer);

    return () => {
      animTimerRef.current.forEach(t => clearTimeout(t));
    };
  }, [value]);

  return (
    <span className={`animated-price ${className || ''}`}>
      {chars.map((c, i) => (
        <span
          key={`${i}-${c.isSeparator ? 'sep' : 'dig'}`}
          className={`digit-container ${c.isSeparator ? 'separator' : ''}`}
        >
          <span className={`digit ${c.animClass}`}>{c.char}</span>
        </span>
      ))}
    </span>
  );
});
