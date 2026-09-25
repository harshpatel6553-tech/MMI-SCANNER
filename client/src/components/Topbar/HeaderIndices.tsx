import React from 'react';
import type { StockData } from '../../types';
import { useDashboard } from '../../contexts/DashboardContext';
import { audioAlerts } from '../../utils/audioAlerts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface HeaderIndicesProps {
  nifty50?: StockData;
  bankNifty?: StockData;
  flashes?: { nifty?: 'up' | 'down'; bank?: 'up' | 'down' };
}

export function HeaderIndices({ nifty50, bankNifty, flashes }: HeaderIndicesProps) {
  const { setChartSymbol, setActiveTab } = useDashboard();

  // Format helper for Indian Rupee numbers (e.g. 23,449.25)
  const formatIndexPrice = (val?: number) => {
    if (val === undefined || isNaN(val)) return '---';
    return val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const niftyUp = (nifty50?.change ?? 0) >= 0;
  const bankUp = (bankNifty?.change ?? 0) >= 0;

  return (
    <div className="header-indices-wrapper">
      {/* ── NIFTY 50 INDEX CHIP ── */}
      <div
        className={`header-index-chip ${niftyUp ? 'is-up' : 'is-down'} ${flashes?.nifty ? `flash-${flashes.nifty}` : ''}`}
        onClick={() => {
          audioAlerts.playClickHaptic();
          setChartSymbol('NIFTY 50');
          setActiveTab('Charts');
        }}
        title={`NIFTY 50: High ₹${nifty50?.dayHigh?.toFixed(2) || '---'} | Low ₹${nifty50?.dayLow?.toFixed(2) || '---'} · Click to view Chart`}
      >
        <div className="index-chip-head">
          <span className="index-chip-icon">
            <Activity size={12} className={niftyUp ? 'text-up' : 'text-down'} />
          </span>
          <span className="index-chip-name">NIFTY 50</span>
          <span className="index-chip-market-tag">
            <span className="live-pulse-dot" /> NSE
          </span>
        </div>

        <div className="index-chip-body">
          <span className={`index-chip-price num tabular-nums ${flashes?.nifty ? `price-${flashes.nifty}` : ''}`}>
            {nifty50 ? formatIndexPrice(nifty50.price) : '---'}
          </span>
          
          <span className={`index-chip-badge num tabular-nums ${niftyUp ? 'up' : 'down'}`}>
            {niftyUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span>
              {nifty50 ? `${niftyUp ? '+' : ''}${nifty50.change.toFixed(2)}` : '0.00'}
            </span>
            <span className="index-chip-pct">
              ({nifty50 ? `${niftyUp ? '+' : ''}${nifty50.changePercent.toFixed(2)}` : '0.00'}%)
            </span>
          </span>
        </div>
      </div>

      {/* ── BANK NIFTY INDEX CHIP ── */}
      <div
        className={`header-index-chip ${bankUp ? 'is-up' : 'is-down'} ${flashes?.bank ? `flash-${flashes.bank}` : ''}`}
        onClick={() => {
          audioAlerts.playClickHaptic();
          setChartSymbol('BANKNIFTY');
          setActiveTab('Charts');
        }}
        title={`BANK NIFTY: High ₹${bankNifty?.dayHigh?.toFixed(2) || '---'} | Low ₹${bankNifty?.dayLow?.toFixed(2) || '---'} · Click to view Chart`}
      >
        <div className="index-chip-head">
          <span className="index-chip-icon">
            <Activity size={12} className={bankUp ? 'text-up' : 'text-down'} />
          </span>
          <span className="index-chip-name">BANK NIFTY</span>
          <span className="index-chip-market-tag">
            <span className="live-pulse-dot" /> FNO
          </span>
        </div>

        <div className="index-chip-body">
          <span className={`index-chip-price num tabular-nums ${flashes?.bank ? `price-${flashes.bank}` : ''}`}>
            {bankNifty ? formatIndexPrice(bankNifty.price) : '---'}
          </span>
          
          <span className={`index-chip-badge num tabular-nums ${bankUp ? 'up' : 'down'}`}>
            {bankUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span>
              {bankNifty ? `${bankUp ? '+' : ''}${bankNifty.change.toFixed(2)}` : '0.00'}
            </span>
            <span className="index-chip-pct">
              ({bankNifty ? `${bankUp ? '+' : ''}${bankNifty.changePercent.toFixed(2)}` : '0.00'}%)
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
