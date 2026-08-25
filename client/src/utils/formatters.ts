export function formatPrice(price: number): string {
  return '\u20B9' + price.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatVolume(vol: number): string {
  if (vol >= 10000000) {
    return (vol / 10000000).toFixed(1) + 'Cr';
  } else if (vol >= 100000) {
    return (vol / 100000).toFixed(1) + 'L';
  } else if (vol >= 1000) {
    return (vol / 1000).toFixed(1) + 'K';
  }
  return vol.toString();
}

export function formatPercent(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return sign + pct.toFixed(2) + '%';
}

export function formatTime(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }) + ' IST';
  } catch {
    return '--:--:--';
  }
}

export function getChangeClass(change: number): string {
  if (change > 0) return 'positive';
  if (change < 0) return 'negative';
  return '';
}

export function formatMarketCap(cap: number): string {
  if (cap >= 1e12) {
    return '\u20B9' + (cap / 1e12).toFixed(1) + 'LCr';
  } else if (cap >= 1e7) {
    return '\u20B9' + (cap / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 0 }) + 'Cr';
  } else if (cap >= 1e5) {
    return '\u20B9' + Math.round(cap / 1e7) + 'Cr';
  }
  return '\u20B9' + cap.toLocaleString('en-IN');
}
