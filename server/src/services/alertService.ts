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
      const SIGNIFICANCE_THRESHOLD = 0.001; // 0.1% movement required for subsequent alerts

      // ── 1. DAY HIGH ────────────────────────────────────────────────
      // Triggers if:
      // a) Exchange dayHigh moved higher than previous highValue (brand new high!)
      // b) Current price made a new high today (price > maxPriceSeenToday) and is at day high
      const isNewExchangeHigh = stock.dayHigh > 0 && prev.highValue > 0 && stock.dayHigh > prev.highValue;
      const isNewPriceHigh = stock.atDayHigh && stock.price > prev.maxPriceSeenToday;
      const isNewHigh = isNewExchangeHigh || isNewPriceHigh;

      if (isNewHigh) {
        const alertPrice = isNewExchangeHigh ? stock.dayHigh : stock.price;
        const requiredHigh = prev.highValue * (1 + SIGNIFICANCE_THRESHOLD);
        
        // Only trigger if it's a significant new high (0.1% higher) to prevent micro-tick spam
        if (alertPrice >= requiredHigh || prev.highValue === 0) {
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
          prev.highValue = Math.max(prev.highValue, alertPrice); // update to the alerted price
        }
      }

      // ── 2. DAY LOW ─────────────────────────────────────────────────
      // Triggers if:
      // a) Exchange dayLow moved lower than previous lowValue (brand new low!)
      // b) Current price made a new low today (price < minPriceSeenToday) and is at day low
      const isNewExchangeLow = stock.dayLow > 0 && prev.lowValue > 0 && stock.dayLow < prev.lowValue;
      const isNewPriceLow = stock.atDayLow && stock.price < prev.minPriceSeenToday;
      const isNewLow = isNewExchangeLow || isNewPriceLow;

      if (isNewLow && !triggeredAlert) {
        const alertPrice = isNewExchangeLow ? stock.dayLow : stock.price;
        const requiredLow = prev.lowValue * (1 - SIGNIFICANCE_THRESHOLD);
        
        // Only trigger if it's a significant new low (0.1% lower) to prevent micro-tick spam
        if (alertPrice <= requiredLow || prev.lowValue === 0) {
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
          prev.lowValue = prev.lowValue === 0 ? alertPrice : Math.min(prev.lowValue, alertPrice);
        }
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
        highValue: prev.highValue, // Do not chase dayHigh, let the alert logic update it
        lowValue: prev.lowValue,   // Do not chase dayLow, let the alert logic update it
        maxPriceSeenToday: Math.max(prev.maxPriceSeenToday, stock.price),
        minPriceSeenToday: isNaN(prev.minPriceSeenToday) ? stock.price : Math.min(prev.minPriceSeenToday, stock.price),
        volumeSpiked: stock.volumeSpike || prev.volumeSpiked,
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
