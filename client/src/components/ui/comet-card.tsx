import React from 'react';
import './comet-card.css';

interface CometCardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * CometCard: High-performance cyber-glass container card.
 * Zero-jitter, 120 FPS pure CSS hardware-accelerated interactions.
 */
export function CometCard({ children, className = '' }: CometCardProps) {
  return (
    <div className={`comet-card-wrapper ${className}`}>
      <div className="comet-card-content">
        {children}
      </div>
    </div>
  );
}
