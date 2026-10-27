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
  lastHighAlertTime: number;
  lastHighAlertPrice: number;
  lastLowAlertTime: number;
  lastLowAlertPrice: number;
  lastSpikeAlertTime: number;
}

// ── Rate limiting & significance thresholds ──────────────────────────
const ALERT_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown per symbol per alert type
const MIN_MOVE_PERCENT = 0.0025; // 0.25% minimum movement from last alert price for subsequent alerts
const SURGE_OVERRIDE_PERCENT = 0.005; // 0.50% surge/crash overrides cooldown
const INDEX_MIN_MOVE_PERCENT = 0.001; // 0.10% for indices (NIFTY ~25pts, SENSEX ~80pts)
const VOLUME_SPIKE_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes between volume spikes per symbol

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
      // Reject flat/untraded stocks with no intraday range (< 0.05 spread)
      if ((stock.dayHigh - stock.dayLow) < 0.05) {
        continue;
      }

      const isIndex = stock.indexName === 'INDEX' || stock.symbol.includes('NIFTY') || stock.symbol.includes('SENSEX');

      // First time seeing this symbol — record initial baseline state, skip alert
      if (!this.previousHighLowState.has(stock.symbol)) {
        this.previousHighLowState.set(stock.symbol, {
          atHigh: stock.atDayHigh,
          atLow: stock.atDayLow,
          highValue: stock.dayHigh,
          lowValue: stock.dayLow,
          maxPriceSeenToday: Math.max(stock.dayHigh, stock.price),
          minPriceSeenToday: Math.min(stock.dayLow, stock.price),
          volumeSpiked: Boolean(stock.volumeSpike),
          lastHighAlertTime: 0,
          lastHighAlertPrice: 0,
          lastLowAlertTime: 0,
          lastLowAlertPrice: 0,
          lastSpikeAlertTime: 0,
        });
        continue;
      }

      const prev = this.previousHighLowState.get(stock.symbol)!;
      let triggeredAlert = false;

      // ── 1. DAY HIGH ────────────────────────────────────────────────
      // Triggers when:
      // 1. Stock is actually at or near day high (within 0.05% tolerance)
      // 2. Either exchange dayHigh broke previous highValue OR price exceeded previous maxPriceSeenToday
      // 3. For equities, stock must not be crashing (changePercent >= -0.5%)
      const isNearDayHigh = stock.atDayHigh || stock.price >= (stock.dayHigh * 0.9995);
      const breaksExchangeHigh = stock.dayHigh > prev.highValue;
      const breaksPriceHigh = stock.price > prev.maxPriceSeenToday;
      const isHighMomentumValid = isIndex || stock.changePercent >= -0.5;

      if (isNearDayHigh && (breaksExchangeHigh || breaksPriceHigh) && isHighMomentumValid) {
        const alertPrice = breaksExchangeHigh ? stock.dayHigh : stock.price;
        const timeSinceLastAlert = currentMs - prev.lastHighAlertTime;
        const priceMove = prev.lastHighAlertPrice > 0 ? (alertPrice - prev.lastHighAlertPrice) / prev.lastHighAlertPrice : 1;
        const minRequiredMove = isIndex ? INDEX_MIN_MOVE_PERCENT : MIN_MOVE_PERCENT;

        // Gatekeeping against duplicates / micro-tick spam:
        // - First alert of the day: allowed
        // - Significant surge (>= 0.50% move): overrides time cooldown
        // - Cooldown passed (>= 60s) AND moved at least minRequiredMove (0.25%): allowed
        const isAllowed = prev.lastHighAlertTime === 0 ||
          priceMove >= SURGE_OVERRIDE_PERCENT ||
          (timeSinceLastAlert >= ALERT_COOLDOWN_MS && priceMove >= minRequiredMove);

        if (isAllowed) {
          const alreadyInBatch = newAlerts.some(a => a.symbol === stock.symbol && a.alertType === 'DAY_HIGH');
          if (!alreadyInBatch) {
            newAlerts.push({
              id: this.generateDeterministicUUID(`${stock.symbol}_DAY_HIGH_${dayTimestamp}_${currentMs}`),
              symbol: stock.symbol,
              name: stock.name,
              alertType: 'DAY_HIGH',
              price: alertPrice,
              change: stock.change,
              changePercent: stock.changePercent,
              createdAt: nowIso,
            });
            triggeredAlert = true;
            logger.info(`🚀 DAY HIGH: ${stock.symbol} @ ₹${alertPrice.toFixed(2)} (+${(priceMove * 100).toFixed(2)}% from prev)`);

            // Synchronize BOTH high markers immediately to prevent duplicate price alert
            const newHighMark = Math.max(prev.highValue, prev.maxPriceSeenToday, alertPrice, stock.dayHigh, stock.price);
            prev.highValue = newHighMark;
            prev.maxPriceSeenToday = newHighMark;
            prev.lastHighAlertTime = currentMs;
            prev.lastHighAlertPrice = alertPrice;
          }
        }
      }

      // ── 2. DAY LOW ─────────────────────────────────────────────────
      // Triggers when:
      // 1. Stock is actually at or near day low (within 0.05% tolerance)
      // 2. Either exchange dayLow broke previous lowValue OR price dropped below previous minPriceSeenToday
      // 3. For equities, stock must not be flying high (changePercent <= 0.5%)
      const isNearDayLow = stock.atDayLow || stock.price <= (stock.dayLow * 1.0005);
      const breaksExchangeLow = prev.lowValue > 0 && stock.dayLow < prev.lowValue;
      const breaksPriceLow = prev.minPriceSeenToday > 0 && stock.price < prev.minPriceSeenToday;
      const isLowMomentumValid = isIndex || stock.changePercent <= 0.5;

      if (isNearDayLow && (breaksExchangeLow || breaksPriceLow) && isLowMomentumValid && !triggeredAlert) {
        const alertPrice = breaksExchangeLow ? stock.dayLow : stock.price;
        const timeSinceLastAlert = currentMs - prev.lastLowAlertTime;
        const priceDrop = prev.lastLowAlertPrice > 0 ? (prev.lastLowAlertPrice - alertPrice) / prev.lastLowAlertPrice : 1;
        const minRequiredDrop = isIndex ? INDEX_MIN_MOVE_PERCENT : MIN_MOVE_PERCENT;

        // Gatekeeping against duplicates / micro-tick spam:
        // - First alert of the day: allowed
        // - Significant drop (>= 0.50% move): overrides time cooldown
        // - Cooldown passed (>= 60s) AND dropped at least minRequiredDrop (0.25%): allowed
        const isAllowed = prev.lastLowAlertTime === 0 ||
          priceDrop >= SURGE_OVERRIDE_PERCENT ||
          (timeSinceLastAlert >= ALERT_COOLDOWN_MS && priceDrop >= minRequiredDrop);

        if (isAllowed) {
          const alreadyInBatch = newAlerts.some(a => a.symbol === stock.symbol && a.alertType === 'DAY_LOW');
          if (!alreadyInBatch) {
            newAlerts.push({
              id: this.generateDeterministicUUID(`${stock.symbol}_DAY_LOW_${dayTimestamp}_${currentMs}`),
              symbol: stock.symbol,
              name: stock.name,
              alertType: 'DAY_LOW',
              price: alertPrice,
              change: stock.change,
              changePercent: stock.changePercent,
              createdAt: nowIso,
            });
            triggeredAlert = true;
            logger.info(`📉 DAY LOW: ${stock.symbol} @ ₹${alertPrice.toFixed(2)} (-${(priceDrop * 100).toFixed(2)}% from prev)`);

            // Synchronize BOTH low markers immediately to prevent duplicate price alert
            const newLowMark = Math.min(prev.lowValue || alertPrice, prev.minPriceSeenToday || alertPrice, alertPrice, stock.dayLow, stock.price);
            prev.lowValue = newLowMark;
            prev.minPriceSeenToday = newLowMark;
            prev.lastLowAlertTime = currentMs;
            prev.lastLowAlertPrice = alertPrice;
          }
        }
      }

      // ── 3. VOLUME SPIKE (stocks only) ─────────────────────────────
      if (!isIndex && stock.volumeSpike === true && !triggeredAlert) {
        const timeSinceLastSpike = currentMs - prev.lastSpikeAlertTime;
        const isSpikeAllowed = prev.lastSpikeAlertTime === 0 || timeSinceLastSpike >= VOLUME_SPIKE_COOLDOWN_MS;

        if (isSpikeAllowed && !prev.volumeSpiked) {
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
            prev.lastSpikeAlertTime = currentMs;
            prev.volumeSpiked = true;
          }
        }
      } else if (!stock.volumeSpike) {
        if (currentMs - prev.lastSpikeAlertTime >= VOLUME_SPIKE_COOLDOWN_MS) {
          prev.volumeSpiked = false;
        }
      }

      // ── Update tracking state ───────────────────────────────────────
      const updatedHigh = Math.max(prev.highValue, stock.dayHigh, stock.price);
      const updatedLow = prev.lowValue === 0
        ? (stock.dayLow > 0 ? stock.dayLow : stock.price)
        : (stock.dayLow > 0 ? Math.min(prev.lowValue, stock.dayLow, stock.price) : Math.min(prev.lowValue, stock.price));

      prev.atHigh = stock.atDayHigh;
      prev.atLow = stock.atDayLow;
      prev.highValue = updatedHigh;
      prev.lowValue = updatedLow;
      prev.maxPriceSeenToday = Math.max(prev.maxPriceSeenToday, stock.price, stock.dayHigh);
      prev.minPriceSeenToday = isNaN(prev.minPriceSeenToday) || prev.minPriceSeenToday === 0
        ? Math.min(stock.price, stock.dayLow)
        : Math.min(prev.minPriceSeenToday, stock.price, stock.dayLow);
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
      lastHighAlertTime: state.lastHighAlertTime ? new Date(state.lastHighAlertTime).toISOString() : 'none',
      lastLowAlertTime: state.lastLowAlertTime ? new Date(state.lastLowAlertTime).toISOString() : 'none',
      lastSpikeAlertTime: state.lastSpikeAlertTime ? new Date(state.lastSpikeAlertTime).toISOString() : 'none',
    }));
  }
}

export const alertService = new AlertService();
export default alertService;
