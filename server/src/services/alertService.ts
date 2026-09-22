/**
 * @module alertService
 * @description Fires DAY_HIGH and DAY_LOW alerts when price actually reaches
 * the day's high or low — for both indices (NIFTY 50, BANKNIFTY) and stocks.
 * Behaviour is identical for indices and stocks.
 */

import crypto from 'node:crypto';
import type { StockData, StockAlert } from '../types/index.js';
import logger from '../utils/logger.js';

interface HighLowState {
  atHigh: boolean;
  atLow: boolean;
  highValue: number;
  lowValue: number;
  maxPriceSeenToday: number;
  minPriceSeenToday: number;
  volumeSpiked: boolean;
}

class AlertService {
  private previousHighLowState: Map<string, HighLowState> = new Map();
  private inMemoryAlerts: StockAlert[] = [];

  private generateDeterministicUUID(input: string): string {
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-a${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
  }

  checkAndGenerateAlerts(stocks: StockData[]): StockAlert[] {
    const newAlerts: StockAlert[] = [];
    const now = new Date().toISOString();
    const dayTimestamp = now.substring(0, 10);
    const currentMs = Date.now();

    for (const stock of stocks) {
      const isIndex = stock.indexName === 'INDEX';

      // First time seeing this symbol — record initial baseline state, skip alert
      if (!this.previousHighLowState.has(stock.symbol)) {
        this.previousHighLowState.set(stock.symbol, {
          atHigh: stock.atDayHigh,
          atLow: stock.atDayLow,
          highValue: stock.dayHigh,
          lowValue: stock.dayLow,
          maxPriceSeenToday: stock.price,
          minPriceSeenToday: stock.price,
          volumeSpiked: stock.volumeSpike,
        });
        continue;
      }

      const prev = this.previousHighLowState.get(stock.symbol)!;
      let triggeredAlert = false;

      // ── 1. DAY HIGH ────────────────────────────────────────────────
      // Triggers if:
      // a) Exchange dayHigh moved higher than previous highValue (brand new high!)
      // b) Current price made a new high today (price > maxPriceSeenToday) and is at day high
      // c) Price re-entered day high zone (atDayHigh && !prev.atHigh)
      const isNewExchangeHigh = stock.dayHigh > 0 && prev.highValue > 0 && stock.dayHigh > prev.highValue;
      const isNewPriceHigh = stock.atDayHigh && (!prev.atHigh || stock.price > prev.maxPriceSeenToday);
      const isNewHigh = isNewExchangeHigh || isNewPriceHigh;

      if (isNewHigh) {
        const alertPrice = isNewExchangeHigh ? stock.dayHigh : stock.price;
        newAlerts.push({
          id: this.generateDeterministicUUID(`${stock.symbol}_DAY_HIGH_${dayTimestamp}_${currentMs}`),
          symbol: stock.symbol,
          name: stock.name,
          alertType: 'DAY_HIGH',
          price: alertPrice,
          change: stock.change,
          changePercent: stock.changePercent,
          createdAt: now,
        });
        triggeredAlert = true;
        logger.info(`🚀 DAY HIGH: ${stock.symbol} @ ₹${alertPrice.toFixed(2)} (high: ₹${stock.dayHigh.toFixed(2)})`);
      }

      // ── 2. DAY LOW ─────────────────────────────────────────────────
      // Triggers if:
      // a) Exchange dayLow moved lower than previous lowValue (brand new low!)
      // b) Current price made a new low today (price < minPriceSeenToday) and is at day low
      // c) Price re-entered day low zone (atDayLow && !prev.atLow)
      const isNewExchangeLow = stock.dayLow > 0 && prev.lowValue > 0 && stock.dayLow < prev.lowValue;
      const isNewPriceLow = stock.atDayLow && (!prev.atLow || stock.price < prev.minPriceSeenToday);
      const isNewLow = isNewExchangeLow || isNewPriceLow;

      if (isNewLow && !triggeredAlert) {
        const alertPrice = isNewExchangeLow ? stock.dayLow : stock.price;
        newAlerts.push({
          id: this.generateDeterministicUUID(`${stock.symbol}_DAY_LOW_${dayTimestamp}_${currentMs}`),
          symbol: stock.symbol,
          name: stock.name,
          alertType: 'DAY_LOW',
          price: alertPrice,
          change: stock.change,
          changePercent: stock.changePercent,
          createdAt: now,
        });
        triggeredAlert = true;
        logger.info(`📉 DAY LOW: ${stock.symbol} @ ₹${alertPrice.toFixed(2)} (low: ₹${stock.dayLow.toFixed(2)})`);
      }

      // ── 3. VOLUME SPIKE (stocks only) ─────────────────────────────
      if (!isIndex && stock.volumeSpike === true && !prev.volumeSpiked && !triggeredAlert) {
        newAlerts.push({
          id: this.generateDeterministicUUID(`${stock.symbol}_VOLUME_SPIKE_${dayTimestamp}_${currentMs}`),
          symbol: stock.symbol,
          name: stock.name,
          alertType: 'VOLUME_SPIKE',
          price: stock.price,
          change: stock.change,
          changePercent: stock.changePercent,
          createdAt: now,
        });
        logger.info(`⚡ VOLUME SPIKE: ${stock.symbol} ${stock.relativeVolume.toFixed(1)}x average`);
      }

      // ── Update state ───────────────────────────────────────────────
      this.previousHighLowState.set(stock.symbol, {
        atHigh: stock.atDayHigh,
        atLow: stock.atDayLow,
        highValue: Math.max(prev.highValue, stock.dayHigh),
        lowValue: prev.lowValue === 0 ? stock.dayLow : Math.min(prev.lowValue, stock.dayLow),
        maxPriceSeenToday: Math.max(prev.maxPriceSeenToday, stock.price),
        minPriceSeenToday: Math.min(prev.minPriceSeenToday, stock.price),
        volumeSpiked: stock.volumeSpike,
      });
    }

    if (newAlerts.length > 0) {
      this.inMemoryAlerts = [...newAlerts, ...this.inMemoryAlerts].slice(0, 1000);
    }

    return newAlerts;
  }

  async getRecentAlerts(limit: number = 100): Promise<StockAlert[]> {
    return this.inMemoryAlerts.slice(0, limit);
  }

  getTrackedSymbolCount(): number {
    return this.previousHighLowState.size;
  }

  getAgentDiagnostics() {
    return Array.from(this.previousHighLowState.entries()).map(([symbol, state]) => ({
      symbol,
      isCurrentlyAtHigh: state.atHigh,
      isCurrentlyAtLow: state.atLow,
      highestPriceAgentHasSeenToday: state.maxPriceSeenToday,
      lowestPriceAgentHasSeenToday: state.minPriceSeenToday,
      highValue: state.highValue,
      lowValue: state.lowValue,
    }));
  }
}

export const alertService = new AlertService();
export default alertService;
