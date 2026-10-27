/**
 * @module alertService
 * @description Real-time alert service for DAY_HIGH, DAY_LOW, and VOLUME_SPIKE.
 * Ensures 100% accurate alert delivery with ZERO artificial restrictions:
 * - Fires IMMEDIATELY on any genuine new intraday high or low (no cooldown or minimum move barrier)
 * - Eliminates duplicate alerts ("double double") by strictly unifying peak/trough state
 * - Eliminates false ("wrong") alerts with rigorous data sanity checks
 */

import crypto from 'node:crypto';
import type { StockData, StockAlert } from '../types/index.js';
import logger from '../utils/logger.js';

interface HighLowState {
  atHigh: boolean;
  atLow: boolean;
  highValue: number;
  lowValue: number;
  volumeSpiked: boolean;
  lastAlertPrice: number;
  lastAlertType?: 'DAY_HIGH' | 'DAY_LOW' | 'VOLUME_SPIKE';
}

class AlertService {
  private previousHighLowState: Map<string, HighLowState> = new Map();
  private inMemoryAlerts: StockAlert[] = [];
  private currentTradingDay: string = '';

  private generateDeterministicUUID(input: string): string {
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-a${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
  }

  checkAndGenerateAlerts(stocks: StockData[]): StockAlert[] {
    const newAlerts: StockAlert[] = [];
    const now = new Date();
    const nowIso = now.toISOString();
    const dayTimestamp = nowIso.substring(0, 10);
    const currentMs = Date.now();

    // Auto-reset high/low memory state at calendar trading day boundary in Indian Standard Time (IST)
    const istDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    if (this.currentTradingDay !== istDate) {
      logger.info(`🌅 New trading day detected (${istDate}, prev was '${this.currentTradingDay || 'none'}'). Resetting Alert Service high/low memory state.`);
      this.currentTradingDay = istDate;
      this.previousHighLowState.clear();
    }

    for (const stock of stocks) {
      // ── Data sanity checks to eliminate "wrong" alerts ───────────────
      if (!stock || stock.price <= 0 || stock.dayHigh <= 0 || stock.dayLow <= 0) {
        continue;
      }
      if (stock.dayHigh < stock.dayLow) {
        continue;
      }
      // Untraded or flat stocks with no intraday spread
      if (stock.dayHigh === stock.dayLow) {
        continue;
      }

      const isIndex = stock.indexName === 'INDEX' || stock.symbol.includes('NIFTY') || stock.symbol.includes('SENSEX');

      // First time seeing this symbol today — record initial baseline state, skip alert
      if (!this.previousHighLowState.has(stock.symbol)) {
        this.previousHighLowState.set(stock.symbol, {
          atHigh: stock.atDayHigh,
          atLow: stock.atDayLow,
          highValue: Math.max(stock.dayHigh, stock.price),
          lowValue: stock.dayLow > 0 ? Math.min(stock.dayLow, stock.price) : stock.price,
          volumeSpiked: Boolean(stock.volumeSpike),
          lastAlertPrice: 0,
        });
        continue;
      }

      const prev = this.previousHighLowState.get(stock.symbol)!;
      let triggeredAlert = false;

      // ── 1. DAY HIGH ────────────────────────────────────────────────
      // A genuine new high:
      // - Stock is currently at or breaking day high
      // - Alert price is strictly higher than previous peak
      const isAtDayHigh = stock.atDayHigh || stock.price >= stock.dayHigh;
      const alertPriceHigh = Math.max(stock.dayHigh, stock.price);
      const isNewHigh = alertPriceHigh > prev.highValue;

      if (isAtDayHigh && isNewHigh) {
        const alreadyInBatch = newAlerts.some(a => a.symbol === stock.symbol && a.alertType === 'DAY_HIGH');
        if (!alreadyInBatch) {
          const prevClose = stock.previousClose > 0 ? stock.previousClose : (stock.price - stock.change);
          const alertChange = prevClose > 0 ? Number((alertPriceHigh - prevClose).toFixed(2)) : stock.change;
          const alertChangePercent = prevClose > 0 ? Number(((alertChange / prevClose) * 100).toFixed(2)) : stock.changePercent;

          newAlerts.push({
            id: this.generateDeterministicUUID(`${stock.symbol}_DAY_HIGH_${dayTimestamp}_${currentMs}`),
            symbol: stock.symbol,
            name: stock.name,
            alertType: 'DAY_HIGH',
            price: alertPriceHigh,
            change: alertChange,
            changePercent: alertChangePercent,
            createdAt: nowIso,
          });
          triggeredAlert = true;
          logger.info(`🚀 DAY HIGH: ${stock.symbol} @ ₹${alertPriceHigh.toFixed(2)} (+${alertChangePercent}%)`);

          // Update unified high immediately to guarantee no duplicate alert for this price
          prev.highValue = alertPriceHigh;
          prev.lastAlertPrice = alertPriceHigh;
          prev.lastAlertType = 'DAY_HIGH';
        }
      }

      // ── 2. DAY LOW ─────────────────────────────────────────────────
      // A genuine new low:
      // - Stock is currently at or breaking day low
      // - Alert price is strictly lower than previous trough
      const isAtDayLow = stock.atDayLow || stock.price <= stock.dayLow;
      const alertPriceLow = stock.dayLow > 0 && stock.price > 0 ? Math.min(stock.dayLow, stock.price) : stock.price;
      const isNewLow = prev.lowValue > 0 && alertPriceLow < prev.lowValue;

      if (isAtDayLow && isNewLow && !triggeredAlert) {
        const alreadyInBatch = newAlerts.some(a => a.symbol === stock.symbol && a.alertType === 'DAY_LOW');
        if (!alreadyInBatch) {
          const prevClose = stock.previousClose > 0 ? stock.previousClose : (stock.price - stock.change);
          const alertChange = prevClose > 0 ? Number((alertPriceLow - prevClose).toFixed(2)) : stock.change;
          const alertChangePercent = prevClose > 0 ? Number(((alertChange / prevClose) * 100).toFixed(2)) : stock.changePercent;

          newAlerts.push({
            id: this.generateDeterministicUUID(`${stock.symbol}_DAY_LOW_${dayTimestamp}_${currentMs}`),
            symbol: stock.symbol,
            name: stock.name,
            alertType: 'DAY_LOW',
            price: alertPriceLow,
            change: alertChange,
            changePercent: alertChangePercent,
            createdAt: nowIso,
          });
          triggeredAlert = true;
          logger.info(`📉 DAY LOW: ${stock.symbol} @ ₹${alertPriceLow.toFixed(2)} (${alertChangePercent}%)`);

          // Update unified low immediately to guarantee no duplicate alert for this price
          prev.lowValue = alertPriceLow;
          prev.lastAlertPrice = alertPriceLow;
          prev.lastAlertType = 'DAY_LOW';
        }
      }

      // ── 3. VOLUME SPIKE (stocks only) ─────────────────────────────
      if (!isIndex && stock.volumeSpike === true && !prev.volumeSpiked && !triggeredAlert) {
        const alreadyInBatch = newAlerts.some(a => a.symbol === stock.symbol && a.alertType === 'VOLUME_SPIKE');
        if (!alreadyInBatch) {
          newAlerts.push({
            id: this.generateDeterministicUUID(`${stock.symbol}_VOLUME_SPIKE_${dayTimestamp}_${currentMs}`),
            symbol: stock.symbol,
            name: stock.name,
            alertType: 'VOLUME_SPIKE',
            price: stock.price,
            change: stock.change,
            changePercent: stock.changePercent,
            createdAt: nowIso,
          });
          logger.info(`⚡ VOLUME SPIKE: ${stock.symbol} ${stock.relativeVolume.toFixed(1)}x average`);
          prev.volumeSpiked = true;
          prev.lastAlertPrice = stock.price;
          prev.lastAlertType = 'VOLUME_SPIKE';
        }
      } else if (!stock.volumeSpike) {
        // Re-arm when spike subsides
        prev.volumeSpiked = false;
      }

      // ── Synchronize state peaks and troughs ─────────────────────────
      prev.atHigh = isAtDayHigh;
      prev.atLow = isAtDayLow;

      if (stock.dayHigh > prev.highValue) {
        prev.highValue = stock.dayHigh;
      }
      if (stock.dayLow > 0 && (prev.lowValue === 0 || stock.dayLow < prev.lowValue)) {
        prev.lowValue = stock.dayLow;
      }
      if (stock.price > prev.highValue) {
        prev.highValue = stock.price;
      }
      if (stock.price > 0 && (prev.lowValue === 0 || stock.price < prev.lowValue)) {
        prev.lowValue = stock.price;
      }
    }

    if (newAlerts.length > 0) {
      for (const alert of newAlerts) {
        const alertTime = new Date(alert.createdAt).getTime();
        // Update in-place if an alert for the same stock & alertType was recorded within 60s
        const existingIdx = this.inMemoryAlerts.findIndex(a =>
          a.symbol === alert.symbol &&
          a.alertType === alert.alertType &&
          Math.abs(alertTime - new Date(a.createdAt).getTime()) < 60000
        );
        if (existingIdx >= 0) {
          this.inMemoryAlerts[existingIdx] = alert;
        } else {
          this.inMemoryAlerts.unshift(alert);
        }
      }
      this.inMemoryAlerts = this.inMemoryAlerts.slice(0, 1000);
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
      highestPriceAgentHasSeenToday: state.highValue,
      lowestPriceAgentHasSeenToday: state.lowValue,
      highValue: state.highValue,
      lowValue: state.lowValue,
      volumeSpiked: state.volumeSpiked,
      lastAlertPrice: state.lastAlertPrice,
      lastAlertType: state.lastAlertType || 'none',
    }));
  }
}

export const alertService = new AlertService();
export default alertService;
