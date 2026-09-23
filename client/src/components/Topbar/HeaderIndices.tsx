import React from 'react';
import type { StockData } from '../../types';
import { useDashboard } from '../../contexts/DashboardContext';
import { audioAlerts } from '../../utils/audioAlerts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface HeaderIndicesProps {
  nifty50?: StockData;
  bankNifty?: StockData;
}

export function HeaderIndices({ nifty50, bankNifty }: HeaderIndicesProps) {
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
        className={`header-index-chip ${niftyUp ? 'is-up' : 'is-down'}`}
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
          <span className="index-chip-market-tag">NSE</span>
        </div>

        <div className="index-chip-body">
          <span className="index-chip-price num tabular-nums">
            {formatIndexPrice(nifty50?.price || 23449.25)}
          </span>
          
          <span className={`index-chip-badge num tabular-nums ${niftyUp ? 'up' : 'down'}`}>
            {niftyUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span>
              {niftyUp ? '+' : ''}
              {nifty50 ? nifty50.change.toFixed(2) : '+34.95'}
            </span>
            <span className="index-chip-pct">
              ({niftyUp ? '+' : ''}
              {nifty50 ? nifty50.changePercent.toFixed(2) : '0.15'}%)
            </span>
          </span>
        </div>
      </div>

      {/* ── BANK NIFTY INDEX CHIP ── */}
      <div
        className={`header-index-chip ${bankUp ? 'is-up' : 'is-down'}`}
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
          <span className="index-chip-market-tag">FNO</span>
        </div>

        <div className="index-chip-body">
          <span className="index-chip-price num tabular-nums">
            {formatIndexPrice(bankNifty?.price || 56575.70)}
          </span>
          
          <span className={`index-chip-badge num tabular-nums ${bankUp ? 'up' : 'down'}`}>
            {bankUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span>
              {bankUp ? '+' : ''}
              {bankNifty ? bankNifty.change.toFixed(2) : '+105.10'}
            </span>
            <span className="index-chip-pct">
              ({bankUp ? '+' : ''}
              {bankNifty ? bankNifty.changePercent.toFixed(2) : '0.19'}%)
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
