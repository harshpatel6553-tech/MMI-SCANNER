import React, { useState, useEffect } from 'react';

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
  TATASTEEL: 'TATASTEEL',
  TATAPOWER: 'TATAPOWER',
  'M&M': 'MM',
  'L&TFH': 'LTFH',
  'BAJAJ-AUTO': 'BAJAJ_AUTO',
  'MCDOWELL-N': 'MCDOWELL_N',
  PAYTM: 'ONE97',
  'L&T': 'LT',
  BHARTI: 'BHARTIARTL',
  HDFC: 'HDFCBANK',
  MARUTI: 'MARUTI',
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
  const [hasError, setHasError] = useState(false);

  const clean = (symbol || '')
    .replace('.NS', '')
    .replace('.BO', '')
    .replace('-EQ', '')
    .replace('^', '')
    .trim()
    .toUpperCase();

  const mappedTicker = TICKER_ALIASES[clean] || clean;

  useEffect(() => {
    setHasError(false);
  }, [clean]);

  // Custom brand badge for ZOMATO
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
          boxShadow: '0 2px 5px rgba(226, 55, 68, 0.35)',
          border: '1px solid rgba(255,255,255,0.2)',
          userSelect: 'none',
          ...style,
        }}
        title="Zomato"
      >
        Z
      </div>
    );
  }

  if (clean.includes('REDBOX') || clean === '@REDBOXINDIA' || clean === 'REDBOXINDIA') {
    return (
      <div
        className={`stock-logo-circle stock-logo-redbox ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #881337 0%, #e11d48 100%)',
          border: '1.5px solid rgba(244, 63, 94, 0.45)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 900,
          fontFamily: "'Space Grotesk', monospace, sans-serif",
          fontSize: Math.max(9, Math.floor(size * 0.44)),
          letterSpacing: '-0.02em',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(225, 29, 72, 0.35)',
          userSelect: 'none',
          ...style,
        }}
        title="@RedboxIndia Verified News"
      >
        RB
      </div>
    );
  }

  if (clean.includes('YATIN') || clean === '@YATINMOTA' || clean === 'YATINMOTA') {
    return (
      <div
        className={`stock-logo-circle stock-logo-yatin ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)',
          border: '1.5px solid rgba(56, 189, 248, 0.45)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 900,
          fontFamily: "'Space Grotesk', monospace, sans-serif",
          fontSize: Math.max(9, Math.floor(size * 0.44)),
          letterSpacing: '-0.02em',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)',
          userSelect: 'none',
          ...style,
        }}
        title="@yatinmota Verified News"
      >
        YM
      </div>
    );
  }

  // Institutional Index Emblems
  if (clean === 'NIFTY' || clean === 'NIFTY50' || clean === 'NIFTY 50' || clean === '50') {
    return (
      <div
        className={`stock-logo-circle stock-logo-nifty ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #07192f 0%, #0c3359 100%)',
          border: '1.5px solid rgba(0, 214, 163, 0.45)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#00D6A3',
          fontWeight: 900,
          fontFamily: "'Space Grotesk', monospace, sans-serif",
          fontSize: Math.max(9, Math.floor(size * 0.44)),
          letterSpacing: '-0.02em',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(0, 214, 163, 0.3)',
          userSelect: 'none',
          ...style,
        }}
        title="NIFTY 50 Index"
      >
        N50
      </div>
    );
  }

  if (clean === 'BANKNIFTY' || clean === 'BANK NIFTY' || clean === 'NIFTY BANK') {
    return (
      <div
        className={`stock-logo-circle stock-logo-banknifty ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #091d3e 0%, #1d4ed8 100%)',
          border: '1.5px solid rgba(56, 189, 248, 0.45)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#38BDF8',
          fontWeight: 900,
          fontFamily: "'Space Grotesk', monospace, sans-serif",
          fontSize: Math.max(9, Math.floor(size * 0.44)),
          letterSpacing: '-0.02em',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(56, 189, 248, 0.3)',
          userSelect: 'none',
          ...style,
        }}
        title="Bank NIFTY Index"
      >
        BN
      </div>
    );
  }

  if (clean === 'SENSEX' || clean === 'BSE SENSEX' || clean === 'BSESENSEX') {
    return (
      <div
        className={`stock-logo-circle stock-logo-sensex ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2b1704 0%, #b45309 100%)',
          border: '1.5px solid rgba(245, 158, 11, 0.45)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FBBF24',
          fontWeight: 900,
          fontFamily: "'Space Grotesk', monospace, sans-serif",
          fontSize: Math.max(8, Math.floor(size * 0.38)),
          letterSpacing: '-0.02em',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)',
          userSelect: 'none',
          ...style,
        }}
        title="BSE Sensex"
      >
        BSX
      </div>
    );
  }

  if (clean === 'FINNIFTY' || clean === 'FIN NIFTY' || clean === 'NIFTY FIN SERVICE') {
    return (
      <div
        className={`stock-logo-circle stock-logo-finnifty ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1b0e36 0%, #6d28d9 100%)',
          border: '1.5px solid rgba(168, 85, 247, 0.45)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#C084FC',
          fontWeight: 900,
          fontFamily: "'Space Grotesk', monospace, sans-serif",
          fontSize: Math.max(8, Math.floor(size * 0.38)),
          letterSpacing: '-0.02em',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(168, 85, 247, 0.3)',
          userSelect: 'none',
          ...style,
        }}
        title="Nifty Financial Services"
      >
        FIN
      </div>
    );
  }

  if (clean === 'MIDCPNIFTY' || clean === 'MIDCAP') {
    return (
      <div
        className={`stock-logo-circle stock-logo-midcap ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2b0e1e 0%, #be185d 100%)',
          border: '1.5px solid rgba(244, 63, 94, 0.45)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FB7185',
          fontWeight: 900,
          fontFamily: "'Space Grotesk', monospace, sans-serif",
          fontSize: Math.max(8, Math.floor(size * 0.38)),
          letterSpacing: '-0.02em',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(244, 63, 94, 0.3)',
          userSelect: 'none',
          ...style,
        }}
        title="Nifty Midcap Select"
      >
        MID
      </div>
    );
  }

  if (clean.includes('VIX')) {
    return (
      <div
        className={`stock-logo-circle stock-logo-vix ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2c1809 0%, #ea580c 100%)',
          border: '1.5px solid rgba(249, 115, 22, 0.45)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FB923C',
          fontWeight: 900,
          fontFamily: "'Space Grotesk', monospace, sans-serif",
          fontSize: Math.max(8, Math.floor(size * 0.38)),
          letterSpacing: '-0.02em',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(249, 115, 22, 0.3)',
          userSelect: 'none',
          ...style,
        }}
        title="India VIX"
      >
        VIX
      </div>
    );
  }

  // Fallback monogram if image fails or clean symbol is empty
  if (hasError || !clean) {
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
          fontWeight: 800,
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          fontSize: Math.max(9, Math.floor(size * (initials.length > 2 ? 0.38 : 0.48))),
          letterSpacing: '-0.02em',
          flexShrink: 0,
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.15)',
          userSelect: 'none',
          ...style,
        }}
        title={name || symbol}
      >
        {initials}
      </div>
    );
  }

  // Official corporate vector logo
  const logoUrl = `https://api.dharun.dev/v1/logos/${mappedTicker}`;

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
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.18)',
        position: 'relative',
        padding: Math.max(1, Math.floor(size * 0.08)),
        userSelect: 'none',
        ...style,
      }}
      title={name || symbol}
    >
      <img
        src={logoUrl}
        alt={symbol}
        loading="lazy"
        onError={() => setHasError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </div>
  );
}
