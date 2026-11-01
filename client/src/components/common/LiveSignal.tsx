import React from 'react';
import { Zap, Activity, Flame, ShieldAlert, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export interface LiveSignalProps {
  label: string;
  type?: 'breakout' | 'breakdown' | 'spike' | 'rsi' | 'macd' | 'neutral';
  compact?: boolean;
  className?: string;
}

export function LiveSignal({
  label,
  type = 'breakout',
  compact = false,
  className = ''
}: LiveSignalProps) {
  const configs = {
    breakout: {
      color: 'text-[var(--up)]',
      border: 'border-[rgba(0,214,163,0.35)]',
      bg: 'bg-[rgba(0,214,163,0.12)]',
      glow: 'shadow-[0_0_12px_rgba(0,214,163,0.2)]',
      icon: <ArrowUpRight size={11} strokeWidth={2.5} />
    },
    breakdown: {
      color: 'text-[var(--down)]',
      border: 'border-[rgba(255,66,104,0.35)]',
      bg: 'bg-[rgba(255,66,104,0.12)]',
      glow: 'shadow-[0_0_12px_rgba(255,66,104,0.2)]',
      icon: <ArrowDownRight size={11} strokeWidth={2.5} />
    },
    spike: {
      color: 'text-[var(--gold)]',
      border: 'border-[rgba(212,175,55,0.35)]',
      bg: 'bg-[rgba(212,175,55,0.12)]',
      glow: 'shadow-[0_0_12px_rgba(212,175,55,0.2)]',
      icon: <Flame size={11} strokeWidth={2} />
    },
    rsi: {
      color: 'text-[var(--cyan)]',
      border: 'border-[rgba(40,207,255,0.35)]',
      bg: 'bg-[rgba(40,207,255,0.12)]',
      glow: 'shadow-[0_0_12px_rgba(40,207,255,0.2)]',
      icon: <Activity size={11} strokeWidth={2} />
    },
    macd: {
      color: 'text-[var(--purple)]',
      border: 'border-[rgba(129,140,248,0.35)]',
      bg: 'bg-[rgba(129,140,248,0.12)]',
      glow: 'shadow-[0_0_12px_rgba(129,140,248,0.2)]',
      icon: <Zap size={11} strokeWidth={2} />
    },
    neutral: {
      color: 'text-[var(--text-2)]',
      border: 'border-[var(--border)]',
      bg: 'bg-[rgba(255,255,255,0.04)]',
      glow: 'shadow-none',
      icon: <ShieldAlert size={11} strokeWidth={2} />
    }
  };

  const c = configs[type] || configs.breakout;

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono uppercase font-bold tracking-wider rounded-full transition-all duration-300 ${
        compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'
      } ${c.color} ${c.border} ${c.bg} ${c.glow} border ${className}`}
    >
      <span className="shrink-0">{c.icon}</span>
      <span>{label}</span>
    </span>
  );
}

export default React.memo(LiveSignal);
