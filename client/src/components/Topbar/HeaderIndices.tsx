import React from 'react';
import type { StockData } from '../../types';
import { useDashboard } from '../../contexts/DashboardContext';
import { audioAlerts } from '../../utils/audioAlerts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { LivePrice } from '../common/LivePrice';
import { TelemetryPulse } from '../common/TelemetryPulse';

interface HeaderIndicesProps {
  nifty50?: StockData;
  bankNifty?: StockData;
  sensex?: StockData;
  flashes?: { nifty?: 'up' | 'down'; bank?: 'up' | 'down'; sensex?: 'up' | 'down' };
}

export function HeaderIndices({ nifty50, bankNifty, sensex, flashes }: HeaderIndicesProps) {
  const { setChartSymbol, setActiveTab } = useDashboard();

  const niftyUp = (nifty50?.change ?? 0) >= 0;
  const bankUp = (bankNifty?.change ?? 0) >= 0;
  const sensexUp = (sensex?.change ?? 0) >= 0;

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
        title={`NIFTY 50: ₹${nifty50?.price?.toFixed(2) || '---'} (${niftyUp ? '+' : ''}${nifty50?.change?.toFixed(2) || 0} pts) | High ₹${nifty50?.dayHigh?.toFixed(2) || '---'} | Low ₹${nifty50?.dayLow?.toFixed(2) || '---'}`}
      >
        <div className="index-chip-head">
          <span className="index-chip-icon">
            <Activity size={11} className={niftyUp ? 'text-up' : 'text-down'} />
          </span>
          <span className="index-chip-name">NIFTY 50</span>
          <span className="index-chip-market-tag">
            <TelemetryPulse variant="live" size={4} /> NSE
          </span>
        </div>

        <div className="index-chip-body">
          <span className="index-chip-price font-mono tabular-nums">
            {nifty50 ? <LivePrice price={nifty50.price} decimals={2} /> : '---'}
          </span>
          
          <span className={`index-chip-badge font-mono tabular-nums ${niftyUp ? 'up' : 'down'}`}>
            {niftyUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            <span className="index-chip-pts">
              {nifty50 ? `${niftyUp ? '+' : ''}${(nifty50.change ?? 0).toFixed(2)}` : '0.00'}
            </span>
            <span className="index-chip-pct">
              ({nifty50 ? `${niftyUp ? '+' : ''}${(nifty50.changePercent ?? 0).toFixed(2)}%` : '0.00%'})
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
        title={`BANK NIFTY: ₹${bankNifty?.price?.toFixed(2) || '---'} (${bankUp ? '+' : ''}${bankNifty?.change?.toFixed(2) || 0} pts) | High ₹${bankNifty?.dayHigh?.toFixed(2) || '---'} | Low ₹${bankNifty?.dayLow?.toFixed(2) || '---'}`}
      >
        <div className="index-chip-head">
          <span className="index-chip-icon">
            <Activity size={11} className={bankUp ? 'text-up' : 'text-down'} />
          </span>
          <span className="index-chip-name">BANK NIFTY</span>
          <span className="index-chip-market-tag">
            <TelemetryPulse variant="cyan" size={4} /> FNO
          </span>
        </div>

        <div className="index-chip-body">
          <span className="index-chip-price font-mono tabular-nums">
            {bankNifty ? <LivePrice price={bankNifty.price} decimals={2} /> : '---'}
          </span>
          
          <span className={`index-chip-badge font-mono tabular-nums ${bankUp ? 'up' : 'down'}`}>
            {bankUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            <span className="index-chip-pts">
              {bankNifty ? `${bankUp ? '+' : ''}${(bankNifty.change ?? 0).toFixed(2)}` : '0.00'}
            </span>
            <span className="index-chip-pct">
              ({bankNifty ? `${bankUp ? '+' : ''}${(bankNifty.changePercent ?? 0).toFixed(2)}%` : '0.00%'})
            </span>
          </span>
        </div>
      </div>

      {/* ── SENSEX INDEX CHIP ── */}
      <div
        className={`header-index-chip ${sensexUp ? 'is-up' : 'is-down'} ${flashes?.sensex ? `flash-${flashes.sensex}` : ''}`}
        onClick={() => {
          audioAlerts.playClickHaptic();
          setChartSymbol('SENSEX');
          setActiveTab('Charts');
        }}
        title={`SENSEX: ₹${sensex?.price?.toFixed(2) || '---'} (${sensexUp ? '+' : ''}${sensex?.change?.toFixed(2) || 0} pts) | High ₹${sensex?.dayHigh?.toFixed(2) || '---'} | Low ₹${sensex?.dayLow?.toFixed(2) || '---'}`}
      >
        <div className="index-chip-head">
          <span className="index-chip-icon">
            <Activity size={11} className={sensexUp ? 'text-up' : 'text-down'} />
          </span>
          <span className="index-chip-name">SENSEX</span>
          <span className="index-chip-market-tag">
            <TelemetryPulse variant="live" size={4} /> BSE
          </span>
        </div>

        <div className="index-chip-body">
          <span className="index-chip-price font-mono tabular-nums">
            {sensex ? <LivePrice price={sensex.price} decimals={2} /> : '---'}
          </span>
          
          <span className={`index-chip-badge font-mono tabular-nums ${sensexUp ? 'up' : 'down'}`}>
            {sensexUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            <span className="index-chip-pts">
              {sensex ? `${sensexUp ? '+' : ''}${(sensex.change ?? 0).toFixed(2)}` : '0.00'}
            </span>
            <span className="index-chip-pct">
              ({sensex ? `${sensexUp ? '+' : ''}${(sensex.changePercent ?? 0).toFixed(2)}%` : '0.00%'})
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
