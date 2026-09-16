import React, { useState } from 'react';

interface StockLogoProps {
  symbol: string;
  name?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// Special alias mapping for symbols whose file names differ in the logo CDN
const TICKER_ALIASES: Record<string, string> = {
  TATAMOTORS: 'TMPV',
  'TATA-MOTORS': 'TMPV',
  'M&M': 'MM',
  'L&TFH': 'L_TFH',
  'BAJAJ-AUTO': 'BAJAJ_AUTO',
  'MCDOWELL-N': 'MCDOWELL_N',
  NIFTY: 'NIFTY50',
  'NIFTY 50': 'NIFTY50',
  NIFTY50: 'NIFTY50',
  BANKNIFTY: 'BANKNIFTY',
};

// Deterministic color palette for initial/monogram badges (TradingView style)
const MONOGRAM_PALETTE = [
  { bg: '#1e3a8a', text: '#ffffff' }, // deep blue
  { bg: '#065f46', text: '#ffffff' }, // emerald
  { bg: '#4c1d95', text: '#ffffff' }, // deep purple
  { bg: '#831843', text: '#ffffff' }, // deep rose
  { bg: '#164e63', text: '#ffffff' }, // cyan/teal
  { bg: '#7c2d12', text: '#ffffff' }, // burnt orange
  { bg: '#312e81', text: '#ffffff' }, // indigo
  { bg: '#3b0764', text: '#ffffff' }, // violet
  { bg: '#14532d', text: '#ffffff' }, // forest green
  { bg: '#713f12', text: '#ffffff' }, // amber
  { bg: '#1f2937', text: '#ffffff' }, // charcoal
  { bg: '#0284c7', text: '#ffffff' }, // sky
];

function getMonogramColors(sym: string) {
  let hash = 0;
  for (let i = 0; i < sym.length; i++) {
    hash = (hash << 5) - hash + sym.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % MONOGRAM_PALETTE.length;
  return MONOGRAM_PALETTE[idx];
}

export function StockLogo({ symbol, name, size = 24, className = '', style = {} }: StockLogoProps) {
  const [loadStage, setLoadStage] = useState<'nse' | 'bse' | 'fallback'>('nse');

  const clean = (symbol || '').replace('.NS', '').replace('.BO', '').replace('-EQ', '').trim().toUpperCase();
  const mappedTicker = TICKER_ALIASES[clean] || clean;

  // Custom brand badges matching user image exactly
  if (clean === 'ZOMATO') {
    return (
      <div
        className={`stock-logo-circle ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          backgroundColor: '#E23744',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 900,
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          fontStyle: 'italic',
          fontSize: Math.max(10, Math.floor(size * 0.58)),
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.12)',
          userSelect: 'none',
          ...style,
        }}
        title="Zomato"
      >
        Z
      </div>
    );
  }

  if (clean === 'NIFTY50' || clean === 'NIFTY 50' || clean === '50') {
    return (
      <div
        className={`stock-logo-circle ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          backgroundColor: '#1c2237',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 800,
          fontFamily: "'Space Grotesk', monospace, sans-serif",
          fontSize: Math.max(9, Math.floor(size * 0.48)),
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.14)',
          userSelect: 'none',
          ...style,
        }}
        title="Nifty 50"
      >
        50
      </div>
    );
  }

  const handleError = () => {
    if (loadStage === 'nse') {
      setLoadStage('bse');
    } else {
      setLoadStage('fallback');
    }
  };

  const getImgSrc = () => {
    if (loadStage === 'nse') {
      return `https://dharunashokkumar.github.io/indian-listed-company-logos/nse/NSE_${mappedTicker}.svg`;
    }
    if (loadStage === 'bse') {
      return `https://dharunashokkumar.github.io/indian-listed-company-logos/bse/BSE_${mappedTicker}.svg`;
    }
    return '';
  };

  if (loadStage === 'fallback' || !clean) {
    const { bg, text } = getMonogramColors(clean);
    const initials = clean.length <= 3 ? clean : clean.slice(0, 2);
    return (
      <div
        className={`stock-logo-circle stock-logo-fallback ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          backgroundColor: bg,
          color: text,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          fontSize: Math.max(9, Math.floor(size * (initials.length > 2 ? 0.38 : 0.48))),
          letterSpacing: '-0.02em',
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.1)',
          userSelect: 'none',
          ...style,
        }}
        title={name || symbol}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`stock-logo-circle ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: '50%',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.12)',
        position: 'relative',
        ...style,
      }}
      title={name || symbol}
    >
      <img
        src={getImgSrc()}
        alt={symbol}
        loading="lazy"
        onError={handleError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </div>
  );
}
