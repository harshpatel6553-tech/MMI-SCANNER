import React from 'react';
import './comet-card.css';

interface CometCardProps {
  children: React.ReactNode;
  className?: string;
}

export function CometCard({ children, className = '' }: CometCardProps) {
  return (
    <div className={"comet-card-wrapper " + className}>
      <div className="comet-card-content">
        {children}
      </div>
    </div>
  );
}
