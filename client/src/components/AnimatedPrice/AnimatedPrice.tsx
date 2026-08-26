import React from 'react';
import './AnimatedPrice.css';

interface AnimatedPriceProps {
  value: number;
  className?: string;
}

function formatToChars(value: number): string {
  return '\u20B9' + value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const AnimatedPrice = React.memo(function AnimatedPrice({ value, className }: AnimatedPriceProps) {
  return (
    <span className={`animated-price ${className || ''}`}>
      {formatToChars(value)}
    </span>
  );
});
