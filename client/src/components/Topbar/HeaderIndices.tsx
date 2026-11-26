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

function formatIndexDelta(item?: StockData) {
  if (!item) return { pts: '0.00', pct: '(0.00%)', isUp: true };
  const chg = item.change ?? 0;
  const chgPct = item.changePercent ?? 0;
  const isUp = chgPct !== 0 ? chgPct >= 0 : chg >= 0;
  const ptsSign = chg > 0 ? '+' : chg < 0 ? '-' : '';
  const pctSign = chgPct > 0 ? '+' : chgPct < 0 ? '-' : '';
  return {
    pts: `${ptsSign}${Math.abs(chg).toFixed(2)}`,
    pct: `(${pctSign}${Math.abs(chgPct).toFixed(2)}%)`,
    isUp
  };
}

export function HeaderIndices({ nifty50, bankNifty, sensex, flashes }: HeaderIndicesProps) {
  const { setChartSymbol, setActiveTab } = useDashboard();

  const niftyDelta = formatIndexDelta(nifty50);
  const bankDelta = formatIndexDelta(bankNifty);
  const sensexDelta = formatIndexDelta(sensex);

  return (
    <div className="header-indices-wrapper">
      {/* ── NIFTY 50 INDEX CHIP ── */}
      <div
        className={`header-index-chip ${niftyDelta.isUp ? 'is-up' : 'is-down'} ${flashes?.nifty ? `flash-${flashes.nifty}` : ''}`}
        onClick={() => {
          audioAlerts.playClickHaptic();
          setChartSymbol('NIFTY 50');
          setActiveTab('Charts');
        }}
        title={`NIFTY 50: ₹${nifty50?.price?.toFixed(2) || '---'} (${niftyDelta.pts} pts) | High ₹${nifty50?.dayHigh?.toFixed(2) || '---'} | Low ₹${nifty50?.dayLow?.toFixed(2) || '---'}`}
      >
        <div className="index-chip-head">
          <span className="index-chip-icon">
            <Activity size={11} className={niftyDelta.isUp ? 'text-up' : 'text-down'} />
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
          
          <span className={`index-chip-badge font-mono tabular-nums ${niftyDelta.isUp ? 'up' : 'down'}`}>
            {niftyDelta.isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            <span className="index-chip-pts">{niftyDelta.pts}</span>
            <span className="index-chip-pct">{niftyDelta.pct}</span>
          </span>
        </div>
      </div>

      {/* ── BANK NIFTY INDEX CHIP ── */}
      <div
        className={`header-index-chip ${bankDelta.isUp ? 'is-up' : 'is-down'} ${flashes?.bank ? `flash-${flashes.bank}` : ''}`}
        onClick={() => {
          audioAlerts.playClickHaptic();
          setChartSymbol('BANKNIFTY');
          setActiveTab('Charts');
        }}
        title={`BANK NIFTY: ₹${bankNifty?.price?.toFixed(2) || '---'} (${bankDelta.pts} pts) | High ₹${bankNifty?.dayHigh?.toFixed(2) || '---'} | Low ₹${bankNifty?.dayLow?.toFixed(2) || '---'}`}
      >
        <div className="index-chip-head">
          <span className="index-chip-icon">
            <Activity size={11} className={bankDelta.isUp ? 'text-up' : 'text-down'} />
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
          
          <span className={`index-chip-badge font-mono tabular-nums ${bankDelta.isUp ? 'up' : 'down'}`}>
            {bankDelta.isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            <span className="index-chip-pts">{bankDelta.pts}</span>
            <span className="index-chip-pct">{bankDelta.pct}</span>
          </span>
        </div>
      </div>

      {/* ── SENSEX INDEX CHIP ── */}
      <div
        className={`header-index-chip ${sensexDelta.isUp ? 'is-up' : 'is-down'} ${flashes?.sensex ? `flash-${flashes.sensex}` : ''}`}
        onClick={() => {
          audioAlerts.playClickHaptic();
          setChartSymbol('SENSEX');
          setActiveTab('Charts');
        }}
        title={`SENSEX: ₹${sensex?.price?.toFixed(2) || '---'} (${sensexDelta.pts} pts) | High ₹${sensex?.dayHigh?.toFixed(2) || '---'} | Low ₹${sensex?.dayLow?.toFixed(2) || '---'}`}
      >
        <div className="index-chip-head">
          <span className="index-chip-icon">
            <Activity size={11} className={sensexDelta.isUp ? 'text-up' : 'text-down'} />
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
          
          <span className={`index-chip-badge font-mono tabular-nums ${sensexDelta.isUp ? 'up' : 'down'}`}>
            {sensexDelta.isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            <span className="index-chip-pts">{sensexDelta.pts}</span>
            <span className="index-chip-pct">{sensexDelta.pct}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
