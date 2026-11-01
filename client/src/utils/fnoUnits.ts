/**
 * F&O Institutional Units & Lot Size Utilities
 * Calibrates Contracts (Lots) vs Underlying Quantity (Shares) across NSE / BSE derivatives.
 */

export const LOT_SIZES: Record<string, number> = {
  NIFTY: 25,
  BANKNIFTY: 15,
  FINNIFTY: 25,
  MIDCPNIFTY: 50,
  SENSEX: 10,
  BANKEX: 15,
};

export function getLotSize(symbol: string = 'NIFTY'): number {
  const clean = symbol.toUpperCase().replace(/\s+/g, '');
  if (clean.includes('BANKNIFTY')) return LOT_SIZES.BANKNIFTY;
  if (clean.includes('FINNIFTY')) return LOT_SIZES.FINNIFTY;
  if (clean.includes('MIDCP')) return LOT_SIZES.MIDCPNIFTY;
  if (clean.includes('SENSEX')) return LOT_SIZES.SENSEX;
  if (clean.includes('BANKEX')) return LOT_SIZES.BANKEX;
  return LOT_SIZES.NIFTY;
}

/**
 * Format Open Interest / Volume in number of contracts (lots)
 * Institutional standards:
 * - < 1,000: exact number (e.g. 850)
 * - 1,000 - 99,999: "51.8K" (never "0.5L"!)
 * - >= 100,000: "1.97L" (or "197.0K" when specified)
 */
export function formatContracts(num: number, withUnit = true, preferK = false): string {
  const abs = Math.abs(num);
  let valStr: string;

  if (abs >= 100000 && !preferK) {
    valStr = `${(num / 100000).toFixed(2)}L`;
  } else if (abs >= 1000) {
    valStr = `${(num / 1000).toFixed(1)}K`;
  } else {
    valStr = num.toLocaleString('en-IN');
  }

  return withUnit ? `${valStr} contracts` : valStr;
}

/**
 * Format Open Interest in underlying shares (quantity)
 * Calculated as: contracts * lotSize
 */
export function formatShares(contracts: number, symbol: string = 'NIFTY', withUnit = true): string {
  const lot = getLotSize(symbol);
  const shares = contracts * lot;
  const abs = Math.abs(shares);
  let valStr: string;

  if (abs >= 10000000) {
    valStr = `${(shares / 10000000).toFixed(2)} Cr`;
  } else if (abs >= 100000) {
    valStr = `${(shares / 100000).toFixed(2)}L`;
  } else if (abs >= 1000) {
    valStr = `${(shares / 1000).toFixed(1)}K`;
  } else {
    valStr = shares.toLocaleString('en-IN');
  }

  return withUnit ? `${valStr} shares` : valStr;
}

/**
 * Institutional Dual OI Formatter
 * Returns both Contracts and Shares clearly separated
 */
export function formatDualOI(contracts: number, symbol: string = 'NIFTY') {
  const contractsStr = formatContracts(contracts, false);
  const sharesStr = formatShares(contracts, symbol, true);
  return {
    contracts: contractsStr,
    shares: sharesStr,
    summary: `${contractsStr} contracts (${sharesStr})`,
    contractsWithUnit: `${contractsStr} contracts`,
  };
}

/**
 * Format OI Change with directional sign, contracts, shares and optional %
 */
export function formatDualOIChange(
  changeContracts: number, 
  symbol: string = 'NIFTY',
  pctChange?: number
) {
  const sign = changeContracts > 0 ? '+' : changeContracts < 0 ? '-' : '';
  const contractsStr = formatContracts(Math.abs(changeContracts), false);
  const sharesStr = formatShares(Math.abs(changeContracts), symbol, true);
  const pctStr = pctChange !== undefined ? ` (${changeContracts >= 0 ? '+' : ''}${pctChange.toFixed(1)}%)` : '';

  return {
    sign,
    contracts: `${sign}${contractsStr} contracts`,
    shares: `${sign}${sharesStr}`,
    summary: `${sign}${contractsStr} contracts (${sharesStr})${pctStr}`,
    compact: `${sign}${contractsStr}${pctStr}`,
  };
}
