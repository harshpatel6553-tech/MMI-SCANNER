import React from 'react';

export interface TelemetryPulseProps {
  color?: 'live' | 'cyan' | 'alert' | 'gold';
  variant?: 'live' | 'cyan' | 'alert' | 'gold';
  size?: number;
  label?: string;
  className?: string;
}

export function TelemetryPulse({
  color,
  variant,
  size = 7,
  label,
  className = ''
}: TelemetryPulseProps) {
  const activeColor = variant || color || 'live';
  const colorMap = {
    live: {
      bg: 'bg-[var(--up)]',
      ping: 'bg-[var(--up)]',
      shadow: 'shadow-[0_0_8px_var(--up)]'
    },
    cyan: {
      bg: 'bg-[var(--cyan)]',
      ping: 'bg-[var(--cyan)]',
      shadow: 'shadow-[0_0_8px_var(--cyan)]'
    },
    alert: {
      bg: 'bg-[var(--down)]',
      ping: 'bg-[var(--down)]',
      shadow: 'shadow-[0_0_8px_var(--down)]'
    },
    gold: {
      bg: 'bg-[var(--gold)]',
      ping: 'bg-[var(--gold)]',
      shadow: 'shadow-[0_0_8px_var(--gold)]'
    }
  };

  const { bg, ping, shadow } = colorMap[activeColor] || colorMap.live;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative flex" style={{ width: size, height: size }}>
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ping}`}
        />
        <span
          className={`relative inline-flex rounded-full h-full w-full ${bg} ${shadow}`}
        />
      </span>
      {label && (
        <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-[var(--text-2)]">
          {label}
        </span>
      )}
    </span>
  );
}

export default React.memo(TelemetryPulse);
